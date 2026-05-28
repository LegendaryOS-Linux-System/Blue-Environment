use calloop::LoopHandle;
use smithay::{
    desktop::Window,
    utils::{Logical, Point, Rectangle, Size},
    wayland::selection::SelectionTarget,
    xwayland::{
        xwm::{Reorder, ResizeEdge as X11ResizeEdge, XwmId, X11Wm},
        X11Surface, XWayland, XWaylandClientData,
    },
};
use std::os::unix::io::OwnedFd;
use tracing::{error, info, warn};

use crate::state::BlueState;

/// Initialize XWayland and register it with the event loop.
/// This enables running X11 applications (VirtualBox, Wine, legacy apps)
/// inside the Blue compositor.
pub fn init_xwayland(
    state: &mut BlueState,
    loop_handle: &LoopHandle<'static, BlueState>,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Starting XWayland...");

    let xwayland = XWayland::new(loop_handle)?;

    // Insert the XWayland event source
    let ret = loop_handle.insert_source(xwayland, |event, _, state| {
        use smithay::xwayland::XWaylandEvent;
        match event {
            XWaylandEvent::Ready {
                connection,
                client,
                client_fd: _,
                display,
            } => {
                info!("XWayland ready on DISPLAY=:{}", display);
                state.x11_display = Some(display as u32);
                // Export DISPLAY env for newly launched processes
                std::env::set_var("DISPLAY", format!(":{}", display));

                // Create the X11 Window Manager
                let xwm = X11Wm::start_xwm(
                    state.loop_handle.clone(),
                    state.display_handle.clone(),
                    connection,
                    client,
                )
                .unwrap_or_else(|e| {
                    error!("Failed to start X11 WM: {}", e);
                    panic!("X11 WM is required for XWayland support");
                });
                state.xwm = Some(xwm);
            }
            XWaylandEvent::Exited => {
                warn!("XWayland process exited");
                state.xwm = None;
                state.x11_display = None;
            }
        }
    });

    match ret {
        Ok(token) => {
            // Store the XWayland handle by re-creating it from the token
            // (smithay requires us to keep the source alive)
            info!("XWayland source registered");
            Ok(())
        }
        Err(e) => {
            error!("Failed to insert XWayland source: {}", e);
            Err(Box::new(e))
        }
    }
}

// ── X11 Window Manager implementation ─────────────────────────────────────

impl smithay::xwayland::xwm::XwmHandler for BlueState {
    fn xwm_state(&mut self, _xwm: XwmId) -> &mut X11Wm {
        self.xwm.as_mut().expect("XWM not initialized")
    }

    /// Called when a new X11 window is created but not yet mapped.
    fn new_window(&mut self, _xwm: XwmId, _window: X11Surface) {
        // Nothing to do until the window requests to be mapped
    }

    /// Override-redirect windows (menus, tooltips, etc.) — map immediately.
    fn new_override_redirect_window(&mut self, _xwm: XwmId, window: X11Surface) {
        let loc = Point::from((100, 100));
        self.space
            .map_element(Window::new_x11_window(window), loc, false);
    }

    /// Regular X11 window requests to be shown.
    fn map_window_request(&mut self, _xwm: XwmId, window: X11Surface) {
        // Acknowledge the map request
        if let Err(e) = window.set_mapped(true) {
            warn!("set_mapped failed: {}", e);
        }

        // Place the window with a small cascade offset
        let count = self.space.elements().count();
        let offset = (count % 10) * 30;
        let loc = Point::from(((offset + 150) as i32, (offset + 80) as i32));

        let win = Window::new_x11_window(window.clone());
        self.space.map_element(win.clone(), loc, true);

        // Store metadata from X11 window
        let surface_id = win
            .wl_surface()
            .map(|s| s.id().protocol_id() as u64)
            .unwrap_or(0);
        if surface_id != 0 {
            self.window_meta.insert(
                surface_id,
                crate::state::WindowMeta {
                    title: window.title().unwrap_or_default(),
                    app_id: window.class().unwrap_or_default(),
                    workspace: self.current_workspace,
                    ..Default::default()
                },
            );
        }

        info!(
            "X11 window mapped: '{}' ({})",
            window.title().unwrap_or_default(),
            window.class().unwrap_or_default()
        );
    }

