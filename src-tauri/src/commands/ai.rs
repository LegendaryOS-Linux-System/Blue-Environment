use crate::types::*;
use crate::{apps, cache, ai, packages, window_tracker};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tokio::process::Command as TokioCommand;
use serde::{Serialize, Deserialize};

#[tauri::command]
pub async fn ai_call(request: ai::AICallRequest) -> Result<String, String> {
    ai::ai_call(request).await
}

#[tauri::command]
pub async fn get_ai_config() -> Result<Option<ai::AIConfig>, String> {
    let path = dirs::home_dir().unwrap_or(PathBuf::from("/tmp")).join(".config/Blue-Environment/ai_config.json");
    Ok(fs::read_to_string(&path).ok().and_then(|s| serde_json::from_str::<ai::AIConfig>(&s).ok()))
}

#[tauri::command]
pub async fn save_ai_config(config: ai::AIConfig) -> Result<(), String> {
    let path = dirs::home_dir().unwrap_or(PathBuf::from("/tmp")).join(".config/Blue-Environment/ai_config.json");
    fs::write(path, serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
