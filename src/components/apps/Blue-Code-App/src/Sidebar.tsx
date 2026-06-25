import React from 'react';
import { RefreshCw, FolderOpen, FolderPlus, FilePlus } from 'lucide-react';
import { GitPanel } from '../../../GitPanel';
import { FileTreeState } from './useFileTree';
import { EditorFilesState } from './useEditorFiles';
import { SidebarTab, SearchResult } from './types';
import FileTreeView from './FileTreeView';
import DevServerPanel from './DevServerPanel';

interface Props {
    tree: FileTreeState;
    editor: EditorFilesState;
    sidebarTab: SidebarTab;
    setSidebarTab: (t: SidebarTab) => void;
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    searchResults: SearchResult[];
    onSearch: () => void;
}

const Sidebar: React.FC<Props> = ({
    tree, editor, sidebarTab, setSidebarTab,
    searchTerm, setSearchTerm, searchResults, onSearch,
}) => (
    <div className="w-56 bg-slate-800/50 border-r border-white/5 flex flex-col overflow-hidden">
        <div className="flex border-b border-white/5 shrink-0">
            {(['files', 'search', 'git', 'dev'] as const).map(tab => (
                <button key={tab} onClick={() => setSidebarTab(tab)}
                    className={`flex-1 py-1.5 text-xs capitalize transition-colors ${
                        sidebarTab === tab ? 'bg-slate-900 text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-white'
                    }`}>
                    {tab}
                </button>
            ))}
        </div>

        {sidebarTab === 'files' && (
            <div className="flex-1 overflow-y-auto p-1">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate" title={tree.rootPath}>
                        {tree.rootPath.split('/').pop() || tree.rootPath || 'Explorer'}
                    </span>
                    <div className="flex gap-0.5 shrink-0">
                        <button onClick={() => tree.createFile()} className="p-0.5 hover:bg-white/10 rounded text-slate-500" title="New File">
                            <FilePlus size={12} />
                        </button>
                        <button onClick={() => tree.createFolder()} className="p-0.5 hover:bg-white/10 rounded text-slate-500" title="New Folder">
                            <FolderPlus size={12} />
                        </button>
                        <button onClick={tree.openWorkspace} className="p-0.5 hover:bg-white/10 rounded text-slate-500" title="Open Folder">
                            <FolderOpen size={12} />
                        </button>
                        <button onClick={() => tree.loadTree(tree.rootPath)} className="p-0.5 hover:bg-white/10 rounded text-slate-500" title="Refresh">
                            <RefreshCw size={11} />
                        </button>
                    </div>
                </div>
                {tree.isLoading ? (
                    <div className="text-center py-4 text-slate-500 text-xs">Loading…</div>
                ) : tree.fileTree.length === 0 ? (
                    <div className="text-center py-6 px-2 text-slate-600 text-xs">
                        Empty workspace.<br />Use the icons above to create a file or folder.
                    </div>
                ) : (
                    <FileTreeView
                        nodes={tree.fileTree}
                        onOpenFile={editor.openFile}
                        onToggleDir={tree.toggleDir}
                        onRename={async node => {
                            const newPath = await tree.renameNode(node);
                            if (newPath) editor.renameOpenFile(node.path, newPath);
                        }}
                        onDelete={async node => {
                            const ok = await tree.deleteNode(node);
                            if (ok) {
                                const idx = editor.openFiles.findIndex(f => f.path === node.path);
                                if (idx >= 0) editor.closeFile(idx);
                            }
                        }}
                        selectedDir={tree.selectedDir}
                    />
                )}
            </div>
        )}

        {sidebarTab === 'search' && (
            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex gap-1 mb-2">
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onSearch()}
                        placeholder="Search…"
                        className="flex-1 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500/50" />
                    <button onClick={onSearch} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs">Go</button>
                </div>
                <div className="space-y-1">
                    {searchResults.map((r, i) => (
                        <div key={i} onClick={() => editor.openFile(r.file)}
                            className="cursor-pointer hover:bg-white/5 rounded p-1">
                            <div className="text-[10px] text-blue-400 truncate">{r.file.split('/').pop()}:{r.line}</div>
                            <div className="text-[10px] text-slate-400 truncate">{r.content}</div>
                        </div>
                    ))}
                    {searchResults.length === 0 && searchTerm && (
                        <div className="text-xs text-slate-600 text-center py-4">No results</div>
                    )}
                </div>
            </div>
        )}

        {sidebarTab === 'git' && (
            <div className="flex-1 overflow-hidden">
                <GitPanel cwd={tree.rootPath} />
            </div>
        )}

        {sidebarTab === 'dev' && (
            <DevServerPanel rootPath={tree.rootPath} />
        )}
    </div>
);

export default Sidebar;
