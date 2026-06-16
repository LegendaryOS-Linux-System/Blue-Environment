use std::env;

#[derive(Debug, Clone, PartialEq)]
pub enum SessionType {
    WaylandClient,
    X11Client,
    Tty,
}

pub fn detect_session() -> SessionType {
    if env::var("WAYLAND_DISPLAY").is_ok() {
        return SessionType::WaylandClient;
    }
    if env::var("DISPLAY").is_ok() {
        return SessionType::X11Client;
    }
    SessionType::Tty
}

pub fn is_tty() -> bool {
    detect_session() == SessionType::Tty
}

pub fn session_info() -> String {
    match detect_session() {
        SessionType::WaylandClient => format!(
            "wayland:{}",
            env::var("WAYLAND_DISPLAY").unwrap_or("unknown".into())
        ),
        SessionType::X11Client => format!(
            "x11:{}",
            env::var("DISPLAY").unwrap_or("unknown".into())
        ),
        SessionType::Tty => "tty".to_string(),
    }
}

pub async fn lock() -> Result<(), String> {
    match detect_session() {
        SessionType::WaylandClient => {
            // Try loginctl lock-session first, fallback to swaylock
            let result = tokio::process::Command::new("loginctl")
            .arg("lock-session")
            .status()
            .await;
            if result.map(|s| s.success()).unwrap_or(false) {
                return Ok(());
            }
            tokio::process::Command::new("swaylock")
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
        }
        SessionType::X11Client => {
            tokio::process::Command::new("xdg-screensaver")
            .arg("lock")
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
        }
        SessionType::Tty => Err("Cannot lock TTY session".to_string()),
    }
}
