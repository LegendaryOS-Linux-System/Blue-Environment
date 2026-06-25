import React from 'react';
import { Globe, X, ChevronRight } from 'lucide-react';
import { BookmarkItem, HistoryEntry } from './types';

type Panel = 'bookmarks' | 'history' | 'none';

interface Props {
    panel: Panel;
    bookmarks: BookmarkItem[];
    history: HistoryEntry[];
    onClose: () => void;
    onNavigate: (url: string) => void;
    onClearHistory: () => void;
}

const SidePanel: React.FC<Props> = ({ panel, bookmarks, history, onClose, onNavigate, onClearHistory }) => {
    if (panel === 'none') return null;

    const items = panel === 'bookmarks' ? bookmarks : history;
    const empty = panel === 'bookmarks' ? 'No bookmarks yet' : 'No history';

    return (
        <div className="absolute right-0 top-0 bottom-0 w-72 bg-slate-900 border-l border-white/5 flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
                <span className="font-medium text-sm capitalize">{panel}</span>
                <div className="flex items-center gap-2">
                    {panel === 'history' && history.length > 0 && (
                        <button onClick={onClearHistory} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                    )}
                    <button onClick={onClose}><X size={14} className="text-slate-400"/></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {items.length === 0 && (
                    <p className="text-slate-500 text-xs text-center py-8">{empty}</p>
                )}
                {panel === 'bookmarks' && (bookmarks as BookmarkItem[]).map((b, i) => (
                    <button key={i} onClick={() => { onNavigate(b.url); onClose(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/5 text-left transition-colors">
                        <Globe size={13} className="text-slate-400 shrink-0"/>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{b.title}</div>
                            <div className="text-[10px] text-slate-500 truncate">{b.url}</div>
                        </div>
                        <ChevronRight size={12} className="text-slate-600 shrink-0"/>
                    </button>
                ))}
                {panel === 'history' && (history as HistoryEntry[]).map((h, i) => (
                    <button key={i} onClick={() => { onNavigate(h.url); onClose(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/5 text-left transition-colors">
                        <Globe size={13} className="text-slate-400 shrink-0"/>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{h.title}</div>
                            <div className="text-[10px] text-slate-500">{new Date(h.time).toLocaleString()}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SidePanel;
