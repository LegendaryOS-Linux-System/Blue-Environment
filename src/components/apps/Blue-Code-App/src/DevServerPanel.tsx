import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, ExternalLink, Zap, Loader2 } from 'lucide-react';
import { useDevServer } from './useDevServer';

interface Props { rootPath: string; }

const DevServerPanel: React.FC<Props> = ({ rootPath }) => {
    const dev = useDevServer(rootPath);
    const [command, setCommand] = useState('');
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (!command && dev.detectedCommand) setCommand(dev.detectedCommand); }, [dev.detectedCommand, command]);
    useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [dev.log]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-2 space-y-2 border-b border-white/5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                    <Zap size={11} /> Active Dev Mode
                </div>
                <input
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    disabled={dev.running || dev.starting}
                    placeholder="npm run dev"
                    className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-60"
                />
                <div className="flex gap-1.5">
                    {!dev.running && !dev.starting ? (
                        <button onClick={() => dev.start(command)} disabled={!command.trim()}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded text-xs text-white transition-colors">
                            <Play size={12} /> Start
                        </button>
                    ) : (
                        <button onClick={dev.stop}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs text-white transition-colors">
                            <Square size={11} /> Stop
                        </button>
                    )}
                    {dev.url && (
                        <button onClick={dev.openInBrowser}
                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition-colors">
                            <ExternalLink size={12} /> Open
                        </button>
                    )}
                </div>
                {dev.starting && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Loader2 size={10} className="animate-spin" /> Starting…
                    </div>
                )}
                {dev.port && (
                    <div className="text-[10px] text-green-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Running on port {dev.port}
                    </div>
                )}
            </div>

            <div ref={logRef} className="flex-1 overflow-y-auto p-2 font-mono text-[10px] text-slate-400 space-y-0.5 bg-slate-950/50">
                {dev.log.length === 0 && (
                    <p className="text-slate-600 px-1">Output will appear here once started.</p>
                )}
                {dev.log.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line}</div>)}
            </div>
        </div>
    );
};

export default DevServerPanel;
