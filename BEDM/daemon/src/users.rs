use crate::{ipc::UserInfo, DaemonState};
use std::{fs, sync::Arc};
use tokio::sync::Mutex;
use tracing::warn;

pub async fn list_users(state: &Arc<Mutex<DaemonState>>) -> Vec<UserInfo> {
    let (min_uid, max_uid) = {
        let st = state.lock().await;
        (st.config.minimum_uid.unwrap_or(1000), st.config.maximum_uid.unwrap_or(65533))
    };

    let passwd = match fs::read_to_string("/etc/passwd") {
        Ok(c) => c,
        Err(e) => { warn!("Cannot read /etc/passwd: {}", e); return Vec::new(); }
    };

    let mut users: Vec<UserInfo> = passwd.lines().filter_map(|line| {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() < 7 { return None; }
        let username = parts[0].to_string();
        let uid: u32 = parts[2].parse().ok()?;
        let home = parts[5].to_string();
        let shell = parts[6].trim().to_string();
        let gecos = parts[4].to_string();

        if uid < min_uid || uid > max_uid { return None; }
        if shell.ends_with("nologin") || shell.ends_with("false") { return None; }

        let realname = gecos.split(',').next().unwrap_or(&username).to_string();
        let realname = if realname.is_empty() { username.clone() } else { realname };
        let icon_path = find_user_icon(&username, &home);
        let last_session = read_last_session(&username);

        Some(UserInfo { username, realname, uid, home, shell, icon_path, last_session })
    }).collect();

    users.sort_by(|a, b| a.username.cmp(&b.username));
    users
}

fn find_user_icon(username: &str, home: &str) -> Option<String> {
    let candidates = [
        format!("{home}/.face"),
        format!("{home}/.face.icon"),
        format!("{home}/.config/bedm/avatar.png"),
        format!("/var/lib/AccountsService/icons/{username}"),
        format!("/usr/share/pixmaps/faces/{username}.png"),
    ];
    candidates.iter().find(|p| std::path::Path::new(*p).exists()).cloned()
}

fn read_last_session(username: &str) -> Option<String> {
    let path = format!("/var/lib/bedm/users/{}/last_session", username);
    fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
}

pub fn save_last_session(username: &str, session: &str) {
    let dir = format!("/var/lib/bedm/users/{}", username);
    let _ = fs::create_dir_all(&dir);
    let _ = fs::write(format!("{}/last_session", dir), session);
}
