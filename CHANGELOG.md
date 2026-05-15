# Blue Environment — Changelog

## v0.5.0 (2026-05)

### Breaking: New installation paths
- Shell binary: `/usr/share/Blue-Environment/blue-environment`
- Compositor: `/usr/share/Blue-Environment/lib/blue-compositor`
- Addon apps: `/usr/share/Blue-Environment/apps/`
- Wallpapers: `/usr/share/Blue-Environment/wallpapers/` (also `/usr/share/wallpapers/`)
- User config stays in `~/.config/Blue-Environment/`

### New: Install script
- `sudo bash install.sh` — full system installation

### TerminalApp v0.5
- Real PTY via Tauri backend (`portable-pty`)
- True colors (TERM=xterm-256color, COLORTERM=truecolor)
- Tab management with independent PTY sessions
- 3 built-in themes: Blue Dark, Dracula, Solarized Dark
- Font size control in settings panel
- Fallback xterm.js emulator when Tauri unavailable
- Clean tab close with PTY cleanup

### SystemMonitorApp v0.5
- Historical charts with 60-second rolling window (Canvas sparklines)
- 3 tabs: Overview, Processes, Resources
- Kill process with single click
- Real-time process list from `/proc` filesystem
- CPU/RAM/Network/Disk I/O graphs
- Sortable process table by name/PID/CPU/memory
- Live badge updates

### BlueCodeApp v0.5
- **Git integration panel**: branch view, staged/unstaged changes
- Stage/unstage individual files, stage all
- Commit with message
- Push/pull with output
- Commit history (15 most recent)
- Inline diff view (color-coded +/-/@)
- Initialize new repositories

### SettingsApp v0.5
- **Monitors section**: xrandr/wlr-randr integration, scale (50%-300%), rotation, visual layout
- **Printers section**: CUPS integration, set default, remove, link to system-config-printer
- **Users & Groups section**: list system users, admin badge, change password, add user

### AboutApp v0.5
- Real hardware detection: CPU model from /proc/cpuinfo, RAM from /proc/meminfo
- GPU info via lspci, disk usage via df
- Architecture (uname -m), uptime calculation
- Redesigned with gradient hero, links to website/support/bug tracker
- User avatar with hostname

### Blue Launcher v0.5 (Crystal)
- New commands: `blue wallpaper list/set`, `blue compositor start/stop/restart/status`
- Permission-aware: warns when /usr/share/Blue-Environment not writable
- Suggests `sudo blue <command>` when needed
- Path info in `blue help` output

### Compositor (blue-compositor) v0.5
- Desktop files now written to `/usr/share/wayland-sessions/` (correct location)
- Application desktop file in `/usr/share/applications/`
- Version 0.5.0 in desktop file

### Infrastructure
- Tauri backend: `pty_create`, `pty_write`, `pty_resize`, `pty_close` commands
- Tauri backend: real `get_processes` from /proc filesystem
- `systemBridge.ts`: `getProcesses()` method, `BLUE_SHARE/BLUE_APPS/BLUE_LIBS/BLUE_WALLS` constants
- `SettingsSections.tsx`: MonitorsSection, PrintersSection, UsersSection components
- `GitPanel.tsx`: standalone reusable Git integration component

## v0.4.0 (2026-05)

### Compositor
- Production Smithay DRM/KMS + Winit (nested) + XWayland
- Layer Shell, xdg-activation, fractional-scale, viewporter
- IPC socket, VT switch via libseat
- Calloop version conflict resolved (smithay::reexports::calloop)

### Shell
- 4 virtual workspaces, PowerOverlay, LockScreen
- ErrorBoundary (app crashes isolated)
- App enable/disable in Settings
- TopBar, StartMenu, ControlCenter, NotificationCenter, ClipboardPanel

### Applications
- BlueAI (ChatGPT/Claude/Gemini/DeepSeek/Ollama/Grok)
- BlueCode (Monaco + xterm.js)
- TerminalApp (xterm.js multi-tab)
- MailApp (full client)
- SettingsApp, AboutApp, ExplorerApp, CalculatorApp (safe parser)
- SystemMonitorApp, NotepadApp, BlueSoftwareApp, BlueWebApp

### License
GNU GPL v3.0 — © 2026 HackerOS Team
