mod config;
mod ipc;
mod pam_auth;
mod session;
mod users;
mod vt;

use std::{fs, os::unix::fs::PermissionsExt, sync::Arc};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

pub const BEDM_VERSION: &str = "1.0.0";
pub const SOCKET_PATH:  &str = "/run/bedm/bedm.sock";
pub const CONFIG_PATH:  &str = "/etc/bedm/bedm.hk";
pub const LOG_DIR:      &str = "/var/log/bedm";
pub const RUN_DIR:      &str = "/run/bedm";

#[derive(Debug, Clone)]
pub struct DaemonState {
    pub config: config::BedmConfig,
    pub active_session: Option<session::ActiveSession>,
    pub greeter_pid: Option<u32>,
}

#[tokio::main]
async fn main() {
    init_logging();
    info!("BEDM v{} starting", BEDM_VERSION);

    if unsafe { libc::getuid() } != 0 {
        eprintln!("BEDM must run as root (UID 0)");
        std::process::exit(1);
    }

    setup_runtime_dirs();

    // Ensure default config exists
    config::ensure_default_config();

    let cfg = config::load_config(CONFIG_PATH).unwrap_or_else(|e| {
        warn!("Config load error: {} — using defaults", e);
        config::BedmConfig::default()
    });
    info!("Config loaded from {}", CONFIG_PATH);
    info!("Autologin user: {:?}", cfg.autologin_user);

    let state = Arc::new(Mutex::new(DaemonState {
        config: cfg.clone(),
        active_session: None,
        greeter_pid: None,
    }));

    setup_signals();

    if let Some(ref user) = cfg.autologin_user {
        let user = user.clone();
        let session_type = cfg.autologin_session.clone()
            .unwrap_or_else(|| "blue-environment".to_string());
        let delay = cfg.autologin_delay.unwrap_or(0);
        info!("Autologin: {} -> {} (delay={}s)", user, session_type, delay);
        let state_clone = state.clone();
        tokio::spawn(async move {
            if delay > 0 {
                tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
            }
            session::launch_session(&state_clone, &user, &session_type, None).await;
        });
    } else {
        let state_clone = state.clone();
        tokio::spawn(async move {
            launch_greeter(&state_clone).await;
        });
    }

    ipc::run_server(state.clone()).await;
}

fn init_logging() {
    let _ = fs::create_dir_all(LOG_DIR);
    let file_appender = tracing_appender::rolling::daily(LOG_DIR, "bedm.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_max_level(tracing::Level::INFO)
        .init();
}

fn setup_runtime_dirs() {
    for dir in &[RUN_DIR, "/run/bedm/sessions"] {
        fs::create_dir_all(dir).ok();
        fs::set_permissions(dir, fs::Permissions::from_mode(0o755)).ok();
    }
    let _ = fs::remove_file(SOCKET_PATH);
}

fn setup_signals() {
    unsafe {
        let mut sa: libc::sigaction = std::mem::zeroed();
        sa.sa_flags = libc::SA_NOCLDWAIT;
        sa.sa_sigaction = libc::SIG_DFL;
        libc::sigaction(libc::SIGCHLD, &sa, std::ptr::null_mut());
    }
}

async fn launch_greeter(state: &Arc<Mutex<DaemonState>>) {
    let (greeter_path, vt_num) = {
        let st = state.lock().await;
        (
            st.config.greeter_path.clone()
                .unwrap_or_else(|| "/usr/bin/bedm-greeter".to_string()),
            st.config.vt.unwrap_or(1),
        )
    };

    info!("Launching greeter: {}", greeter_path);

    if let Err(e) = vt::switch_to(vt_num) {
        warn!("VT switch to {} failed: {} — continuing", vt_num, e);
    }

    match tokio::process::Command::new(&greeter_path)
        .env("BEDM_SOCKET", SOCKET_PATH)
        .env("BEDM_CONFIG", CONFIG_PATH)
        .env("XDG_SESSION_TYPE", "wayland")
        .spawn()
    {
        Ok(mut child) => {
            let pid = child.id().unwrap_or(0);
            info!("Greeter PID: {}", pid);
            state.lock().await.greeter_pid = Some(pid);
            let _ = child.wait().await;
            info!("Greeter exited — relaunching");
            state.lock().await.greeter_pid = None;
            // Relaunch greeter after session ends
            let state_clone = state.clone();
            Box::pin(launch_greeter(&state_clone)).await;
        }
        Err(e) => {
            error!("Failed to launch greeter '{}': {}", greeter_path, e);
            error!("Is bedm-greeter installed at {}?", greeter_path);
        }
    }
}
