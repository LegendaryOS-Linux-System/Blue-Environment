import React, { useState, useEffect, useCallback } from 'react';
import { SystemBridge } from '../utils/systemBridge';
import { useDialog } from '../contexts/DialogContext';
import {
    GitBranch, GitCommit, GitMerge, RefreshCw, Check, X,
    Plus, Minus, ChevronRight, ChevronDown, Upload, Download,
    AlertCircle, FileText, FolderGit2
} from 'lucide-react';

interface GitFile {
    status: string; // 'M', 'A', 'D', '?', 'R', etc.
    staged: boolean;
    path: string;
}

interface GitCommitInfo {
    hash: string;
    author: string;
    date: string;
    message: string;
}

interface Props { cwd: string; }

export function GitPanel({ cwd }: Props) {
    const dialog = useDialog();
    const [branch, setBranch] = useState('');
    const [files, setFiles] = useState<GitFile[]>([]);
    const [commits, setCommits] = useState<GitCommitInfo[]>([]);
    const [commitMsg, setCommitMsg] = useState('');
    const [tab, setTab] = useState<'changes' | 'history' | 'diff'>('changes');
    const [diff, setDiff] = useState('');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGitRepo, setIsGitRepo] = useState(false);

    const run = useCallback(async (cmd: string): Promise<string> => {
        const r = await SystemBridge.executeCommand(`cd "${cwd}" && ${cmd} 2>&1`);
        return typeof r === 'string' ? r : r?.stdout || '';
    }, [cwd]);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Check if git repo
            const gitCheck = await run('git rev-parse --git-dir');
            if (gitCheck.includes('not a git repository') || !gitCheck.includes('.git')) {
                setIsGitRepo(false); setLoading(false); return;
            }
            setIsGitRepo(true);

            // Branch
            const br = await run('git branch --show-current');
            setBranch(br.trim() || 'HEAD');

            // Status
            const status = await run('git status --porcelain');
            const fs: GitFile[] = [];
            for (const line of status.split('\n').filter(Boolean)) {
                const xy = line.slice(0, 2);
                const path = line.slice(3);
                const staged = xy[0] !== ' ' && xy[0] !== '?';
                const wt = xy[1] !== ' ';
                if (staged || wt || xy === '??') {
                    fs.push({ status: staged ? xy[0] : xy[1], staged, path: path.trim() });
                }
            }
            setFiles(fs);

            // Recent commits
            const log = await run('git log --oneline --format="%H|%an|%ar|%s" -15');
            const cs: GitCommitInfo[] = log.split('\n').filter(Boolean).map(l => {
                const parts = l.split('|');
                return { hash: parts[0]?.slice(0, 7) || '', author: parts[1] || '', date: parts[2] || '', message: parts[3] || '' };
            });
            setCommits(cs);
        } catch (e: any) { setError(e.message); }
        setLoading(false);
    }, [run]);

    useEffect(() => { if (cwd) refresh(); }, [cwd, refresh]);

    const stageFile = async (path: string) => {
        await run(`git add "${path}"`); refresh();
    };
    const unstageFile = async (path: string) => {
        await run(`git reset HEAD "${path}"`); refresh();
    };
    const discardFile = async (path: string) => {
        const ok = await dialog.confirm({
            title: 'Discard changes',
            message: `Discard changes to ${path}? This cannot be undone.`,
            confirmLabel: 'Discard',
            danger: true,
        });
        if (!ok) return;
        await run(`git checkout -- "${path}"`); refresh();
    };
    const stageAll = async () => { await run('git add -A'); refresh(); };
    const commit = async () => {
        if (!commitMsg.trim()) return;
        await run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
        setCommitMsg(''); refresh();
    };
    const push = async () => {
        setLoading(true);
        const out = await run('git push 2>&1');
        setError(out.includes('error') ? out : null);
        setLoading(false); refresh();
    };
    const pull = async () => {
        setLoading(true);
        const out = await run('git pull 2>&1');
        setError(out.includes('error') ? out : null);
        setLoading(false); refresh();
    };
    const showDiff = async (path: string) => {
        setSelectedFile(path);
        const d = await run(`git diff HEAD -- "${path}"`);
        setDiff(d || '(no diff)');
        setTab('diff');
    };

    const STATUS_COLOR: Record<string, string> = {
        'M': 'text-yellow-400', 'A': 'text-green-400', 'D': 'text-red-400',
        '?': 'text-slate-400', 'R': 'text-blue-400',
    };
    const STATUS_LABEL: Record<string, string> = {
        'M': 'Modified', 'A': 'Added', 'D': 'Deleted', '?': 'Untracked', 'R': 'Renamed',
    };

    if (!cwd) return (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            <div className="text-center"><FolderGit2 size={24} className="mx-auto mb-2" />Open a folder first</div>
        </div>
    );

    if (!isGitRepo) return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-3">
            <FolderGit2 size={32} className="text-slate-600" />
            <p>Not a Git repository</p>
            <button onClick={() => run('git init').then(refresh)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs transition-colors">
                Initialize Repository
            </button>
        </div>
    );

    const staged = files.filter(f => f.staged);
    const unstaged = files.filter(f => !f.staged);

    return (
        <div className="flex flex-col h-full text-white overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/5 bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-blue-400" />
                    <span className="text-sm font-medium">{branch}</span>
                    {loading && <RefreshCw size={12} className="animate-spin text-slate-500" />}
                </div>
                <div className="flex gap-1">
                    <button onClick={pull} title="Pull" className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Download size={13} /></button>
                    <button onClick={push} title="Push" className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Upload size={13} /></button>
                    <button onClick={refresh} className="p-1 hover:bg-white/10 rounded text-slate-400"><RefreshCw size={12} /></button>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 flex border-b border-white/5">
                {(['changes', 'history', 'diff'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-3 py-1.5 text-xs capitalize transition-colors border-b-2 ${tab === t ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}>
                        {t === 'changes' ? `Changes (${files.length})` : t === 'history' ? `History (${commits.length})` : 'Diff'}
                    </button>
                ))}
            </div>

            {error && (
                <div className="shrink-0 px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-red-300 text-xs flex gap-2">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" /><span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X size={10} /></button>
                </div>
            )}

            {/* Changes tab */}
            {tab === 'changes' && (
                <div className="flex-1 overflow-y-auto">
                    {/* Commit area */}
                    <div className="p-3 border-b border-white/5 space-y-2">
                        <textarea value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
                            placeholder="Commit message..."
                            rows={2}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none focus:border-blue-500/50 placeholder-slate-600"
                        />
                        <div className="flex gap-2">
                            <button onClick={stageAll} className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors">Stage All</button>
                            <button onClick={commit} disabled={!commitMsg.trim() || staged.length === 0}
                                className="flex-1 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs transition-colors disabled:opacity-40">
                                <span className="flex items-center justify-center gap-1"><GitCommit size={11} /> Commit ({staged.length})</span>
                            </button>
                        </div>
                    </div>

                    {/* Staged files */}
                    {staged.length > 0 && (
                        <div>
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Staged ({staged.length})</div>
                            {staged.map(f => (
                                <div key={f.path} className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 group cursor-pointer" onClick={() => showDiff(f.path)}>
                                    <span className={`text-[10px] font-bold w-4 ${STATUS_COLOR[f.status] || 'text-slate-400'}`}>{f.status}</span>
                                    <span className="text-xs text-slate-300 flex-1 truncate">{f.path}</span>
                                    <button onClick={e => { e.stopPropagation(); unstageFile(f.path); }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-yellow-400 text-slate-600"><Minus size={11} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Unstaged files */}
                    {unstaged.length > 0 && (
                        <div>
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Changes ({unstaged.length})</div>
                            {unstaged.map(f => (
                                <div key={f.path} className="flex items-center gap-2 px-3 py-1 hover:bg-white/5 group cursor-pointer" onClick={() => showDiff(f.path)}>
                                    <span className={`text-[10px] font-bold w-4 ${STATUS_COLOR[f.status] || 'text-slate-400'}`}>{f.status}</span>
                                    <span className="text-xs text-slate-300 flex-1 truncate">{f.path}</span>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                                        <button onClick={e => { e.stopPropagation(); stageFile(f.path); }} className="p-0.5 hover:text-green-400 text-slate-600"><Plus size={11} /></button>
                                        <button onClick={e => { e.stopPropagation(); discardFile(f.path); }} className="p-0.5 hover:text-red-400 text-slate-600"><X size={11} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {files.length === 0 && (
                        <div className="flex items-center justify-center py-8 text-slate-600 text-xs">
                            <Check size={14} className="mr-2 text-green-500" />Working tree clean
                        </div>
                    )}
                </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
                <div className="flex-1 overflow-y-auto">
                    {commits.map(c => (
                        <div key={c.hash} className="px-3 py-2.5 border-b border-white/5 hover:bg-white/5 cursor-pointer"
                            onClick={() => { run(`git show ${c.hash}`).then(d => { setDiff(d); setTab('diff'); }); }}>
                            <div className="flex items-center gap-2 mb-0.5">
                                <code className="text-blue-400 text-[10px] font-mono">{c.hash}</code>
                                <span className="text-[10px] text-slate-500 ml-auto">{c.date}</span>
                            </div>
                            <div className="text-xs text-slate-200 truncate">{c.message}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{c.author}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Diff tab */}
            {tab === 'diff' && (
                <div className="flex-1 overflow-auto bg-slate-950 p-3">
                    {selectedFile && <div className="text-xs text-slate-400 mb-2">{selectedFile}</div>}
                    <pre className="text-[11px] font-mono leading-5 whitespace-pre-wrap">
                        {diff.split('\n').map((line, i) => {
                            const color = line.startsWith('+') ? 'text-green-400' :
                                line.startsWith('-') ? 'text-red-400' :
                                line.startsWith('@') ? 'text-blue-400' : 'text-slate-300';
                            return <span key={i} className={color}>{line}{'\n'}</span>;
                        })}
                    </pre>
                </div>
            )}
        </div>
    );
}
