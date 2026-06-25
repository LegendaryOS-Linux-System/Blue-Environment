use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct ProcessEntry {
    pub pid: String,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
}

#[tauri::command]
pub fn get_processes() -> Vec<ProcessEntry> {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_processes();
    let mut procs: Vec<ProcessEntry> = sys.processes().iter().map(|(pid, p)| ProcessEntry {
        pid: pid.to_string(),
        name: p.name().to_string(),
        cpu: p.cpu_usage(),
        memory: p.memory(),
    }).collect();
    procs.sort_by(|a, b| b.memory.cmp(&a.memory));
    procs.truncate(100);
    procs
}
