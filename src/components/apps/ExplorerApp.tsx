import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';
import {
    Folder, File, ChevronRight, ChevronLeft, Home, RefreshCw,
    Grid, List, Search, Eye, EyeOff, Copy, Scissors, Clipboard,
    Trash2, Plus, FolderPlus, Edit3, ArrowUp, HardDrive, Star,
    Download, Image, FileText, Film, Music, Archive, Code,
    MoreHorizontal, X, Check
} from 'lucide-react';

interface FileEntry {
    name: string;
    path: string;
    isDir: boolean;
    size: number;
    modified: string;
    extension: string;
}

interface ClipboardItem {
    paths: string[];
    mode: 'copy' | 'cut';
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    // Images
    png: Image, jpg: Image, jpeg: Image, gif: Image, webp: Image, svg: Image, ico: Image,
    // Video
    mp4: Film, mkv: Film, avi: Film, mov: Film, webm: Film,
    // Audio
    mp3: Music, wav: Music, flac: Music, ogg: Music, m4a: Music,
    // Docs
    txt: FileText, md: FileText, pdf: FileText, doc: FileText, docx: FileText,
    // Code
    ts: Code, tsx: Code, js: Code, jsx: Code, rs: Code, py: Code, sh: Code, json: Code, toml: Code, yaml: Code, yml: Code, css: Code, html: Code, cr: Code,
    // Archives
    zip: Archive, tar: Archive, gz: Archive, '7z': Archive, rar: Archive,
};

