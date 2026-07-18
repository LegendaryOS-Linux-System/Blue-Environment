use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::Emitter;

#[derive(Serialize, Clone)]
pub struct InstallerDisk {
    pub path: String,
    pub model: String,
    pub size_bytes: u64,
    pub removable: bool,
}

#[tauri::command]
pub async fn installer_list_disks() -> Result<Vec<InstallerDisk>, String> {
    let output = Command::new("lsblk")
        .args(["-d", "-b", "-o", "NAME,SIZE,MODEL,RM,TYPE", "-J"])
        .output()
        .map_err(|e| format!("lsblk failed: {e}"))?;

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse lsblk output: {e}"))?;

    let devices = json["blockdevices"].as_array().cloned().unwrap_or_default();
    let disks = devices
        .into_iter()
        .filter(|d| d["type"].as_str() == Some("disk"))
        .map(|d| InstallerDisk {
            path: format!("/dev/{}", d["name"].as_str().unwrap_or("")),
            model: d["model"].as_str().unwrap_or("Unknown disk").trim().to_string(),
            size_bytes: d["size"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0),
            removable: matches!(d["rm"].as_str(), Some("1")) || d["rm"].as_bool().unwrap_or(false),
        })
        .collect();

    Ok(disks)
}

/// `args` is the pre-built, already-quoted argument string from
/// installState.ts's startInstall() (everything except the password, which
/// is piped separately over stdin so it never appears in `ps`/process
/// listings or shell history).
#[tauri::command]
pub async fn installer_run(app: tauri::AppHandle, args: String, password: String) -> Result<(), String> {
    let script_path = std::env::var("BLUE_INSTALLER_SCRIPT")
        .unwrap_or_else(|_| "/usr/share/Blue-Environment/installer/blue-installer-apply.sh".to_string());

    if !std::path::Path::new(&script_path).exists() {
        return Err(format!(
            "Installer script not found at {script_path}. This is expected in a dev build — \
             it ships at that path from the `installer/` directory when packaged (see build.rb)."
        ));
    }

    let full_cmd = format!("{script_path} {args}");

    let mut child = Command::new("pkexec")
        .arg("sh").arg("-c").arg(&full_cmd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to launch installer (pkexec): {e}"))?;

    // Password goes to the script's `read -r -s PASSWORD` step, never as a
    // CLI argument.
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let _ = writeln!(stdin, "{password}");
    }

    let stdout = child.stdout.take().ok_or("Failed to capture installer stdout")?;
    let app_for_thread = app.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            // Script emits lines like: PROGRESS 42 Copying system files…
            if let Some(rest) = line.strip_prefix("PROGRESS ") {
                let mut parts = rest.splitn(2, ' ');
                let pct: u8 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
                let label = parts.next().unwrap_or("").to_string();
                let _ = app_for_thread.emit("installer-progress", serde_json::json!({
                    "pct": pct, "label": label, "line": line.clone(),
                }));
            } else {
                let _ = app_for_thread.emit("installer-progress", serde_json::json!({
                    "pct": -1, "label": serde_json::Value::Null, "line": line,
                }));
            }
        }
    });

    Ok(())
}
