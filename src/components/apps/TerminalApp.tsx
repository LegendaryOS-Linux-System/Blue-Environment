import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Plus, X, Settings, ChevronDown } from 'lucide-react';

interface Tab {
    id: string;
    title: string;
    terminal: Terminal | null;
    fitAddon: FitAddon | null;
}

const THEMES = {
    'dark': {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#388bfd33',
        black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
        blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
        brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
        brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
    },
    'dracula': {
        background: '#282a36', foreground: '#f8f8f2', cursor: '#ff79c6',
        black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
        blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
        brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
        brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
        brightCyan: '#a4ffff', brightWhite: '#ffffff',
        cursorAccent: '#282a36', selectionBackground: '#44475a',
    },
    'solarized': {
        background: '#002b36', foreground: '#839496', cursor: '#268bd2',
        black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
        blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
        brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
        brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4',
        brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
        cursorAccent: '#002b36', selectionBackground: '#073642',
    },
} as const;

type ThemeName = keyof typeof THEMES;

const TerminalTab: React.FC<{
    windowId: string;
    tabId: string;
    isActive: boolean;
    theme: ThemeName;
    fontSize: number;
    onTitleChange: (id: string, title: string) => void;
}> = ({ windowId, tabId, isActive, theme, fontSize, onTitleChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        if (!containerRef.current || termRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize,
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            fontWeight: '400',
            lineHeight: 1.2,
            letterSpacing: 0,
            theme: THEMES[theme],
            scrollback: 10000,
            allowTransparency: false,
            macOptionIsMeta: true,
            rightClickSelectsWord: true,
        });

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.loadAddon(new WebLinksAddon());
        term.open(containerRef.current);

        // Slight delay to ensure DOM is ready
        setTimeout(() => {
            fit.fit();
        }, 50);

        termRef.current = term;
        fitRef.current = fit;

        // Title tracking
        term.onTitleChange(title => {
            if (title) onTitleChange(tabId, title);
        });

        // Handle resize
        resizeObserverRef.current = new ResizeObserver(() => {
            if (fitRef.current) {
                try { fitRef.current.fit(); } catch {}
            }
        });
        resizeObserverRef.current.observe(containerRef.current);

        // Spawn backend terminal process
        SystemBridge.spawnTerminal(windowId + '-' + tabId).then(res => {
            if (!res.success) {
                term.writeln('\x1b[31m╔══════════════════════════════════════╗\x1b[0m');
                term.writeln('\x1b[31m║   Backend terminal unavailable       ║\x1b[0m');
                term.writeln('\x1b[31m╚══════════════════════════════════════╝\x1b[0m');
                term.writeln('');
                term.writeln('\x1b[33mRunning in fallback mode.\x1b[0m');
                term.writeln('');
                // Fallback: simple built-in shell emulation
                runFallbackShell(term);
            } else {
                term.writeln('\x1b[32m✓ Terminal ready\x1b[0m');
                term.writeln('');
            }
        });

        // Receive output from backend
        const handleOutput = (e: Event) => {
            const ev = e as CustomEvent<{ data: string; windowId?: string }>;
            if (!ev.detail.windowId || ev.detail.windowId === windowId + '-' + tabId) {
                term.write(ev.detail.data);
            }
        };
        window.addEventListener('terminal-output', handleOutput);

        // Send input to backend
        term.onData(data => {
            SystemBridge.writeToTerminal(data);
        });

        return () => {
            resizeObserverRef.current?.disconnect();
            window.removeEventListener('terminal-output', handleOutput);
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
        };
    }, []);

    // Update theme/fontSize when changed
    useEffect(() => {
        if (termRef.current) {
            termRef.current.options.theme = THEMES[theme];
            termRef.current.options.fontSize = fontSize;
            if (fitRef.current) fitRef.current.fit();
        }
    }, [theme, fontSize]);

    // Focus/fit when tab becomes active
    useEffect(() => {
        if (isActive && termRef.current && fitRef.current) {
            setTimeout(() => {
                fitRef.current?.fit();
                termRef.current?.focus();
            }, 50);
        }
    }, [isActive]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full"
            style={{ display: isActive ? 'block' : 'none' }}
        />
    );
};

