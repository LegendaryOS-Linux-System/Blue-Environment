import React from 'react';
import { Command, X } from 'lucide-react';
import { CommandEntry } from './types';

interface Props {
    visible: boolean;
    onClose: () => void;
    input: string;
    onInputChange: (s: string) => void;
    commands: CommandEntry[];
}

const CommandPalette: React.FC<Props> = ({ visible, onClose, input, onInputChange, commands }) => {
    if (!visible) return null;
    const filtered = commands.filter(c => c.label.toLowerCase().includes(input.toLowerCase()));

    return (
        <div className="absolute inset-0 bg-black/50 flex items-start justify-center z-50 pt-20" onClick={onClose}>
            <div className="bg-slate-800 rounded-xl w-96 p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-3">
                    <Command size={14} className="text-slate-500" />
                    <input type="text" value={input} onChange={e => onInputChange(e.target.value)}
                        placeholder="Type a command…"
                        className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                        autoFocus />
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={13} /></button>
                </div>
                <div className="space-y-0.5 max-h-56 overflow-y-auto">
                    {filtered.map(cmd => (
                        <button key={cmd.id} onClick={() => { cmd.action(); onClose(); }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded text-sm text-left">
                            <span>{cmd.label}</span>
                            {cmd.shortcut && <span className="text-xs text-slate-500 font-mono">{cmd.shortcut}</span>}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-xs text-slate-600 text-center py-4">No matching commands</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
