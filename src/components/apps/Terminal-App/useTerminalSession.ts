import { useCallback, useEffect, useRef, useState } from 'react';
import { THEMES, ThemeName, Tab } from './themes';
import { isTauriEnv, tauriInvoke, tauriListen } from './tauriBridge';
import { loadXterm, getXtermClasses } from './xtermLoader';

export function useTerminalSession() {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [themeName, setThemeName] = useState<ThemeName>('Blue Dark');
    const [fontSize, setFontSize] = useState(14);
    const [loaded, setLoaded] = useState(false);
    const termRefs = useRef<Map<string, any>>(new Map());
    const unlistenRefs = useRef<Map<string, (() => void)[]>>(new Map());

    useEffect(() => {
        loadXterm().finally(() => setLoaded(true));
    }, []);

    const newTab = useCallback(async () => {
        const id = `tab-${Date.now()}`;
        setTabs(prev => [...prev, { id, title: 'Terminal' }]);
        setActiveTab(id);
    }, []);

    const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (isTauriEnv()) {
            tauriInvoke('pty_close', { id }).catch(() => {});
        }
        const unlisteners = unlistenRefs.current.get(id) || [];
        unlisteners.forEach(fn => fn());
        unlistenRefs.current.delete(id);

        const ref = termRefs.current.get(id);
        if (ref?.term) ref.term.dispose();
        termRefs.current.delete(id);

        setTabs(prev => {
            const next = prev.filter(t => t.id !== id);
            setActiveTab(curr => curr === id ? (next[next.length - 1]?.id || null) : curr);
            return next;
        });
    }, []);

    const startFallbackMode = (term: any, id: string) => {
        const useTauri = isTauriEnv();
        term.write('\x1b[32mBlue Terminal\x1b[0m\r\n');
        if (useTauri) {
            term.write('\x1b[33mℹ PTY unavailable — using execute_command fallback\x1b[0m\r\n');
        }

        let line = '';
        let cwd = '~';
        const prompt = () => term.write(`\r\n\x1b[36m${cwd}\x1b[0m \x1b[32m$\x1b[0m `);

        const run = async (cmd: string) => {
            const trimmed = cmd.trim();
            if (!trimmed) { prompt(); return; }

            if (trimmed === 'clear') { term.clear(); prompt(); return; }
            if (trimmed.startsWith('cd ')) {
                const dir = trimmed.slice(3).trim();
                cwd = dir === '~' ? '~' : dir;
                prompt(); return;
            }

            if (useTauri) {
                try {
                    const result = await tauriInvoke('execute_command', { command: trimmed });
                    if (result?.stdout) term.write('\r\n' + result.stdout.replace(/\n/g, '\r\n'));
                    if (result?.stderr) term.write('\r\n\x1b[31m' + result.stderr.replace(/\n/g, '\r\n') + '\x1b[0m');
                } catch (e) {
                    term.write(`\r\n\x1b[31mError: ${e}\x1b[0m`);
                }
            } else {
                term.write(`\r\n\x1b[2m[No backend — cannot run: ${trimmed}]\x1b[0m`);
            }
            prompt();
        };

        prompt();

        term.onKey(({ key, domEvent }: any) => {
            const code = domEvent.keyCode;
            if (code === 13) {
                run(line);
                line = '';
            } else if (code === 8) {
                if (line.length > 0) { line = line.slice(0, -1); term.write('\b \b'); }
            } else if (key.charCodeAt(0) >= 32) {
                line += key; term.write(key);
            }
        });
    };

    const initTerminal = useCallback((id: string, container: HTMLDivElement | null) => {
        const { Terminal, FitAddon, WebLinksAddon } = getXtermClasses();
        if (!container || !loaded || !Terminal || termRefs.current.get(id)?.term) return;

        const theme = THEMES[themeName];
        const term = new Terminal({
            theme, fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            cursorBlink: true, scrollback: 10000,
            allowTransparency: false, bellStyle: 'none', convertEol: true,
        });

        const fitAddon = FitAddon ? new FitAddon() : null;
        if (fitAddon) term.loadAddon(fitAddon);
        if (WebLinksAddon) term.loadAddon(new WebLinksAddon());
        term.open(container);
        fitAddon?.fit();
        termRefs.current.set(id, { term, fitAddon, container });

        if (isTauriEnv()) {
            // ── Tauri v2 PTY mode ──────────────────────────────────────────
            tauriInvoke('pty_create', { id, cols: term.cols, rows: term.rows })
            .catch((e: any) => {
                term.write(`\r\x1b[31mFailed to start PTY: ${e}\x1b[0m\r\n`);
                startFallbackMode(term, id);
            });

            const unlisten1 = tauriListen(`pty-data-${id}`, (payload: string) => {
                term.write(payload);
            });
            const unlisten2 = tauriListen(`pty-exit-${id}`, () => {
                term.write('\r\n\x1b[33m[Process exited — press any key to close]\x1b[0m\r\n');
            });

            Promise.all([unlisten1, unlisten2]).then(fns => {
                unlistenRefs.current.set(id, fns);
            });

            term.onData((data: string) => {
                tauriInvoke('pty_write', { id, data }).catch(() => {});
            });

            term.onResize(({ cols, rows }: any) => {
                tauriInvoke('pty_resize', { id, cols, rows }).catch(() => {});
            });
        } else {
            // ── Fallback: execute_command mode ─────────────────────────────
            startFallbackMode(term, id);
        }

        const ro = new ResizeObserver(() => fitAddon?.fit());
        ro.observe(container);
    }, [loaded, themeName, fontSize]);

    // Open first tab once xterm has finished loading
    useEffect(() => { if (loaded && tabs.length === 0) newTab(); }, [loaded, tabs.length, newTab]);

    // Live theme switching
    useEffect(() => {
        termRefs.current.forEach(({ term }) => {
            term?.options && (term.options.theme = THEMES[themeName]);
        });
    }, [themeName]);

    // Live font size changes
    useEffect(() => {
        termRefs.current.forEach(({ term, fitAddon }) => {
            if (term?.options) term.options.fontSize = fontSize;
            fitAddon?.fit();
        });
    }, [fontSize]);

    return {
        tabs, activeTab, setActiveTab, themeName, setThemeName, fontSize, setFontSize,
        loaded, newTab, closeTab, initTerminal,
    };
}

export type TerminalSession = ReturnType<typeof useTerminalSession>;