// Fallback shell for when Tauri backend is not available
function runFallbackShell(term: Terminal) {
    let cwd = '~';
    let history: string[] = [];
    let histIdx = -1;
    let currentLine = '';

    const prompt = () => {
        term.write(`\r\n\x1b[32m┌──(\x1b[36mblue\x1b[32m)-[\x1b[37m${cwd}\x1b[32m]\r\n└─$ \x1b[0m`);
    };

    const runCmd = async (cmd: string) => {
        const parts = cmd.trim().split(/\s+/);
        const c = parts[0];
        const args = parts.slice(1);

        switch(c) {
            case '': break;
            case 'clear': term.clear(); break;
            case 'help':
                term.writeln('\r\n\x1b[36mAvailable commands:\x1b[0m');
                ['help','clear','echo','pwd','ls','cd','date','whoami','history','neofetch','exit'].forEach(cmd => {
                    term.writeln(`  \x1b[33m${cmd}\x1b[0m`);
                });
                break;
            case 'echo': term.writeln('\r\n' + args.join(' ')); break;
            case 'pwd': term.writeln('\r\n' + cwd); break;
            case 'date': term.writeln('\r\n' + new Date().toString()); break;
            case 'whoami':
                const user = SystemBridge.getUsername();
                term.writeln('\r\n' + user);
                break;
            case 'history':
                history.forEach((h, i) => term.writeln(`\r\n  ${String(i+1).padStart(4)}  ${h}`));
                break;
            case 'ls':
                term.writeln('\r\n\x1b[34mDesktop  Documents  Downloads  Music  Pictures  Videos\x1b[0m');
                break;
            case 'cd':
                cwd = args[0] === '~' || !args[0] ? '~' : `${cwd}/${args[0]}`;
                break;
            case 'neofetch':
                const username = SystemBridge.getUsername();
                term.writeln(`\r\n\x1b[34m    ___  __           \x1b[0m  \x1b[36m${username}\x1b[0m@\x1b[36mblue\x1b[0m`);
                term.writeln(`\x1b[34m   / _ )/ /_ _____    \x1b[0m  ──────────────────`);
                term.writeln(`\x1b[34m  / _  / / // / -_)   \x1b[0m  \x1b[33mOS:\x1b[0m HackerOS Linux`);
                term.writeln(`\x1b[34m /____/_/\\_,_/\\__/    \x1b[0m  \x1b[33mDE:\x1b[0m Blue Environment 0.4.0`);
                term.writeln(`\x1b[34m                       \x1b[0m  \x1b[33mShell:\x1b[0m Blue Terminal`);
                term.writeln(`\x1b[34m  Blue Environment     \x1b[0m  \x1b[33mTheme:\x1b[0m Blue Glass`);
                break;
            case 'exit':
                term.writeln('\r\n\x1b[33mGoodbye!\x1b[0m');
                return;
            default:
                // Try system command via SystemBridge
                try {
                    const res = await SystemBridge.executeCommand(cmd);
                    if (res.stdout) term.writeln('\r\n' + res.stdout.trimEnd());
                    if (res.stderr) term.writeln('\r\n\x1b[31m' + res.stderr.trimEnd() + '\x1b[0m');
                } catch {
                    term.writeln(`\r\n\x1b[31mCommand not found: ${c}\x1b[0m`);
                }
        }
        prompt();
    };

    prompt();

    term.onKey(({ key, domEvent }) => {
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

        if (domEvent.key === 'Enter') {
            const cmd = currentLine;
            if (cmd.trim()) {
                history.unshift(cmd);
                histIdx = -1;
            }
            currentLine = '';
            runCmd(cmd);
        } else if (domEvent.key === 'Backspace') {
            if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
                term.write('\b \b');
            }
        } else if (domEvent.key === 'ArrowUp') {
            if (histIdx < history.length - 1) {
                histIdx++;
                // Clear current line
                term.write('\r\x1b[K');
                term.write('\x1b[32m└─$ \x1b[0m' + history[histIdx]);
                currentLine = history[histIdx];
            }
        } else if (domEvent.key === 'ArrowDown') {
            if (histIdx > 0) {
                histIdx--;
                term.write('\r\x1b[K');
                term.write('\x1b[32m└─$ \x1b[0m' + history[histIdx]);
                currentLine = history[histIdx];
            } else if (histIdx === 0) {
                histIdx = -1;
                term.write('\r\x1b[K');
                term.write('\x1b[32m└─$ \x1b[0m');
                currentLine = '';
            }
        } else if (domEvent.ctrlKey && domEvent.key === 'c') {
            term.write('^C');
            currentLine = '';
            prompt();
        } else if (domEvent.ctrlKey && domEvent.key === 'l') {
            term.clear();
            prompt();
        } else if (printable) {
            currentLine += key;
            term.write(key);
        }
    });
}

