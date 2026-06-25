use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub fn take_screenshot() -> String {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let pics = home.join("Pictures").join("Screenshots");
    let _ = fs::create_dir_all(&pics);
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let path = pics.join(format!("screenshot-{}.png", ts)).to_string_lossy().to_string();
    // Try Wayland/X11 tools in order of preference: grim (Wayland),
    // import from ImageMagick (X11), scrot (X11), flameshot, spectacle.
    let cmd = format!(
        "grim '{p}' 2>/dev/null || import -window root '{p}' 2>/dev/null || \
         scrot '{p}' 2>/dev/null || flameshot full -p '{p}' 2>/dev/null || \
         spectacle -b -o '{p}' 2>/dev/null",
        p = path
    );
    match Command::new("sh").arg("-c").arg(&cmd).status() {
        Ok(s) if s.success() => path,
        _ => String::new(),
    }
}
