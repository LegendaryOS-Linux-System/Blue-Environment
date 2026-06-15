#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ipc_client;

use ipc_client::{BedmClient, SessionInfo, UserInfo};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

type ClientState = Arc<Mutex<Option<BedmClient>>>;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuthResult {
    pub success: bool,
    pub username: Option<String>,
    pub error: Option<String>,
    pub attempts_left: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DaemonInfo {
    pub version: String,
    pub hostname: String,
    pub uptime: u64,
    pub os_name: String,
    pub os_version: String,
    pub connected: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GreeterConfig {
    pub theme: String,
    pub clock_format: String,
    pub show_user_list: bool,
    pub background: Option<String>,
}

// ── Tauri v2 commands ──────────────────────────────────────────────────────

#[tauri::command]
async fn connect_daemon(state: tauri::State<'_, ClientState>) -> Result<DaemonInfo, String> {
    let socket_path = std::env::var("BEDM_SOCKET")
        .unwrap_or_else(|_| "/run/bedm/bedm.sock".to_string());

    match BedmClient::connect(&socket_path).await {
        Ok((client, info)) => {
            *state.lock().await = Some(client);
            Ok(DaemonInfo {
                version:    info.version,
                hostname:   info.hostname,
                uptime:     info.uptime,
                os_name:    info.os_name,
                os_version: info.os_version,
                connected:  true,
            })
        }
        Err(e) => Err(format!("Cannot connect to BEDM daemon: {}", e)),
    }
}

#[tauri::command]
async fn get_sessions(state: tauri::State<'_, ClientState>) -> Result<Vec<SessionInfo>, String> {
    let mut guard = state.lock().await;
    let client = guard.as_mut().ok_or("Not connected to daemon")?;
    client.get_sessions().await
}

#[tauri::command]
async fn get_users(state: tauri::State<'_, ClientState>) -> Result<Vec<UserInfo>, String> {
    let mut guard = state.lock().await;
    let client = guard.as_mut().ok_or("Not connected to daemon")?;
    client.get_users().await
}

#[tauri::command]
async fn authenticate(
    state: tauri::State<'_, ClientState>,
    username: String,
    password: String,
) -> Result<AuthResult, String> {
    let mut guard = state.lock().await;
    let client = guard.as_mut().ok_or("Not connected to daemon")?;
    client.authenticate(&username, &password).await
}

#[tauri::command]
async fn start_session(
    state: tauri::State<'_, ClientState>,
    username: String,
    session: String,
) -> Result<String, String> {
    let mut guard = state.lock().await;
    let client = guard.as_mut().ok_or("Not connected to daemon")?;
    client.start_session(&username, &session).await
}

#[tauri::command]
async fn power_action(
    state: tauri::State<'_, ClientState>,
    action: String,
) -> Result<bool, String> {
    let mut guard = state.lock().await;
    let client = guard.as_mut().ok_or("Not connected to daemon")?;
    client.power_action(&action).await
}

#[tauri::command]
fn get_wallpaper() -> Option<String> {
    // Read from BEDM config
    let config_path = std::env::var("BEDM_CONFIG")
        .unwrap_or_else(|_| "/etc/bedm/bedm.hk".to_string());

    // Try to read background from .hk config
    if let Ok(mut cfg) = hk_parser::load_hk_file(&config_path) {
        let _ = hk_parser::resolve_interpolations(&mut cfg);
        if let Some(sec) = cfg.get("general") {
            if let Ok(map) = sec.as_map() {
                if let Some(bg) = map.get("background") {
                    if let Ok(s) = bg.as_string() {
                        if !s.is_empty() && std::path::Path::new(&s).exists() {
                            return Some(format!("file://{}", s));
                        }
                    }
                }
            }
        }
    }

    // Fallback wallpaper paths
    let paths = [
        "/etc/bedm/wallpaper.png",
        "/etc/bedm/wallpaper.jpg",
        "/usr/share/Blue-Environment/wallpapers/default.png",
        "/usr/share/wallpapers/default.png",
    ];
    paths.iter()
        .find(|p| std::path::Path::new(*p).exists())
        .map(|p| format!("file://{}", p))
}

#[tauri::command]
fn get_greeter_config() -> GreeterConfig {
    let config_path = std::env::var("BEDM_CONFIG")
        .unwrap_or_else(|_| "/etc/bedm/bedm.hk".to_string());

    let mut theme = "blue".to_string();
    let mut clock_format = "%H:%M".to_string();
    let mut show_user_list = true;
    let mut background: Option<String> = None;

    if let Ok(mut cfg) = hk_parser::load_hk_file(&config_path) {
        let _ = hk_parser::resolve_interpolations(&mut cfg);
        if let Some(sec) = cfg.get("general") {
            if let Ok(map) = sec.as_map() {
                if let Some(v) = map.get("theme") {
                    theme = v.as_string().unwrap_or(theme);
                }
                if let Some(v) = map.get("clock_format") {
                    clock_format = v.as_string().unwrap_or(clock_format);
                }
                if let Some(v) = map.get("show_user_list") {
                    show_user_list = v.as_bool().unwrap_or(show_user_list);
                }
                if let Some(v) = map.get("background") {
                    background = v.as_string().ok().filter(|s| !s.is_empty());
                }
            }
        }
    }

    GreeterConfig { theme, clock_format, show_user_list, background }
}

#[tauri::command]
fn get_hostname() -> String {
    std::fs::read_to_string("/etc/hostname")
        .unwrap_or_else(|_| "localhost".to_string())
        .trim().to_string()
}

#[tauri::command]
fn get_current_time() -> String {
    chrono::Local::now().format("%H:%M").to_string()
}

#[tauri::command]
fn get_current_date() -> String {
    chrono::Local::now().format("%A, %B %-d, %Y").to_string()
}

#[tauri::command]
fn read_user_avatar(path: String) -> Option<String> {
    let data = std::fs::read(&path).ok()?;
    let ext = std::path::Path::new(&path)
        .extension().and_then(|e| e.to_str()).unwrap_or("png");
    let mime = match ext { "jpg"|"jpeg" => "image/jpeg", "svg" => "image/svg+xml", _ => "image/png" };
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(data);
    Some(format!("data:{};base64,{}", mime, b64))
}

fn main() {
    tracing_subscriber::fmt().with_max_level(tracing::Level::INFO).init();

    let state: ClientState = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            connect_daemon,
            get_sessions,
            get_users,
            authenticate,
            start_session,
            power_action,
            get_wallpaper,
            get_greeter_config,
            get_hostname,
            get_current_time,
            get_current_date,
            read_user_avatar,
        ])
        .run(tauri::generate_context!())
        .expect("BEDM greeter error");
}
