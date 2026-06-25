use serde::Serialize;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use once_cell::sync::Lazy;

#[derive(Serialize)]
pub struct LspResult {
    pub success: bool,
    pub error: Option<String>,
}

struct LspProcess {
    child: std::process::Child,
}

static LSP_PROCESSES: Lazy<Mutex<HashMap<String, LspProcess>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn lsp_binary_for(language: &str) -> Option<(&'static str, Vec<&'static str>)> {
    match language {
        "typescript" | "javascript" => Some(("typescript-language-server", vec!["--stdio"])),
        "rust"                       => Some(("rust-analyzer", vec![])),
        "python"                     => Some(("pylsp", vec![])),
        "go"                         => Some(("gopls", vec!["serve"])),
        "cpp" | "c"                  => Some(("clangd", vec![])),
        _ => None,
    }
}

fn binary_exists(bin: &str) -> bool {
    Command::new("which").arg(bin).output().map(|o| o.status.success()).unwrap_or(false)
}

#[tauri::command]
pub fn start_language_server(language: String, root_path: String) -> LspResult {
    let key = format!("{}::{}", language, root_path);

    if LSP_PROCESSES.lock().unwrap().contains_key(&key) {
        return LspResult { success: true, error: None };
    }

    let Some((bin, args)) = lsp_binary_for(&language) else {
        return LspResult { success: false, error: Some(format!("No LSP mapping for language '{}'", language)) };
    };

    if !binary_exists(bin) {
        return LspResult {
            success: false,
            error: Some(format!("'{}' not found on PATH — install it to enable {} IntelliSense", bin, language)),
        };
    }

    match Command::new(bin)
        .args(&args)
        .current_dir(&root_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => {
            LSP_PROCESSES.lock().unwrap().insert(key, LspProcess { child });
            LspResult { success: true, error: None }
        }
        Err(e) => LspResult { success: false, error: Some(format!("Failed to spawn {}: {}", bin, e)) },
    }
}

#[tauri::command]
pub fn stop_language_server(language: String, root_path: String) -> bool {
    let key = format!("{}::{}", language, root_path);
    if let Some(mut proc) = LSP_PROCESSES.lock().unwrap().remove(&key) {
        let _ = proc.child.kill();
        true
    } else {
        false
    }
}
