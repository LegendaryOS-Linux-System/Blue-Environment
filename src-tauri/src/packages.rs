use crate::ai::PackageInfo;
use std::process::Command;

fn run(cmd: &str, args: &[&str]) -> String {
    Command::new(cmd).args(args)
    .output()
    .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
    .unwrap_or_default()
}

fn run_check(cmd: &str) -> bool {
    Command::new("which").arg(cmd).output()
    .map(|o| o.status.success())
    .unwrap_or(false)
}

fn get_apt_desc(pkg: &str) -> String {
    Command::new("apt-cache")
    .args(["show", pkg])
    .output()
    .map(|o| {
        let s = String::from_utf8_lossy(&o.stdout);
        s.lines()
        .skip_while(|l| !l.starts_with("Description"))
        .nth(1)
        .unwrap_or("")
        .trim()
        .to_string()
    })
    .unwrap_or_default()
}

pub fn get_apt_packages() -> Vec<PackageInfo> {
    if !run_check("dpkg-query") { return Vec::new(); }

    let mut packages = Vec::new();
    let installed_raw = run("dpkg-query", &["-W", "-f=${Package}|${Version}|${Status}\n"]);
    let mut installed: std::collections::HashMap<String, String> = Default::default();
    for line in installed_raw.lines() {
        let p: Vec<&str> = line.split('|').collect();
        if p.len() >= 3 && p[2].contains("installed") {
            installed.insert(p[0].to_string(), p[1].to_string());
        }
    }

    let upg_raw = Command::new("apt")
    .args(["list", "--upgradeable"])
    .output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    let upgradeable: std::collections::HashSet<String> = upg_raw.lines()
    .filter_map(|l| l.split('/').next())
    .map(String::from).collect();

    for (pkg, ver) in &installed {
        packages.push(PackageInfo {
            id: pkg.clone(), name: pkg.clone(),
                      description: get_apt_desc(pkg), version: ver.clone(),
                      source: "apt".to_string(), installed: true,
                      update_available: Some(upgradeable.contains(pkg.as_str())),
                      icon: None, size: None,
        });
    }
    packages.sort_by(|a, b| a.name.cmp(&b.name));
    packages
}

pub fn install_apt(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["apt-get","install","-y",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn remove_apt(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["apt-get","remove","-y",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn update_apt(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["apt-get","install","--only-upgrade","-y",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}

pub fn get_flatpak_packages() -> Vec<PackageInfo> {
    if !run_check("flatpak") { return Vec::new(); }
    let mut packages = Vec::new();
    let raw = run("flatpak", &["list","--app","--columns=application,name,version"]);
    let mut installed_ids: std::collections::HashSet<String> = Default::default();
    for line in raw.lines().skip(1) {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 { continue; }
        let id = cols[0].trim().to_string();
        installed_ids.insert(id.clone());
        packages.push(PackageInfo {
            id: id.clone(), name: cols[1].trim().to_string(),
                      description: format!("Flatpak: {}", id),
                      version: cols[2].trim().to_string(),
                      source: "flatpak".to_string(), installed: true,
                      update_available: None, icon: None, size: None,
        });
    }
    let search_raw = run("flatpak", &["search","--columns=application,name,description,version"]);
    for line in search_raw.lines().skip(1).take(20) {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 4 { continue; }
        let id = cols[0].trim().to_string();
        if installed_ids.contains(&id) { continue; }
        packages.push(PackageInfo {
            id: id.clone(), name: cols[1].trim().to_string(),
                      description: cols[2].trim().to_string(),
                      version: cols[3].trim().to_string(),
                      source: "flatpak".to_string(), installed: false,
                      update_available: None, icon: None, size: None,
        });
    }
    packages
}

pub fn install_flatpak(pkg_id: &str) -> bool {
    Command::new("flatpak").args(["install","--assumeyes","--user","flathub",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn remove_flatpak(pkg_id: &str) -> bool {
    Command::new("flatpak").args(["uninstall","--assumeyes","--user",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn update_flatpak(pkg_id: &str) -> bool {
    Command::new("flatpak").args(["update","--assumeyes","--user",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}

pub fn get_snap_packages() -> Vec<PackageInfo> {
    if !run_check("snap") { return Vec::new(); }
    let mut packages = Vec::new();
    let raw = run("snap", &["list"]);
    let mut installed: std::collections::HashSet<String> = Default::default();
    for line in raw.lines().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.is_empty() { continue; }
        let name = cols[0].to_string();
        installed.insert(name.clone());
        packages.push(PackageInfo {
            id: name.clone(), name: name.clone(),
                      description: format!("Snap: {}", name),
                      version: cols.get(1).map(|s| s.to_string()).unwrap_or_default(),
                      source: "snap".to_string(), installed: true,
                      update_available: None, icon: None, size: None,
        });
    }
    packages
}

pub fn install_snap(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["snap","install",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn remove_snap(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["snap","remove",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn update_snap(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["snap","refresh",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}

pub fn get_appimage_packages() -> Vec<PackageInfo> {
    let home = dirs::home_dir().unwrap_or_default();
    let app_dirs = [home.join("Applications"), home.join(".local/bin")];
    let mut packages = Vec::new();
    let mut seen: std::collections::HashSet<String> = Default::default();
    for dir in &app_dirs {
        let Ok(entries) = std::fs::read_dir(dir) else { continue; };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if !name.to_lowercase().ends_with(".appimage") || seen.contains(&name) { continue; }
            seen.insert(name.clone());
            let display = name.trim_end_matches(".AppImage").trim_end_matches(".appimage").to_string();
            let size = std::fs::metadata(&path).map(|m| format!("{:.1} MB", m.len() as f64 / 1_048_576.0)).ok();
            packages.push(PackageInfo {
                id: path.to_string_lossy().to_string(), name: display,
                          description: format!("AppImage: {}", name),
                          version: "local".to_string(), source: "appimage".to_string(),
                          installed: true, update_available: None, icon: None, size,
            });
        }
    }
    let known: &[(&str, &str, &str, &str)] = &[
        ("Obsidian",  "obsidian",  "Knowledge base & notes", "1.4.16"),
        ("Joplin",    "joplin",    "Open source note-taking","2.14.0"),
        ("Heroic",    "heroic",    "GOG and Epic launcher",  "2.9.0"),
        ("Zed",       "zed",       "High-performance editor","0.0.1"),
    ];
    for (name, id, desc, ver) in known {
        if seen.contains(&format!("{}.AppImage", name)) { continue; }
        packages.push(PackageInfo {
            id: id.to_string(), name: name.to_string(),
                      description: desc.to_string(), version: ver.to_string(),
                      source: "appimage".to_string(), installed: false,
                      update_available: None, icon: None, size: None,
        });
    }
    packages
}

pub fn install_appimage(pkg_id: &str) -> bool {
    if std::path::Path::new(pkg_id).exists() {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(pkg_id, std::fs::Permissions::from_mode(0o755));
        return true;
    }
    let _ = Command::new("xdg-open")
    .arg(format!("https://appimage.github.io/apps/{}/", pkg_id)).spawn();
    false
}
pub fn remove_appimage(pkg_id: &str) -> bool {
    std::path::Path::new(pkg_id).exists() && std::fs::remove_file(pkg_id).is_ok()
}
pub fn update_appimage(_pkg_id: &str) -> bool { false }
