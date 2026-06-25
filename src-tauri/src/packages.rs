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

/// Resolves a package/app id to an icon via the shared FreeDesktop icon
/// theme resolver (linicon — see icon_resolver.rs), preferring Papirus.
/// Most distro packages ship a .desktop file whose Icon= matches the
/// package name closely enough for this to work directly; this is a
/// best-effort lookup and simply returns None when nothing matches
/// rather than fabricating a path, so the frontend correctly falls back
/// to its generic package icon.
fn icon_for_package(name: &str) -> Option<String> {
    let resolved = crate::icon_resolver::resolve_icon(name);
    if resolved.is_empty() { None } else { Some(resolved) }
}

/// Formats a size given in raw bytes (the unit rpm's %{SIZE} tag
/// reports) as a human-readable MB/GB string.
fn format_bytes(size_bytes: u64) -> Option<String> {
    if size_bytes == 0 { return None; }
    let mb = size_bytes as f64 / 1_048_576.0;
    Some(if mb >= 1024.0 {
        format!("{:.2} GB", mb / 1024.0)
    } else {
        format!("{:.1} MB", mb)
    })
}

/// A small set of popular GUI application names used to seed the
/// "Available" tab with real, live-queried dnf results. This is a list
/// of *search terms* only — every field actually shown for each result
/// (description, version, size...) comes straight from a live `dnf`
/// query against the system's real configured repos, never fabricated.
/// This mirrors how GNOME Software / Discover show "Featured/Popular"
/// sections: curated discovery, backed entirely by real package data.
const POPULAR_APPS: &[&str] = &[
    "firefox", "vlc", "gimp", "libreoffice-writer", "blender", "inkscape",
    "audacity", "thunderbird", "krita", "obs-studio", "code", "transmission-gtk",
    "kdenlive", "shotwell", "rhythmbox", "stellarium",
];

pub fn get_dnf_packages() -> Vec<PackageInfo> {
    if !run_check("rpm") { return Vec::new(); }

    let mut packages = Vec::new();
    let mut installed_names: std::collections::HashSet<String> = Default::default();

    // `rpm -qa` reads directly from the local RPM database and returns
    // instantly — much faster than `dnf list installed`, which has to
    // spin up dnf's Python startup and metadata machinery for the same
    // information.
    let raw = run("rpm", &["-qa", "--queryformat", "%{NAME}|%{VERSION}-%{RELEASE}|%{SUMMARY}|%{SIZE}\n"]);
    for line in raw.lines() {
        let p: Vec<&str> = line.splitn(4, '|').collect();
        if p.len() < 4 { continue; }
        let name = p[0].to_string();
        installed_names.insert(name.clone());
        let size_bytes: u64 = p[3].trim().parse().unwrap_or(0);
        packages.push(PackageInfo {
            id: name.clone(), name: name.clone(),
                      description: p[2].trim().to_string(),
                      version: p[1].trim().to_string(),
                      source: "dnf".to_string(), installed: true,
                      update_available: None, // filled in below
                      icon: icon_for_package(&name),
                      size: format_bytes(size_bytes),
        });
    }

    // Determine which installed packages have an update available.
    // `dnf check-update` exits with status 100 (not 0) when updates ARE
    // available, so we read its stdout directly via run() rather than
    // gating on exit status.
    let upg_raw = run("dnf", &["check-update", "--quiet"]);
    let upgradeable: std::collections::HashSet<String> = upg_raw.lines()
    .filter_map(|l| l.split_whitespace().next())
    .filter(|s| !s.is_empty())
    .filter_map(|pkg_arch| pkg_arch.rsplit_once('.').map(|(n, _)| n.to_string()))
    .collect();
    for pkg in packages.iter_mut() {
        pkg.update_available = Some(upgradeable.contains(&pkg.id));
    }

    // "Available" tab content — a single `dnf repoquery` call covering
    // every popular-app search term at once (much faster than one
    // invocation per term, since each dnf process spin-up has real
    // overhead). Every returned field is live data from the system's
    // actual repos, not invented.
    if run_check("dnf") {
        let mut args = vec!["repoquery", "--quiet", "--qf", "%{name}|%{summary}|%{version}"];
        args.extend_from_slice(POPULAR_APPS);
        let repoquery_out = run("dnf", &args);
        let mut seen_available: std::collections::HashSet<String> = Default::default();
        for line in repoquery_out.lines() {
            let p: Vec<&str> = line.splitn(3, '|').collect();
            if p.len() < 3 { continue; }
            let name = p[0].trim().to_string();
            if name.is_empty() || installed_names.contains(&name) || seen_available.contains(&name) { continue; }
            seen_available.insert(name.clone());
            packages.push(PackageInfo {
                id: name.clone(), name: name.clone(),
                          description: p[1].trim().to_string(),
                          version: p[2].trim().to_string(),
                          source: "dnf".to_string(), installed: false,
                          update_available: None,
                          icon: icon_for_package(&name), size: None,
            });
        }
    }

    packages.sort_by(|a, b| a.name.cmp(&b.name));
    packages
}

pub fn install_dnf(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["dnf","install","-y",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn remove_dnf(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["dnf","remove","-y",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}
pub fn update_dnf(pkg_id: &str) -> bool {
    Command::new("pkexec").args(["dnf","upgrade","-y",pkg_id])
    .status().map(|s| s.success()).unwrap_or(false)
}

pub fn get_flatpak_packages() -> Vec<PackageInfo> {
    if !run_check("flatpak") { return Vec::new(); }
    let mut packages = Vec::new();

    // Older flatpak versions (<1.4) don't recognize the "size" column and
    // would error out entirely, silently returning zero installed apps.
    // Try the richer query first and fall back to the basic one if it
    // doesn't look like it actually returned package rows.
    let mut raw = run("flatpak", &["list","--app","--columns=application,name,version,size"]);
    let has_size_col = raw.lines().skip(1).any(|l| l.split('\t').count() >= 4);
    if !has_size_col {
        raw = run("flatpak", &["list","--app","--columns=application,name,version"]);
    }

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
                      update_available: None,
                      // Flatpak exports each app's icon into the user's
                      // icon theme directories under its full reverse-DNS
                      // application id, so looking that id up directly
                      // through the shared theme resolver finds it.
                      icon: icon_for_package(&id),
                      size: cols.get(3).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
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
                      update_available: None, icon: icon_for_package(&id), size: None,
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

pub fn get_appimage_packages() -> Vec<PackageInfo> {
    let home = dirs::home_dir().unwrap_or_default();
    let app_dirs = [home.join("Applications"), home.join(".local/bin"), home.join("Downloads")];
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
                id: path.to_string_lossy().to_string(), name: display.clone(),
                          description: format!("AppImage: {}", name),
                          version: "local".to_string(), source: "appimage".to_string(),
                          installed: true, update_available: None,
                          icon: icon_for_package(&display.to_lowercase()), size,
            });
        }
    }
    // AppImages have no centralized installable catalog the way apt /
    // flatpak / snap do (there is no "apt search"-equivalent query we can
    // run against a real index), so unlike the other three sources there
    // is no "Available" listing here — only what's genuinely found on
    // disk above. A previous version of this function filled that gap
    // with a hardcoded list of made-up app names and version numbers,
    // which is exactly the kind of placeholder data Blue Software must
    // never show.
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
