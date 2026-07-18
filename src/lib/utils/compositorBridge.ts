let realInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

async function ensureInvoke(): Promise<void> {
    if (realInvoke) return;
    try {
        const core = await import('@tauri-apps/api/core');
        realInvoke = core.invoke;
    } catch {
        // Not in Tauri — no-op stub
        realInvoke = async () => ({ success: true });
    }
}
ensureInvoke();

async function invoke<T = any>(cmd: string, args?: any): Promise<T> {
    await ensureInvoke();
    return realInvoke!(cmd, args);
}

// Listen helper — only works inside Tauri; silently ignored in browser
async function listen(event: string, cb: (payload: any) => void): Promise<() => void> {
    try {
        const mod = await import('@tauri-apps/api/event');
        const unlisten = await mod.listen(event, (e: any) => cb(e.payload));
        return unlisten;
    } catch {
        return () => {};
    }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface WindowInfo {
    id:            number;
    title:         string;
    app_id:        string;
    x:             number;
    y:             number;
    width:         number;
    height:        number;
    is_fullscreen: boolean;
    is_minimized:  boolean;
    workspace:     number;
}

// ── Send helper ────────────────────────────────────────────────────────────

async function send(type: string, payload: Record<string, unknown> = {}): Promise<boolean> {
    try {
        const result = await invoke<{ success: boolean }>('settings_send_to_compositor', {
            command: { type, ...payload },
        });
        return result.success;
    } catch (e) {
        console.warn('[compositorBridge] send error:', e);
        return false;
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

export const CompositorBridge = {
    focusWindow:            (id: number)                                      => send('focus_window', { id }),
    closeWindow:            (id: number)                                      => send('close_window', { id }),
    killWindow:             (id: number)                                      => send('kill_window',  { id }),
    toggleMaximize:         (id: number)                                      => send('toggle_maximize', { id }),
    minimizeWindow:         (id: number)                                      => send('minimize_window', { id }),
    restoreWindow:          (id: number)                                      => send('restore_window', { id }),
    setFullscreen:          (id: number, fullscreen: boolean)                 => send('set_fullscreen', { id, fullscreen }),
    tileWindow:             (id: number, position: 'left'|'right'|'full'|'restore') => send('tile_window', { id, position }),
    moveWindowToWorkspace:  (id: number, workspace: number)                   => send('move_window_to_workspace', { id, workspace }),
    switchWorkspace:        (index: number)                                   => send('switch_workspace', { index }),
    setWorkspaceCount:      (count: number)                                   => send('set_workspace_count', { count }),
    setDpmsTimeout:         (seconds: number)                                 => send('set_dpms_timeout', { seconds }),
    lockScreen:             ()                                                => send('lock_screen'),
    takeScreenshot:         (path: string, mode: 'full'|'focused' = 'full')  => send('take_screenshot', { path, mode }),
    setKeyboardLayout:      (layout: string, variant?: string)                => send('set_keyboard_layout', { layout, variant: variant ?? null }),
    setCursor:              (theme: string, size: number)                     => send('set_cursor', { theme, size }),
    reloadConfig:           ()                                                => send('reload_config'),
    getWindowList:          ()                                                => send('get_window_list'),

    onWindowList:           (cb: (windows: WindowInfo[]) => void)            => listen('compositor:window-list', d => cb(d.windows)),
    onWindowFocused:        (cb: (id: number) => void)                       => listen('compositor:window-focused', d => cb(d.id)),
    onWindowOpened:         (cb: (w: WindowInfo) => void)                    => listen('compositor:window-opened', d => cb(d.window)),
    onWindowClosed:         (cb: (id: number) => void)                       => listen('compositor:window-closed', d => cb(d.id)),
    onWorkspaceSwitched:    (cb: (index: number, count: number) => void)     => listen('compositor:workspace-switched', d => cb(d.index, d.count)),
    onToggleStartMenu:      (cb: () => void)                                 => listen('compositor:toggle-start-menu', () => cb()),
    onIdleChanged:          (cb: (idle: boolean) => void)                    => listen('compositor:idle-changed', d => cb(d.idle)),
    onScreenshotReady:      (cb: (path: string) => void)                     => listen('compositor:screenshot-ready', d => cb(d.path)),
};

export default CompositorBridge;
