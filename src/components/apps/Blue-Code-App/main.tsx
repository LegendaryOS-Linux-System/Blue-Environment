import React, { useState } from 'react';
import { AppProps } from '../../../types';
import { useDialog } from '../../../contexts/DialogContext';
import { Code2, Plus, AlertCircle, FileCode, X } from 'lucide-react';
import Editor from '@monaco-editor/react';

import { useFileTree } from './src/useFileTree';
import { useEditorFiles } from './src/useEditorFiles';
import { useSearch } from './src/useSearch';
import { SidebarTab, CommandEntry } from './src/types';

import Toolbar from './src/Toolbar';
import Sidebar from './src/Sidebar';
import StatusBar from './src/StatusBar';
import CommandPalette from './src/CommandPalette';
import TerminalPane from './src/TerminalPane';

const BlueCodeApp: React.FC<AppProps> = ({ windowId }) => {
    const dialog = useDialog();

    const tree   = useFileTree();
    const editor = useEditorFiles(tree.rootPath);
    const search = useSearch(tree.rootPath);

    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showTerminal, setShowTerminal] = useState(true);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [commandInput, setCommandInput] = useState('');

    const newFile = async () => {
        const path = await tree.createFile();
        if (path) await editor.openFile(path);
    };

    const commands: CommandEntry[] = [
        { id: 'save',     label: 'Save File',          shortcut: 'Ctrl+S',       action: () => editor.saveFile(editor.activeIdx) },
        { id: 'saveAll',  label: 'Save All',            shortcut: 'Ctrl+Shift+S', action: editor.saveAll },
        { id: 'newFile',  label: 'New File',            shortcut: 'Ctrl+N',       action: newFile },
        { id: 'newFolder',label: 'New Folder',          shortcut: '',             action: () => tree.createFolder() },
        { id: 'openFolder',label: 'Open Folder…',       shortcut: 'Ctrl+K Ctrl+O',action: tree.openWorkspace },
        { id: 'terminal', label: 'Toggle Terminal',     shortcut: 'Ctrl+`',       action: () => setShowTerminal(s => !s) },
        { id: 'sidebar',  label: 'Toggle Sidebar',      shortcut: 'Ctrl+B',       action: () => setSidebarCollapsed(s => !s) },
        { id: 'refresh',  label: 'Refresh Explorer',    shortcut: '',             action: () => tree.loadTree(tree.rootPath) },
        { id: 'lint',     label: 'Run Linter',          shortcut: '',             action: () => editor.runLint(editor.activeIdx) },
        { id: 'search',   label: 'Search in Files',     shortcut: 'Ctrl+F',       action: () => setSidebarTab('search') },
        { id: 'dev',      label: 'Active Dev Mode',     shortcut: '',             action: () => setSidebarTab('dev') },
        { id: 'theme',    label: 'Toggle Light/Dark',   shortcut: '',             action: () => editor.setEditorTheme(t => t === 'blue-dark' ? 'blue-light' : 'blue-dark') },
    ];

    const handleEditorMountWithKeybindings: typeof editor.handleEditorMount = (ed, monaco) => {
        editor.handleEditorMount(ed, monaco);
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => editor.saveFile(editor.activeIdx));
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, editor.saveAll);
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => setShowCommandPalette(true));
    };

    const activeFile = editor.activeFile;

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white text-sm relative">
            <Toolbar
                sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
                onNewFile={newFile}
                onSave={() => editor.saveFile(editor.activeIdx)} canSave={!!activeFile?.modified}
                showTerminal={showTerminal} setShowTerminal={setShowTerminal}
                sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
                onCommandPalette={() => setShowCommandPalette(true)}
                activeFile={activeFile}
                lspStatus={editor.lspStatus}
                onRefresh={() => tree.loadTree(tree.rootPath)}
            />

            <div className="flex flex-1 overflow-hidden">
                {!sidebarCollapsed && (
                    <Sidebar
                        tree={tree} editor={editor}
                        sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
                        searchTerm={search.searchTerm} setSearchTerm={search.setSearchTerm}
                        searchResults={search.searchResults} onSearch={search.searchFiles}
                    />
                )}

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex bg-slate-800 border-b border-white/5 overflow-x-auto shrink-0">
                        {editor.openFiles.map((file, idx) => (
                            <div key={idx} onClick={() => editor.setActiveIdx(idx)}
                                className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer border-b-2 shrink-0 group max-w-[160px]
                                    ${editor.activeIdx === idx ? 'border-blue-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'}`}>
                                <FileCode size={13} />
                                <span className="text-xs truncate">{file.path.split('/').pop()}</span>
                                {file.modified && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full shrink-0" />}
                                <button onClick={e => { e.stopPropagation(); editor.closeFile(idx); }}
                                    className="p-0.5 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 shrink-0"><X size={11} /></button>
                            </div>
                        ))}
                    </div>

                    {/* Diagnostics strip */}
                    {editor.fileDiagnostics.length > 0 && (
                        <div className="shrink-0 flex items-center gap-3 px-3 py-1 bg-red-500/5 border-b border-red-500/10 text-xs">
                            {editor.errors > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                    <AlertCircle size={12} /> {editor.errors} error{editor.errors > 1 ? 's' : ''}
                                </span>
                            )}
                            {editor.warnings > 0 && (
                                <span className="flex items-center gap-1 text-yellow-400">
                                    <AlertCircle size={12} /> {editor.warnings} warning{editor.warnings > 1 ? 's' : ''}
                                </span>
                            )}
                            <span className="text-slate-600 text-[10px] ml-auto">
                                {editor.fileDiagnostics[0].message.slice(0, 60)}
                            </span>
                        </div>
                    )}

                    {/* Monaco editor */}
                    <div className="flex-1 overflow-hidden">
                        {activeFile ? (
                            <Editor
                                height="100%"
                                language={activeFile.language}
                                value={activeFile.content}
                                onChange={editor.handleEditorChange}
                                onMount={handleEditorMountWithKeybindings}
                                theme={editor.editorTheme}
                                options={{
                                    fontSize: editor.fontSize, minimap: { enabled: true },
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    fontFamily: 'JetBrains Mono, Fira Code, monospace',
                                    renderWhitespace: 'boundary',
                                    tabSize: 4,
                                    wordWrap: 'off',
                                    suggestOnTriggerCharacters: true,
                                    quickSuggestions: { other: true, comments: true, strings: true },
                                    parameterHints: { enabled: true },
                                    formatOnPaste: true,
                                    formatOnType: false,
                                    bracketPairColorization: { enabled: true },
                                    guides: { bracketPairs: true, indentation: true },
                                    renderLineHighlight: 'all',
                                    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                                <Code2 size={40} />
                                <div className="text-sm">Open a file or create a new one</div>
                                <div className="flex gap-2">
                                    <button onClick={newFile} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm text-white">
                                        <Plus size={14} /> New File
                                    </button>
                                    <button onClick={tree.openWorkspace} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-white">
                                        Open Folder
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Terminal */}
                    {showTerminal && (
                        <div className="h-44 bg-slate-900 border-t border-white/5 flex flex-col shrink-0">
                            <div className="flex items-center justify-between px-3 py-1 border-b border-white/5 bg-slate-800/50">
                                <span className="text-xs text-slate-400">Terminal</span>
                                <button onClick={() => setShowTerminal(false)} className="p-0.5 hover:bg-white/10 rounded text-slate-500"><X size={12} /></button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <TerminalPane windowId={windowId} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <StatusBar
                languageLabel={activeFile ? activeFile.language.toUpperCase() : '—'}
                line={editor.cursorPos.line} col={editor.cursorPos.col}
                errors={editor.errors} warnings={editor.warnings}
                editorTheme={editor.editorTheme}
                onToggleTheme={() => editor.setEditorTheme(t => t === 'blue-dark' ? 'blue-light' : 'blue-dark')}
                fontSize={editor.fontSize} onFontSizeChange={editor.setFontSize}
            />

            <CommandPalette
                visible={showCommandPalette} onClose={() => { setShowCommandPalette(false); setCommandInput(''); }}
                input={commandInput} onInputChange={setCommandInput}
                commands={commands}
            />
        </div>
    );
};

export default BlueCodeApp;