function getFileIcon(entry: FileEntry): React.ComponentType<any> {
    if (entry.isDir) return Folder;
    return ICON_MAP[entry.extension?.toLowerCase()] || File;
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const BOOKMARKS = [
    { label: 'Home',      path: '',       icon: Home },
    { label: 'Downloads', path: '/Downloads', icon: Download },
    { label: 'Documents', path: '/Documents', icon: FileText },
    { label: 'Pictures',  path: '/Pictures',  icon: Image },
    { label: 'Music',     path: '/Music',     icon: Music },
    { label: 'Videos',    path: '/Videos',    icon: Film },
];

const ExplorerApp: React.FC<AppProps> = () => {
    const [currentPath, setCurrentPath] = useState('');
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showHidden, setShowHidden] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [renaming, setRenaming] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
    const [homeDir, setHomeDir] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Get home dir
        SystemBridge.executeCommand('echo $HOME').then(result => {
            const home = (typeof result === 'string' ? result : result.stdout).trim();
            setHomeDir(home);
            navigate(home);
        });
    }, []);

    const navigate = useCallback(async (path: string, addToHistory = true) => {
        setLoading(true);
        setError(null);
        setSelected(new Set());
        setSearchQuery('');
        try {
            const raw = await SystemBridge.executeCommand(
                `ls -la --time-style="+%Y-%m-%d %H:%M" "${path}" 2>&1 || echo "ERROR"`
            );
            const result = typeof raw === 'string' ? raw : (raw.stdout || raw.stderr || '');

            if (result.includes('ERROR') && !result.trim().startsWith('total')) {
                setError(`Cannot access: ${path}`);
                setLoading(false);
                return;
            }

            const lines = result.split('\n').filter((l: string) => l.trim() && !l.startsWith('total'));
            const parsed: FileEntry[] = [];

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 9) continue;
                const perms = parts[0];
                const size = parseInt(parts[4]) || 0;
                const name = parts.slice(8).join(' ');
                if (name === '.' || name === '..') continue;
                const isDir = perms.startsWith('d');
                const isLink = perms.startsWith('l');
                const ext = name.includes('.') ? name.split('.').pop() || '' : '';
                const entryPath = `${path}/${name}`.replace('//', '/');
                parsed.push({ name, path: entryPath, isDir: isDir || (isLink && false), size, modified: `${parts[6]} ${parts[7]}`, extension: ext });
            }

            // Sort: dirs first, then files, both alphabetically
            parsed.sort((a, b) => {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                return a.name.localeCompare(b.name);
            });

            setEntries(parsed);
            setCurrentPath(path);

            if (addToHistory) {
                const newHistory = [...history.slice(0, historyIndex + 1), path];
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
        } catch (e) {
            setError('Failed to read directory');
        } finally {
            setLoading(false);
        }
    }, [history, historyIndex]);

    const goBack = () => {
        if (historyIndex > 0) {
            const path = history[historyIndex - 1];
            setHistoryIndex(h => h - 1);
            navigate(path, false);
        }
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) {
            const path = history[historyIndex + 1];
            setHistoryIndex(h => h + 1);
            navigate(path, false);
        }
    };

    const goUp = () => {
        const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
        navigate(parent);
    };

    const handleOpen = (entry: FileEntry) => {
        if (entry.isDir) {
            navigate(entry.path);
        } else {
            SystemBridge.executeCommand(`xdg-open "${entry.path}" &`).catch(() => {});
        }
    };

    const handleSelect = (e: React.MouseEvent, path: string) => {
        if (e.ctrlKey || e.metaKey) {
            setSelected(prev => {
                const next = new Set(prev);
                next.has(path) ? next.delete(path) : next.add(path);
                return next;
            });
        } else if (e.shiftKey) {
            const idx = filteredEntries.findIndex(f => f.path === path);
            const lastSelected = filteredEntries.findIndex(f => selected.has(f.path));
            if (lastSelected >= 0) {
                const [from, to] = [Math.min(idx, lastSelected), Math.max(idx, lastSelected)];
                setSelected(new Set(filteredEntries.slice(from, to + 1).map(f => f.path)));
            }
        } else {
            setSelected(new Set([path]));
        }
    };

    const handleCopy = (paths: string[]) => setClipboard({ paths, mode: 'copy' });
    const handleCut = (paths: string[]) => setClipboard({ paths, mode: 'cut' });

    const handlePaste = async () => {
        if (!clipboard) return;
        const cmd = clipboard.mode === 'copy'
            ? `cp -r ${clipboard.paths.map(p => `"${p}"`).join(' ')} "${currentPath}/"`
            : `mv ${clipboard.paths.map(p => `"${p}"`).join(' ')} "${currentPath}/"`;
        await SystemBridge.executeCommand(cmd).catch(() => {});
        if (clipboard.mode === 'cut') setClipboard(null);
        navigate(currentPath, false);
    };

    const handleDelete = async (paths: string[]) => {
        const names = paths.map(p => p.split('/').pop()).join(', ');
        if (!window.confirm(`Delete ${names}?`)) return;
        await SystemBridge.executeCommand(`rm -rf ${paths.map(p => `"${p}"`).join(' ')}`);
        setSelected(new Set());
        navigate(currentPath, false);
    };

    const handleNewFolder = async () => {
        const name = window.prompt('Folder name:');
        if (!name) return;
        await SystemBridge.executeCommand(`mkdir -p "${currentPath}/${name}"`);
        navigate(currentPath, false);
    };

    const handleNewFile = async () => {
        const name = window.prompt('File name:');
        if (!name) return;
        await SystemBridge.executeCommand(`touch "${currentPath}/${name}"`);
        navigate(currentPath, false);
    };

    const startRename = (entry: FileEntry) => {
        setRenaming(entry.path);
        setRenameValue(entry.name);
        setTimeout(() => renameInputRef.current?.select(), 50);
    };

    const finishRename = async () => {
        if (!renaming || !renameValue.trim()) { setRenaming(null); return; }
        const dir = renaming.split('/').slice(0, -1).join('/');
        const newPath = `${dir}/${renameValue.trim()}`;
        if (newPath !== renaming) {
            await SystemBridge.executeCommand(`mv "${renaming}" "${newPath}"`);
            navigate(currentPath, false);
        }
        setRenaming(null);
    };

    const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, path: entry.path, isDir: entry.isDir });
        if (!selected.has(entry.path)) setSelected(new Set([entry.path]));
    };

    const filteredEntries = entries.filter(e => {
        if (!showHidden && e.name.startsWith('.')) return false;
        if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const selectedPaths = Array.from(selected);

    const pathParts = currentPath.split('/').filter(Boolean);

    return (
        <div
            className="flex flex-col h-full bg-slate-900 text-white overflow-hidden"
            onClick={() => setContextMenu(null)}
        >
            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-slate-800 border-b border-white/5">
                {/* Nav buttons */}
                <button onClick={goBack} disabled={historyIndex <= 0} className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <button onClick={goForward} disabled={historyIndex >= history.length - 1} className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-colors">
                    <ChevronRight size={16} />
                </button>
                <button onClick={goUp} disabled={currentPath === '/'} className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-30 transition-colors">
                    <ArrowUp size={16} />
                </button>
                <button onClick={() => navigate(homeDir)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <Home size={16} />
                </button>
                <button onClick={() => navigate(currentPath, false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>

                {/* Breadcrumb */}
                <div className="flex-1 flex items-center gap-0.5 bg-slate-900/50 rounded-lg px-2 py-1 mx-1 overflow-x-auto scrollbar-hide text-sm">
                    <button onClick={() => navigate('/')} className="hover:text-blue-400 text-slate-400 shrink-0">/</button>
                    {pathParts.map((part, i) => {
                        const path = '/' + pathParts.slice(0, i + 1).join('/');
                        return (
                            <React.Fragment key={i}>
                                <ChevronRight size={12} className="text-slate-600 shrink-0" />
                                <button onClick={() => navigate(path)} className="hover:text-blue-400 whitespace-nowrap shrink-0 transition-colors">
                                    {part}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="bg-slate-900/50 border border-white/10 rounded-lg pl-7 pr-3 py-1 text-sm w-40 focus:outline-none focus:border-blue-500/50"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                            <X size={12} className="text-slate-400" />
                        </button>
                    )}
                </div>

                {/* View toggles */}
                <button onClick={() => setShowHidden(s => !s)} className={`p-1.5 rounded-lg transition-colors ${showHidden ? 'text-blue-400 bg-blue-500/10' : 'hover:bg-white/10 text-slate-400'}`} title="Show hidden">
                    {showHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'text-blue-400 bg-blue-500/10' : 'hover:bg-white/10 text-slate-400'}`}>
                    <Grid size={15} />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'text-blue-400 bg-blue-500/10' : 'hover:bg-white/10 text-slate-400'}`}>
                    <List size={15} />
                </button>

                {/* Actions */}
                <div className="flex gap-0.5 ml-1 border-l border-white/10 pl-1">
                    <button onClick={handleNewFolder} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400" title="New folder">
                        <FolderPlus size={15} />
                    </button>
                    <button onClick={handleNewFile} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400" title="New file">
                        <Plus size={15} />
                    </button>
                    {clipboard && (
                        <button onClick={handlePaste} className="p-1.5 hover:bg-white/10 rounded-lg text-green-400" title="Paste">
                            <Clipboard size={15} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-40 shrink-0 bg-slate-800/50 border-r border-white/5 overflow-y-auto py-2">
                    <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bookmarks</div>
                    {BOOKMARKS.map(bm => {
                        const fullPath = bm.path ? homeDir + bm.path : homeDir;
                        const Icon = bm.icon;
                        return (
                            <button
                                key={bm.label}
                                onClick={() => navigate(fullPath)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors text-left ${currentPath === fullPath ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300'}`}
                            >
                                <Icon size={14} className="shrink-0" />
                                {bm.label}
                            </button>
                        );
                    })}
                    <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-3">Devices</div>
                    {['/'].map(path => (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors text-left text-slate-300"
                        >
                            <HardDrive size={14} className="shrink-0" />
                            Root (/)
                        </button>
                    ))}
                </div>

                {/* Main content */}
                <div
                    className="flex-1 overflow-y-auto p-3"
                    onClick={() => setSelected(new Set())}
                >
                    {error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-400">
                            <X size={32} className="mb-2" />
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw size={24} className="animate-spin text-blue-400" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Folder size={48} className="mb-3 opacity-30" />
                            <p className="text-sm">{searchQuery ? 'No matches' : 'Empty folder'}</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
                            {filteredEntries.map(entry => {
                                const Icon = getFileIcon(entry);
                                const isSelected = selected.has(entry.path);
                                const isRenaming = renaming === entry.path;
                                return (
                                    <div
                                        key={entry.path}
                                        onClick={e => { e.stopPropagation(); handleSelect(e, entry.path); }}
                                        onDoubleClick={() => isRenaming ? undefined : handleOpen(entry)}
                                        onContextMenu={e => handleContextMenu(e, entry)}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all select-none ${isSelected ? 'bg-blue-600/30 ring-1 ring-blue-500/50' : 'hover:bg-white/5'}`}
                                    >
                                        <Icon size={36} className={`shrink-0 ${entry.isDir ? 'text-blue-400' : 'text-slate-400'}`} />
                                        {isRenaming ? (
                                            <input
                                                ref={renameInputRef}
                                                value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onBlur={finishRename}
                                                onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                onClick={e => e.stopPropagation()}
                                                className="w-full bg-slate-700 text-white text-xs text-center rounded px-1 focus:outline-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-xs text-center break-all line-clamp-2 text-slate-200 w-full">
                                                {entry.name}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 text-xs border-b border-white/5">
                                    <th className="text-left py-1 px-2 font-medium">Name</th>
                                    <th className="text-right py-1 px-2 font-medium w-24">Size</th>
                                    <th className="text-right py-1 px-2 font-medium w-36">Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => {
                                    const Icon = getFileIcon(entry);
                                    const isSelected = selected.has(entry.path);
                                    const isRenaming = renaming === entry.path;
                                    return (
                                        <tr
                                            key={entry.path}
                                            onClick={e => { e.stopPropagation(); handleSelect(e, entry.path); }}
                                            onDoubleClick={() => handleOpen(entry)}
                                            onContextMenu={e => handleContextMenu(e, entry)}
                                            className={`cursor-pointer transition-colors rounded-lg ${isSelected ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}
                                        >
                                            <td className="py-1 px-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon size={16} className={`shrink-0 ${entry.isDir ? 'text-blue-400' : 'text-slate-400'}`} />
                                                    {isRenaming ? (
                                                        <input
                                                            ref={renameInputRef}
                                                            value={renameValue}
                                                            onChange={e => setRenameValue(e.target.value)}
                                                            onBlur={finishRename}
                                                            onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setRenaming(null); }}
                                                            onClick={e => e.stopPropagation()}
                                                            className="bg-slate-700 text-white text-sm rounded px-1 focus:outline-none w-48"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="text-slate-200 truncate">{entry.name}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-1 px-2 text-right text-slate-500 text-xs">{entry.isDir ? '—' : formatSize(entry.size)}</td>
                                            <td className="py-1 px-2 text-right text-slate-500 text-xs">{entry.modified}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Status bar */}
            <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-slate-800/50 border-t border-white/5 text-xs text-slate-500">
                <span>{filteredEntries.length} items{selected.size > 0 ? ` · ${selected.size} selected` : ''}</span>
                <div className="flex items-center gap-3">
                    {clipboard && (
                        <span className={`${clipboard.mode === 'cut' ? 'text-orange-400' : 'text-green-400'}`}>
                            {clipboard.paths.length} item(s) ready to {clipboard.mode === 'cut' ? 'move' : 'copy'}
                            <button onClick={() => setClipboard(null)} className="ml-1 hover:text-white"><X size={10} /></button>
                        </span>
                    )}
                    {selectedPaths.length > 0 && (
                        <div className="flex gap-1">
                            <button onClick={() => handleCopy(selectedPaths)} className="hover:text-white p-0.5" title="Copy"><Copy size={12} /></button>
                            <button onClick={() => handleCut(selectedPaths)} className="hover:text-white p-0.5" title="Cut"><Scissors size={12} /></button>
                            <button onClick={() => handleDelete(selectedPaths)} className="hover:text-red-400 p-0.5" title="Delete"><Trash2 size={12} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Context menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-1 min-w-44"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    {[
                        { label: 'Open', icon: contextMenu.isDir ? Folder : File, action: () => { const e = filteredEntries.find(f => f.path === contextMenu.path); if (e) handleOpen(e); } },
                        { label: 'Rename', icon: Edit3, action: () => { const e = filteredEntries.find(f => f.path === contextMenu.path); if (e) startRename(e); } },
                        null,
                        { label: 'Copy', icon: Copy, action: () => handleCopy(selectedPaths.length > 0 ? selectedPaths : [contextMenu.path]) },
                        { label: 'Cut', icon: Scissors, action: () => handleCut(selectedPaths.length > 0 ? selectedPaths : [contextMenu.path]) },
                        clipboard ? { label: 'Paste', icon: Clipboard, action: handlePaste } : null,
                        null,
                        { label: 'Delete', icon: Trash2, action: () => handleDelete(selectedPaths.length > 0 ? selectedPaths : [contextMenu.path]), danger: true },
                    ].map((item, i) => {
                        if (!item) return <div key={i} className="border-t border-white/5 my-1" />;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.label}
                                onClick={() => { item.action(); setContextMenu(null); }}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors text-left ${(item as any).danger ? 'text-red-400' : 'text-slate-200'}`}
                            >
                                <Icon size={14} className="shrink-0" />
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ExplorerApp;
