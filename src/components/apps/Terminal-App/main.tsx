import React, { useState } from 'react';
import { AppProps } from '../../../types';
import { Plus } from 'lucide-react';
import 'xterm/css/xterm.css';

import { useTerminalSession } from './useTerminalSession';
import TabBar from './TabBar';
import SettingsPanel from './SettingsPanel';

/**
 * Blue Terminal — entry point.
 *
 * Split across several files under this directory:
 *   themes.ts              — color theme presets + Tab type
 *   tauriBridge.ts          — Tauri v2 invoke/listen helpers
 *   xtermLoader.ts          — lazy-loads xterm.js + addons
 *   useTerminalSession.ts   — tabs, PTY/fallback session logic (single source of truth)
 *   TabBar.tsx              — tab strip UI
 *   SettingsPanel.tsx       — theme / font size panel
 */
const TerminalApp: React.FC<AppProps> = () => {
    const session = useTerminalSession();
    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden select-none">
            <TabBar session={session} showSettings={showSettings} onToggleSettings={() => setShowSettings(s => !s)} />

            {showSettings && <SettingsPanel session={session} onClose={() => setShowSettings(false)} />}

            <div className="flex-1 relative overflow-hidden">
                {session.tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`absolute inset-0 ${session.activeTab === tab.id ? '' : 'invisible pointer-events-none'}`}
                        ref={el => el && session.initTerminal(tab.id, el as HTMLDivElement)}
                        style={{ padding: '4px' }}
                    />
                ))}
                {session.tabs.length === 0 && (
                    <div className="flex items-center justify-center h-full text-slate-600">
                        <button onClick={session.newTab} className="flex items-center gap-2 hover:text-white transition-colors">
                            <Plus size={16} /> New Terminal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TerminalApp;
