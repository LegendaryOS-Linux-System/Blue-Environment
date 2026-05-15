mod state;
mod input;
mod render;
mod ipc;
mod xwayland;

use std::time::Duration;
use smithay::backend::session::Session;
use tracing::{info, error, warn};
use tracing_subscriber::{EnvFilter, fmt};
use std::fs;

fn init_logging() {
    let home = dirs::home_dir().unwrap_or_default();
    let log_dir = home.join(".cache/Blue-Environment/compositor/logs");
    fs::create_dir_all(&log_dir).ok();
    let file_name = format!("compositor_{}.log", chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let file_appender = tracing_appender::rolling::never(&log_dir, file_name);
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("blue_compositor=info,smithay=warn")))
        .with_writer(non_blocking)
        .with_ansi(false)
        .init();
}

fn write_desktop_file() {
    // v0.5: binaries live in /usr/share/Blue-Environment/
    let compositor_bin = "/usr/share/Blue-Environment/lib/blue-compositor";
    let shell_bin = "/usr/share/Blue-Environment/blue-environment";

    // Wayland session desktop file
    let session_content = format!(
        "[Desktop Entry]\nName=Blue Environment\nComment=Blue Wayland Compositor + Shell\nExec={}\nType=Application\nDesktopNames=Blue\nVersion=0.5.0\n",
        compositor_bin
    );
    let system_sessions = std::path::Path::new("/usr/share/wayland-sessions/blue-environment.desktop");
    let _ = std::fs::create_dir_all(system_sessions.parent().unwrap());
    if std::fs::write(system_sessions, &session_content).is_err() {
        if let Some(home) = dirs::home_dir() {
            let local = home.join(".local/share/wayland-sessions/blue-environment.desktop");
            let _ = std::fs::create_dir_all(local.parent().unwrap());
            let _ = std::fs::write(local, session_content);
        }
    }

    // Application desktop file
    let app_content = format!(
        "[Desktop Entry]\nName=Blue Environment\nComment=Blue Desktop Shell\nExec={}\nIcon=/usr/share/Blue-Environment/icon.png\nType=Application\nCategories=System;\n",
        shell_bin
    );
    let _ = std::fs::create_dir_all("/usr/share/applications");
    let _ = std::fs::write("/usr/share/applications/blue-environment.desktop", &app_content);
}

fn main() {
    fmt()
        .with_env_filter(
            EnvFilter::try_from_env("BLUE_LOG")
                .unwrap_or_else(|_| EnvFilter::new("blue_compositor=info,smithay=warn")),
        )
        .init();

    info!("Blue Compositor v0.3 starting...");

    write_desktop_file();

    let has_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
    let has_x11 = std::env::var("DISPLAY").is_ok();

    if has_wayland || has_x11 {
        warn!("Existing display session detected (wayland={}, x11={}) — running nested (winit)", has_wayland, has_x11);
        run_winit();
    } else {
        info!("No display server — using DRM/KMS backend (TTY mode)");
        run_udev();
    }
}

fn run_udev() {
    use smithay::backend::session::libseat::LibSeatSession;

    let (session, notifier) = match LibSeatSession::new() {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to create libseat session: {}", e);
            error!("Make sure seatd is running: sudo systemctl enable --now seatd");
            error!("And add yourself to seat group: sudo usermod -aG seat $USER");
            std::process::exit(1);
        }
    };

    info!("Seat: {}", session.seat());

    let event_loop: calloop::EventLoop<'static, state::BlueState> =
        calloop::EventLoop::try_new().expect("Failed to create event loop");
    let display: wayland_server::Display<state::BlueState> =
        wayland_server::Display::new().expect("Failed to create Wayland display");

    let loop_handle = event_loop.handle();
    let mut st = state::BlueState::new(&loop_handle, display);

    // Session notifier: handles VT switch events internally via libseat
    // SessionEvent is private in this Smithay revision — just insert with no-op handler
    loop_handle.insert_source(notifier, |_event, _, _state: &mut state::BlueState| {})
        .expect("Failed to insert session notifier");

    st.init_udev(session, &loop_handle);

    if let Err(e) = st.init_xwayland(&loop_handle) {
        error!("XWayland failed to start: {} — X11 apps will not work", e);
    }

    st.init_ipc(&loop_handle);

    let socket = st.socket_name().to_string();
    info!("Compositor ready — WAYLAND_DISPLAY={}", socket);
    std::env::set_var("WAYLAND_DISPLAY", &socket);
    if let Some(xdisp) = st.x11_display {
        std::env::set_var("DISPLAY", format!(":{}", xdisp));
        info!("XWayland on DISPLAY=:{}", xdisp);
    }
    std::env::set_var("XDG_SESSION_TYPE", "wayland");
    std::env::set_var("XDG_CURRENT_DESKTOP", "Blue");

    run_loop(event_loop, st);
}

fn run_winit() {
    use smithay::backend::winit;

    let event_loop: calloop::EventLoop<'static, state::BlueState> =
        calloop::EventLoop::try_new().expect("Failed to create event loop");
    let display: wayland_server::Display<state::BlueState> =
        wayland_server::Display::new().expect("Failed to create Wayland display");

    let loop_handle = event_loop.handle();
    let mut st = state::BlueState::new(&loop_handle, display);

    let (winit_backend, winit_evt) =
        winit::init::<smithay::backend::renderer::gles::GlesRenderer>()
            .expect("Failed to init winit backend");

    st.init_winit(winit_backend, winit_evt, &loop_handle);

    if let Err(e) = st.init_xwayland(&loop_handle) {
        error!("XWayland failed: {} — X11 apps unavailable", e);
    }

    st.init_ipc(&loop_handle);

    let socket = st.socket_name().to_string();
    info!("Nested compositor ready — WAYLAND_DISPLAY={}", socket);
    std::env::set_var("WAYLAND_DISPLAY", &socket);
    std::env::set_var("XDG_SESSION_TYPE", "wayland");
    std::env::set_var("XDG_CURRENT_DESKTOP", "Blue");

    if let Some(xdisp) = st.x11_display {
        std::env::set_var("DISPLAY", format!(":{}", xdisp));
    }

    run_loop(event_loop, st);
}

fn run_loop(
    mut event_loop: calloop::EventLoop<'static, state::BlueState>,
    mut state: state::BlueState,
) {
    loop {
        if let Err(e) = event_loop.dispatch(Some(Duration::from_millis(16)), &mut state) {
            error!("Event loop dispatch error: {}", e);
            break;
        }
        state.refresh();
        if state.should_exit() {
            info!("Compositor exit requested");
            break;
        }
    }
    info!("Blue Compositor stopped");
}
