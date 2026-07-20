use serde::Serialize;
use std::process::Command;

/// One row in the partition table view — either a whole disk (`kind ==
/// "disk"`) or a partition/child device nested under one. Mirrors the shape
/// `lsblk -J` returns so we don't have to invent our own device model.
#[derive(Serialize, Clone, Debug)]
pub struct BpmDevice {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub size_bytes: u64,
    pub fstype: Option<String>,
    pub label: Option<String>,
    pub mountpoint: Option<String>,
    pub model: Option<String>,
    pub uuid: Option<String>,
    pub removable: bool,
    pub read_only: bool,
    pub children: Vec<BpmDevice>,
}

fn parse_size(v: &serde_json::Value) -> u64 {
    // lsblk -b prints SIZE as a bare integer string when -J/-b are combined,
    // but some distros' util-linux builds still quote it — accept both.
    v.as_u64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .unwrap_or(0)
}

fn parse_bool_field(v: &serde_json::Value) -> bool {
    matches!(v.as_str(), Some("1")) || v.as_bool().unwrap_or(false)
}

fn parse_device(v: &serde_json::Value) -> BpmDevice {
    let name = v["name"].as_str().unwrap_or("").to_string();
    let children = v["children"]
        .as_array()
        .map(|arr| arr.iter().map(parse_device).collect())
        .unwrap_or_default();

    BpmDevice {
        path: format!("/dev/{name}"),
        name,
        kind: v["type"].as_str().unwrap_or("part").to_string(),
        size_bytes: parse_size(&v["size"]),
        fstype: v["fstype"].as_str().filter(|s| !s.is_empty()).map(String::from),
        label: v["label"].as_str().filter(|s| !s.is_empty()).map(String::from),
        mountpoint: v["mountpoint"].as_str().filter(|s| !s.is_empty()).map(String::from),
        model: v["model"].as_str().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        uuid: v["uuid"].as_str().filter(|s| !s.is_empty()).map(String::from),
        removable: parse_bool_field(&v["rm"]),
        read_only: parse_bool_field(&v["ro"]),
        children,
    }
}

/// Lists every block device (disks + their partitions, nested) using
/// `lsblk`, the same source of truth Blue Installer already relies on for
/// disk detection — see BlueInstallerApp::installer_list_disks.
#[tauri::command]
pub async fn bpm_list_devices() -> Result<Vec<BpmDevice>, String> {
    let output = Command::new("lsblk")
        .args(["-b", "-J", "-o", "NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINT,MODEL,UUID,RM,RO"])
        .output()
        .map_err(|e| format!("lsblk failed to start: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "lsblk exited with an error: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse lsblk output: {e}"))?;

    let devices = json["blockdevices"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(parse_device)
        // Only show real disks/loop/rom devices at the top level; their
        // partitions already come through as `children`.
        .filter(|d| matches!(d.kind.as_str(), "disk" | "loop" | "rom"))
        .collect();

    Ok(devices)
}

/// Mounts a partition through udisks2 (no root required for removable /
/// user-owned media — this is the same mechanism GNOME Files & Dolphin use).
#[tauri::command]
pub async fn bpm_mount(device: String) -> Result<String, String> {
    let output = Command::new("udisksctl")
        .args(["mount", "-b", &device])
        .output()
        .map_err(|e| format!("Failed to launch udisksctl: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Unmounts a partition through udisks2.
#[tauri::command]
pub async fn bpm_unmount(device: String) -> Result<(), String> {
    let output = Command::new("udisksctl")
        .args(["unmount", "-b", &device])
        .output()
        .map_err(|e| format!("Failed to launch udisksctl: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}

/// Formats a partition. Destructive and privileged, so it goes through
/// `pkexec` for a real authentication prompt — same pattern as
/// `installer_run` in BlueInstallerApp. `label` is optional.
#[tauri::command]
pub async fn bpm_format(device: String, fstype: String, label: Option<String>) -> Result<(), String> {
    let mkfs_bin = match fstype.as_str() {
        "ext4" => "mkfs.ext4",
        "btrfs" => "mkfs.btrfs",
        "xfs" => "mkfs.xfs",
        "fat32" | "vfat" => "mkfs.vfat",
        "ntfs" => "mkfs.ntfs",
        "swap" => "mkswap",
        other => return Err(format!("Unsupported filesystem: {other}")),
    };

    let mut args: Vec<String> = Vec::new();
    if let Some(l) = label.filter(|l| !l.is_empty()) {
        match fstype.as_str() {
            "ext4" | "btrfs" | "swap" => { args.push("-L".into()); args.push(l); }
            "xfs" => { args.push("-L".into()); args.push(l); }
            "fat32" | "vfat" => { args.push("-n".into()); args.push(l); }
            "ntfs" => { args.push("-L".into()); args.push(l); }
            _ => {}
        }
    }
    if fstype == "fat32" || fstype == "vfat" { args.push("-F".into()); args.push("32".into()); }
    if matches!(fstype.as_str(), "ext4" | "xfs" | "vfat" | "fat32" | "ntfs") { args.push("-f".into()); }
    args.push(device.clone());

    let output = Command::new("pkexec")
        .arg(mkfs_bin)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to launch pkexec/{mkfs_bin}: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}

/// Renames the filesystem label of an already-formatted partition.
#[tauri::command]
pub async fn bpm_set_label(device: String, fstype: String, label: String) -> Result<(), String> {
    let (bin, args): (&str, Vec<String>) = match fstype.as_str() {
        "ext4" => ("e2label", vec![device.clone(), label]),
        "btrfs" => ("btrfs", vec!["filesystem".into(), "label".into(), device.clone(), label]),
        "xfs" => ("xfs_admin", vec!["-L".into(), label, device.clone()]),
        "fat32" | "vfat" => ("fatlabel", vec![device.clone(), label]),
        "ntfs" => ("ntfslabel", vec![device.clone(), label]),
        other => return Err(format!("Relabeling {other} is not supported")),
    };

    let output = Command::new("pkexec")
        .arg(bin)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to launch pkexec/{bin}: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(())
}