    fn map_window_notify(&mut self, _xwm: XwmId, _window: X11Surface) {}

    /// Override-redirect window mapped (e.g. dropdown menus).
    fn mapped_override_redirect_window(&mut self, _xwm: XwmId, window: X11Surface) {
        // Place at current cursor position if known, else a fixed offset
        let loc = Point::from((
            self.pointer_location.x as i32,
            self.pointer_location.y as i32,
        ));
        self.space
            .map_element(Window::new_x11_window(window), loc, false);
    }

    /// X11 window was unmapped (hidden).
    fn unmapped_window(&mut self, _xwm: XwmId, window: X11Surface) {
        let found = self
            .space
            .elements()
            .find(|w| w.x11_surface().map(|x| x == &window).unwrap_or(false))
            .cloned();

        if let Some(w) = found {
            let id = crate::state::BlueState::window_id(&w);
            self.window_meta.remove(&id);
            self.space.unmap_elem(&w);
            info!("X11 window unmapped");
        }
    }

    /// X11 window destroyed.
    fn destroyed_window(&mut self, _xwm: XwmId, window: X11Surface) {
        let found = self
            .space
            .elements()
            .find(|w| w.x11_surface().map(|x| x == &window).unwrap_or(false))
            .cloned();

        if let Some(w) = found {
            let id = crate::state::BlueState::window_id(&w);
            self.window_meta.remove(&id);
            self.space.unmap_elem(&w);
        }
    }

    /// X11 client wants to change the window geometry.
    fn configure_request(
        &mut self,
        _xwm: XwmId,
        window: X11Surface,
        x: Option<i32>,
        y: Option<i32>,
        w: Option<u32>,
        h: Option<u32>,
        _reorder: Option<Reorder>,
    ) {
        let mut geo = window.geometry();

        if let Some(x) = x { geo.loc.x = x; }
        if let Some(y) = y { geo.loc.y = y; }
        if let Some(w) = w { geo.size.w = w as i32; }
        if let Some(h) = h { geo.size.h = h as i32; }

        if let Err(e) = window.configure(geo) {
            warn!("configure_request failed: {}", e);
        }
    }

    fn configure_notify(
        &mut self,
        _xwm: XwmId,
        window: X11Surface,
        geometry: Rectangle<i32, Logical>,
        _above: Option<u32>,
    ) {
        // Update space position if the window moved itself
        let found = self
            .space
            .elements()
            .find(|w| w.x11_surface().map(|x| x == &window).unwrap_or(false))
            .cloned();

        if let Some(win) = found {
            self.space.map_element(win, geometry.loc, false);
        }
    }

    /// X11 resize drag started.
    fn resize_request(
        &mut self,
        _xwm: XwmId,
        _window: X11Surface,
        _button: u32,
        _resize_edge: X11ResizeEdge,
    ) {
        // Full resize grab implementation would go here
    }

    /// X11 move drag started.
    fn move_request(&mut self, _xwm: XwmId, window: X11Surface, _button: u32) {
        // Initiate a compositor-driven move grab
        let found = self
            .space
            .elements()
            .find(|w| w.x11_surface().map(|x| x == &window).unwrap_or(false))
            .cloned();

        if let Some(_win) = found {
            // A full implementation would call start_move_grab here
            // using the stored pointer grab start data
        }
    }

    /// X11 clipboard/selection transfer.
    fn send_selection(
        &mut self,
        _xwm: XwmId,
        _selection: SelectionTarget,
        _mime_type: String,
        _fd: OwnedFd,
    ) {
    }

    fn allow_selection_access(
        &mut self,
        _xwm: XwmId,
        _selection: SelectionTarget,
    ) -> bool {
        true
    }

    fn new_selection(
        &mut self,
        _xwm: XwmId,
        _selection: SelectionTarget,
        _mime_types: Vec<String>,
    ) {
    }

    fn cleared_selection(&mut self, _xwm: XwmId, _selection: SelectionTarget) {}
}
