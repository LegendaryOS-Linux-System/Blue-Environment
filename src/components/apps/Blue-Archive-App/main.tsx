import React, { useState } from 'react';
import { AppProps } from '../../../types';
import { Archive, FolderOpen, Download, ChevronRight, File, Folder, AlertCircle, Loader2, Info } from 'lucide-react';
import { useArchive } from './src/useArchive';

const BlueArchiveApp: React.FC<AppProps> = () => {
    const { archive, loading, status, error, openFile, extract } = useArchive();
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'size'>('name');

    const entries = archive?.info.entries
        .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => sortBy === 'size' ? b.size - a.size : a.name.localeCompare(b.name))
        ?? [];

    const dirs  = entries.filter(e => e.is_dir);
    const files = entries.filter(e => !e.is_dir);

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 shrink-0 bg-slate-800/50">
                <Archive size={18} className="text-blue-400" />
                <span className="font-semibold text-sm">{archive?.name || 'Blue Archive'}</span>
                <div className="flex-1" />
                {archive && (
                    <button onClick={extract} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs disabled:opacity-50">
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Extract All
                    </button>
                )}
                <button onClick={openFile} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs disabled:opacity-50">
                    <FolderOpen size={12} /> {archive ? 'Open Another' : 'Open Archive'}
                </button>
            </div>

            {/* Status / Error */}
            {status && <div className="px-4 py-2 text-xs text-green-400 bg-green-500/5 border-b border-green-500/10">{status}</div>}
            {error  && <div className="px-4 py-2 text-xs text-red-400 bg-red-500/5 border-b border-red-500/10 flex gap-2 items-start"><AlertCircle size={12} className="mt-0.5 shrink-0" />{error}</div>}

            {!archive && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                    <Archive size={48} className="text-slate-600" />
                    <p className="text-slate-400 text-sm">Open a .zip, .tar.gz, .7z or similar archive to inspect its contents.</p>
                    <button onClick={openFile} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm">
                        Open Archive
                    </button>
                    <p className="text-xs text-slate-600">Supports tar, zip, 7z and more via system tools</p>
                </div>
            )}

            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                </div>
            )}

            {archive && !loading && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Info bar + search */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Info size={12} />
                            {archive.info.total_files} items
                        </div>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Filter files…"
                            className="flex-1 bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                            className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none">
                            <option value="name">Sort: Name</option>
                            <option value="size">Sort: Size</option>
                        </select>
                    </div>

                    {/* File list */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {dirs.map((e, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded">
                                <Folder size={14} className="text-blue-400 shrink-0" />
                                <span className="text-sm text-slate-300 truncate flex-1">{e.path}</span>
                            </div>
                        ))}
                        {files.map((e, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded">
                                <File size={14} className="text-yellow-400 shrink-0" />
                                <span className="text-sm text-slate-300 truncate flex-1">{e.path}</span>
                                <span className="text-xs text-slate-600 shrink-0">
                                    {e.size > 0 ? `${(e.size / 1024).toFixed(1)} KB` : ''}
                                </span>
                            </div>
                        ))}
                        {entries.length === 0 && (
                            <div className="text-center py-8 text-slate-600 text-sm">No matching files</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlueArchiveApp;
