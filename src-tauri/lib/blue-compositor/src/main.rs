mod input;
mod ipc;
mod render;
mod state;
mod xwayland;

use std::time::Duration;
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_env("BLUE_LOG")
                .unwrap_or_else(|_| EnvFilter::new("blue_compositor=info,smithay=warn")),
        )
        .init();

    info!("Blue Compositor v0.4.0 starting...");
    write_desktop_file();

    if std::env::var("WAYLAND_DISPLAY").is_ok() || std::env::var("DISPLAY").is_ok() {
        warn!("Existing session detected — nested (winit) mode");
        run_winit();
    } else {
        info!("No display server — DRM/KMS (TTY) mode");
        run_udev();
    }
}

fn write_desktop_file() {
    let Ok(exe) = std::env::current_exe() else { return };
    let content = format!(
        "[Desktop Entry]\nName=Blue Environment\nComment=Blue Wayland Desktop\nExec={}\nType=Application\nDesktopNames=Blue\n",
        exe.display()
    );
    let system = std::path::Path::new("/usr/local/share/wayland-sessions/blue-environment.desktop");
    let _ = std::fs::create_dir_all(system.parent().unwrap());
    if std::fs::write(system, &content).is_err() {
        if let Some(home) = dirs::home_dir() {
            let local = home.join(".local/share/wayland-sessions/blue-environment.desktop");
            let _ = std::fs::create_dir_all(local.parent().unwrap());
            let _ = std::fs::write(local, content);
        }
    }
}

fn run_udev() {
    use smithay::backend::session::libseat::LibSeatSession;

    let (session, notifier) = match LibSeatSession::new() {
        Ok(s) => s,
        Err(e) => {
            error!("LibSeat failed: {}", e);
            error!("  sudo systemctl enable --now seatd");
            error!("  sudo usermod -aG seat $USER && re-login");
            std::process::exit(1);
        }
    };

    let event_loop: smithay::reexports::calloop::EventLoop<'static, state::BlueState> =
        smithay::reexports::calloop::EventLoop::try_new().expect("event loop");
    let display: wayland_server::Display<state::BlueState> =
        wayland_server::Display::new().expect("display");

    let lh = event_loop.handle();
    let mut st = state::BlueState::new(&lh, display);

    // Insert session notifier
    lh.insert_source(notifier, |_evt, _, _state| {})
        .expect("session notifier");

    st.init_udev(session, &lh);

    if let Err(e) = st.init_xwayland(&lh) {
        error!("XWayland failed: {} — X11 apps unavailable", e);
    }

    st.init_ipc(&lh);

    let socket = st.socket_name().to_string();
    std::env::set_var("WAYLAND_DISPLAY", &socket);
    std::env::set_var("XDG_SESSION_TYPE", "wayland");
    std::env::set_var("XDG_CURRENT_DESKTOP", "Blue");
    info!("Compositor ready — WAYLAND_DISPLAY={}", socket);

    run_loop(event_loop, st);
}

fn run_winit() {
    use smithay::backend::winit;

    let event_loop: smithay::reexports::calloop::EventLoop<'static, state::BlueState> =
        smithay::reexports::calloop::EventLoop::try_new().expect("event loop");
    let display: wayland_server::Display<state::BlueState> =
        wayland_server::Display::new().expect("display");

    let lh = event_loop.handle();
    let mut st = state::BlueState::new(&lh, display);

    let (backend, evt) =
        winit::init::<smithay::backend::renderer::gles::GlesRenderer>()
            .expect("winit init");

    st.init_winit(backend, evt, &lh);

    if let Err(e) = st.init_xwayland(&lh) {
        error!("XWayland failed: {} — X11 apps unavailable", e);
    }

    st.init_ipc(&lh);

    let socket = st.socket_name().to_string();
    std::env::set_var("WAYLAND_DISPLAY", &socket);
    std::env::set_var("XDG_SESSION_TYPE", "wayland");
    std::env::set_var("XDG_CURRENT_DESKTOP", "Blue");
    info!("Nested compositor ready — WAYLAND_DISPLAY={}", socket);

    run_loop(event_loop, st);
}

fn run_loop(
    mut event_loop: smithay::reexports::calloop::EventLoop<'static, state::BlueState>,
    mut state: state::BlueState,
) {
    loop {
        if let Err(e) = event_loop.dispatch(Some(Duration::from_millis(16)), &mut state) {
            error!("Event loop error: {}", e);
            break;
        }
        state.refresh();
        if state.should_exit() {
            info!("Compositor exiting");
            break;
        }
    }
}
