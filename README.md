# ![Blue Enviroment - Graphical environment for LegendaryOS.](https://github.com/LegendaryOS-Linux-System/Blue-Environment/blob/main/images/banner.png)
# Blue Environment v0.6

Production-grade Wayland desktop environment for HackerOS Linux. Using in LegendaryOS Blue.

## Build Instructions

### Prerequisites

```bash
# System packages (Debian/Ubuntu/HackerOS)
sudo apt install \
    build-essential curl git \
    libssl-dev libgbm-dev libseat-dev \
    libinput-dev libxkbcommon-dev \
    libudev-dev libdrm-dev \
    libgtk-3-dev libwebkit2gtk-4.0-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev pkg-config \
    seatd wmctrl xdotool

# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs

# Rust stable
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Tauri CLI v1
cargo install tauri-cli --version "^1"

# Enable seatd (needed for DRM/bare-metal mode)
sudo systemctl enable --now seatd
sudo usermod -aG seat $USER
# (re-login after this)
```

### Build the frontend + Tauri shell (the main app)

```bash
npm install
npm run build:tauri
# This runs: npm run build  →  vite build  →  tauri build
```

### Build the Wayland compositor (for bare-metal/TTY use)

```bash
npm run build:compositor
# Output: ~/.hackeros/Blue-Environment/libs/blue-compositor
```

### Build everything

```bash
npm run build:all
```

### Development (hot-reload)

```bash
npm run dev          # Start Vite dev server on :1420
cargo tauri dev      # Or: npm run tauri -- dev
```

## How the build works

```
npm run build:tauri
  └─ tauri build
       ├─ beforeBuildCommand: "npm run build"
       │     ├─ tsc --noEmit   (type-check)
       │     └─ vite build     → dist/
       └─ cargo build (src-tauri/)  → blue-environment binary
```

The key insight: **`tauri build` calls `npm run build` automatically** via
`beforeBuildCommand` in `tauri.conf.json`. You should NOT call
`npm run build` manually before `npm run build:tauri`.

## Project layout

```
blue-environment/
├── index.html                     ← entry HTML (project root)
├── src/                           ← TypeScript/React frontend
│   ├── App.tsx                    ← Desktop shell
│   ├── constants.tsx              ← App registry
│   ├── types.ts                   ← All TypeScript types
│   ├── vite.config.ts             ← Vite config (root = ..)
│   ├── tsconfig.json
│   ├── index.tsx                  ← React entry point
│   ├── components/
│   │   ├── Window.tsx
│   │   ├── TopBar.tsx
│   │   ├── StartMenu.tsx
│   │   ├── ControlCenter.tsx
│   │   ├── NotificationCenter.tsx
│   │   ├── WindowSwitcher.tsx
│   │   ├── WorkspaceSwitcher.tsx
│   │   ├── ClipboardPanel.tsx
│   │   ├── ToastContainer.tsx
│   │   └── apps/
│   │       ├── BlueAI.tsx
│   │       ├── BlueCodeApp.tsx    ← Monaco + xterm
│   │       ├── BlueSoftwareApp.tsx
│   │       ├── BlueWebApp.tsx
│   │       ├── ExplorerApp.tsx
│   │       ├── MailApp.tsx        ← Full mail client
│   │       ├── SettingsApp.tsx    ← Full settings
│   │       ├── TerminalApp.tsx
│   │       ├── SystemMonitorApp.tsx
│   │       ├── NotepadApp.tsx
│   │       ├── CalculatorApp.tsx
│   │       ├── AboutApp.tsx
│   │       └── MailApp.tsx
│   ├── hooks/
│   │   ├── useWindowManager.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── utils/
│   │   ├── systemBridge.ts        ← Tauri IPC bridge
│   │   ├── configStore.ts         ← Reactive config (wallpaper etc.)
│   │   └── notificationManager.ts
│   └── contexts/
│       └── LanguageContext.tsx
├── src-tauri/                     ← Rust/Tauri backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/icon.png
│   └── src/
│       ├── main.rs                ← Tauri commands
│       ├── ai.rs                  ← AI API proxy
│       ├── apps.rs                ← .desktop scanner
│       ├── cache.rs               ← Config/cache
│       ├── session.rs             ← Session detection
│       └── window_tracker.rs     ← External windows
└── src-tauri/lib/blue-compositor/ ← Smithay compositor
    ├── Cargo.toml
    └── src/
        ├── main.rs
        ├── state.rs
        ├── input.rs
        ├── render.rs
        ├── xwayland.rs
        └── ipc.rs
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Super` | Toggle Start Menu |
| `Super+Tab` | Full-screen App Picker |
| `Super+1–4` | Switch Workspace |
| `Super+←/→` | Switch Workspace |
| `Super+↑` | Maximize Window |
| `Super+↓` | Minimize Window |
| `Super+D` | Show Desktop |
| `Super+L` | Lock Screen |
| `Alt+Tab` | Window Switcher |
| `Alt+Shift+Tab` | Window Switcher (backwards) |
| `Alt+F4` | Close Window |
| `Ctrl+Alt+T` | Open Terminal |
| `Ctrl+Alt+C` | Control Center |
| `Ctrl+Shift+V` | Clipboard History |
| `PrintScreen` | Screenshot |
| `Escape` | Close Panels / Cancel |

## VM / VirtualBox Support

When running inside VirtualBox or any VM:
- Compositor auto-detects `WAYLAND_DISPLAY`/`DISPLAY` → uses **winit** (nested) backend
- Full 3D rendering via host GPU
- XWayland started automatically for X11 app support

On bare metal (TTY, no display server):
- Uses **DRM/KMS** backend via libseat
- Requires seatd running and user in `seat` group

## Common Issues

### "Unable to find your web assets"
This means `npm run build` was not run before `tauri build`.
**Solution:** Always use `npm run build:tauri` (not `npm run tauri`).
The `beforeBuildCommand` in `tauri.conf.json` handles this automatically.

### chrono feature error
Ensure `Cargo.toml` has `chrono = "0.4"` (no features).
The `local-offset` feature does not exist in chrono 0.4.x.

### seatd / seat permission error
```bash
sudo systemctl enable --now seatd
sudo usermod -aG seat $USER
# Then re-login
```

© 2026 LegendaryOS Team