const TerminalApp: React.FC<AppProps> = ({ windowId }) => {
    const [tabs, setTabs] = useState<Tab[]>([
        { id: 'tab-1', title: 'Terminal', terminal: null, fitAddon: null }
    ]);
    const [activeTab, setActiveTab] = useState('tab-1');
    const [theme, setTheme] = useState<ThemeName>('dark');
    const [fontSize, setFontSize] = useState(13);
    const [showSettings, setShowSettings] = useState(false);
    const tabCounter = useRef(2);

    const addTab = () => {
        const id = `tab-${tabCounter.current++}`;
        setTabs(prev => [...prev, { id, title: 'Terminal', terminal: null, fitAddon: null }]);
        setActiveTab(id);
    };

    const closeTab = (id: string) => {
        if (tabs.length === 1) return;
        setTabs(prev => prev.filter(t => t.id !== id));
        if (activeTab === id) {
            const remaining = tabs.filter(t => t.id !== id);
            setActiveTab(remaining[remaining.length - 1]?.id || '');
        }
    };

    const handleTitleChange = useCallback((id: string, title: string) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#0d1117]" style={{ background: THEMES[theme].background }}>
            {/* Tab bar */}
            <div
                className="flex items-center shrink-0 border-b"
                style={{ background: THEMES[theme].background, borderColor: 'rgba(255,255,255,0.08)', minHeight: '36px' }}
            >
                {/* Tabs */}
                <div className="flex items-center flex-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs font-medium border-r transition-colors shrink-0 ${
                                activeTab === tab.id
                                    ? 'text-white border-b-2 border-b-blue-400'
                                    : 'text-slate-500 hover:text-slate-300'
                            }`}
                            style={{
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                borderColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            <span className="max-w-[120px] truncate">{tab.title}</span>
                            {tabs.length > 1 && (
                                <button
                                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                                    className="opacity-50 hover:opacity-100 transition-opacity rounded"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 px-2 shrink-0">
                    <button
                        onClick={addTab}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="New tab (Ctrl+T)"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        onClick={() => setShowSettings(s => !s)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Settings"
                    >
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* Settings dropdown */}
            {showSettings && (
                <div
                    className="absolute right-2 top-10 z-50 rounded-xl border p-4 shadow-2xl w-64"
                    style={{ background: THEMES[theme].background, borderColor: 'rgba(255,255,255,0.12)' }}
                >
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Terminal Settings</div>

                    <div className="mb-3">
                        <label className="text-xs text-slate-400 block mb-1">Theme</label>
                        <div className="flex gap-2">
                            {(Object.keys(THEMES) as ThemeName[]).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={`px-2 py-1 rounded text-xs capitalize transition-colors ${
                                        theme === t
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="text-xs text-slate-400 block mb-1">Font Size: {fontSize}px</label>
                        <input
                            type="range" min="8" max="24" value={fontSize}
                            onChange={e => setFontSize(parseInt(e.target.value))}
                            className="w-full h-1.5 accent-blue-500"
                        />
                    </div>

                    <div className="text-xs text-slate-600 mt-3 pt-3 border-t border-white/5">
                        <div className="font-medium text-slate-400 mb-1">Shortcuts</div>
                        <div className="space-y-0.5">
                            <div>Ctrl+C — interrupt</div>
                            <div>Ctrl+L — clear screen</div>
                            <div>↑/↓ — history</div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowSettings(false)}
                        className="mt-3 w-full text-xs text-slate-500 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            )}

            {/* Terminal content */}
            <div className="flex-1 overflow-hidden relative">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className="absolute inset-0"
                        style={{ display: activeTab === tab.id ? 'block' : 'none' }}
                    >
                        <TerminalTab
                            windowId={windowId}
                            tabId={tab.id}
                            isActive={activeTab === tab.id}
                            theme={theme}
                            fontSize={fontSize}
                            onTitleChange={handleTitleChange}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TerminalApp;
