import React, { useEffect, useState } from 'react';
import {
    Cpu, CircuitBoard, Network, HardDrive, Activity,
    ChevronUp, ChevronDown, Search, X, RefreshCw
} from 'lucide-react';
import { AppProps } from '../../../types';
import { SystemBridge } from '../../../utils/systemBridge';
import { ProcessEntry, HistPoint, MonitorTab, SortKey, MAX_HISTORY } from './src/types';
import Sparkline from './src/Sparkline';

const SystemMonitorApp: React.FC<AppProps> = () => {
    const [stats,   setStats]   = useState<any>(null);
    const [procs,   setProcs]   = useState<ProcessEntry[]>([]);
    const [cpu,     setCpu]     = useState<HistPoint[]>([]);
    const [ram,     setRam]     = useState<HistPoint[]>([]);
    const [net,     setNet]     = useState<HistPoint[]>([]);
    const [disk,    setDisk]    = useState<HistPoint[]>([]);
    const [tab,     setTab]     = useState<MonitorTab>('overview');
    const [sort,    setSort]    = useState<SortKey>('cpu');
    const [asc,     setAsc]     = useState(false);
    const [q,       setQ]       = useState('');
    const [killing, setKilling] = useState<string | null>(null);
    const [sel,     setSel]     = useState<string | null>(null);

    const push = (arr: HistPoint[], v: number): HistPoint[] =>
        [...arr.slice(-MAX_HISTORY + 1), { t: Date.now(), v }];

    useEffect(() => {
        const tick = async () => {
            const [s, p] = await Promise.all([
                SystemBridge.getSystemStats(),
                SystemBridge.getProcesses(),
            ]);
            setStats(s); setProcs(p || []);
            setCpu(h  => push(h,  s.cpu));
            setRam(h  => push(h,  s.ram));
            setNet(h  => push(h,  s.netRx ?? 0));
            setDisk(h => push(h,  s.diskRead ?? 0));
        };
        tick();
        const id = setInterval(tick, 2000);
        return () => clearInterval(id);
    }, []);

    const killProc = async (pid: string) => {
        setKilling(pid);
        await SystemBridge.executeCommand(`kill -9 ${pid}`).catch(() => {});
        setProcs(p => p.filter(x => x.pid !== pid));
        if (sel === pid) setSel(null);
        setKilling(null);
    };

    const toggleSort = (k: SortKey) => {
        if (sort === k) setAsc(a => !a); else { setSort(k); setAsc(false); }
    };

    const sorted = [...procs]
        .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.pid.includes(q))
        .sort((a, b) => {
            const v = sort === 'cpu'    ? a.cpu    - b.cpu
                    : sort === 'memory' ? a.memory - b.memory
                    : sort === 'name'   ? a.name.localeCompare(b.name)
                    : parseInt(a.pid)   - parseInt(b.pid);
            return asc ? v : -v;
        });

    // ── Sub-components (defined inside to share state via closure) ─────────

    const Th = ({ k, label, cls = '' }: { k: SortKey; label: string; cls?: string }) => (
        <th onClick={() => toggleSort(k)} className={`py-2 cursor-pointer hover:text-white select-none ${cls}`}>
            <span className="inline-flex items-center gap-0.5">
                {label}
                {sort === k ? (asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}
            </span>
        </th>
    );

    const StatCard = ({ icon: Icon, label, val, pct, hist, color }: any) => (
        <div className="bg-slate-800 rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '25' }}>
                        <Icon size={14} style={{ color }} />
                    </div>
                    <span className="text-xs text-slate-400">{label}</span>
                </div>
                <span className="text-base font-bold">{val}</span>
            </div>
            <Sparkline data={hist} color={color} h={36} />
            <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
            </div>
        </div>
    );

    const TABS: { id: MonitorTab; label: string }[] = [
        { id: 'overview',  label: 'Overview' },
        { id: 'processes', label: `Processes (${procs.length})` },
        { id: 'resources', label: 'Resources' },
    ];

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
            {/* Tab bar */}
            <div className="shrink-0 flex border-b border-white/5 bg-slate-800/50">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                            tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        {t.label}
                    </button>
                ))}
                <div className="ml-auto flex items-center pr-3 gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-slate-500">Live</span>
                </div>
            </div>

            {/* Overview */}
            {tab === 'overview' && stats && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard icon={Cpu}          label="CPU"      val={`${stats.cpu.toFixed(1)}%`}  pct={stats.cpu} hist={cpu}  color="#3b82f6" />
                        <StatCard icon={CircuitBoard}  label="Memory"   val={`${stats.ram.toFixed(1)}%`}  pct={stats.ram} hist={ram}  color="#8b5cf6" />
                        <StatCard icon={Network}       label="Network"  val={`${(net.slice(-1)[0]?.v ?? 0).toFixed(1)} MB/s`}  pct={Math.min((net.slice(-1)[0]?.v ?? 0) * 12, 100)}  hist={net}  color="#10b981" />
                        <StatCard icon={HardDrive}     label="Disk I/O" val={`${(disk.slice(-1)[0]?.v ?? 0).toFixed(1)} MB/s`} pct={Math.min((disk.slice(-1)[0]?.v ?? 0) * 30, 100)} hist={disk} color="#f59e0b" />
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-white/5 overflow-hidden">
                        {[
                            ['Kernel',           stats.kernel || '—'],
                            ['Session',          stats.sessionType || 'Wayland'],
                            ['Battery',          stats.battery > 0 ? `${stats.battery.toFixed(0)}%${stats.isCharging ? ' ⚡' : ''}` : 'N/A'],
                            ['Volume',           `${stats.volume ?? 0}%`],
                            ['Brightness',       `${stats.brightness ?? 100}%`],
                            ['Wi-Fi',            stats.wifiSSID || 'Disconnected'],
                            ['Total Processes',  `${procs.length}`],
                        ].map(([l, v]) => (
                            <div key={l} className="flex justify-between px-4 py-2 text-sm border-b border-white/5 last:border-0">
                                <span className="text-slate-400">{l}</span>
                                <span className="text-white text-xs font-mono">{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Processes */}
            {tab === 'processes' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-slate-800/30">
                        <div className="relative flex-1">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
                                className="w-full bg-slate-800 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none" />
                        </div>
                        {sel && (
                            <button onClick={() => killProc(sel)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm">
                                <X size={12} /> Kill
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-800 z-10 text-slate-400 text-xs">
                                <tr>
                                    <Th k="name"   label="Name"   cls="text-left pl-3" />
                                    <Th k="pid"    label="PID"    cls="text-right" />
                                    <Th k="cpu"    label="CPU%"   cls="text-right" />
                                    <Th k="memory" label="Memory" cls="text-right pr-3" />
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(p => {
                                    const mb = (p.memory / 1024 / 1024).toFixed(1);
                                    const isSel = sel === p.pid;
                                    return (
                                        <tr key={p.pid} onClick={() => setSel(isSel ? null : p.pid)}
                                            className={`border-b border-white/5 cursor-pointer transition-colors ${isSel ? 'bg-blue-600/20' : 'hover:bg-white/5'}`}>
                                            <td className="py-1.5 pl-3 text-xs font-mono text-blue-300 max-w-[180px] truncate">{p.name}</td>
                                            <td className="py-1.5 text-right text-xs text-slate-500 pr-2">{p.pid}</td>
                                            <td className={`py-1.5 text-right text-xs pr-2 ${p.cpu > 50 ? 'text-red-400' : p.cpu > 20 ? 'text-yellow-400' : 'text-slate-300'}`}>{p.cpu.toFixed(1)}%</td>
                                            <td className="py-1.5 text-right text-xs pr-3 text-slate-300">{mb} MB</td>
                                            <td className="py-1.5 pr-2">
                                                <button onClick={e => { e.stopPropagation(); killProc(p.pid); }}
                                                    className="hover:text-red-400 text-slate-700 transition-colors">
                                                    {killing === p.pid ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {stats && (
                        <div className="shrink-0 border-t border-white/5 px-4 py-1.5 bg-slate-800/30 flex gap-5 text-xs text-slate-400">
                            <span>CPU: <b className="text-white">{stats.cpu.toFixed(1)}%</b></span>
                            <span>RAM: <b className="text-white">{stats.ram.toFixed(1)}%</b></span>
                            <span>{sorted.length} processes shown</span>
                        </div>
                    )}
                </div>
            )}

            {/* Resources */}
            {tab === 'resources' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {[
                        { label: 'CPU Usage',    data: cpu,  color: '#3b82f6', unit: '%'     },
                        { label: 'Memory Usage', data: ram,  color: '#8b5cf6', unit: '%'     },
                        { label: 'Network I/O',  data: net,  color: '#10b981', unit: 'MB/s'  },
                        { label: 'Disk I/O',     data: disk, color: '#f59e0b', unit: 'MB/s'  },
                    ].map(({ label, data, color, unit }) => {
                        const last = data.slice(-1)[0]?.v ?? 0;
                        const max  = Math.max(...data.map(d => d.v), 1);
                        return (
                            <div key={label} className="bg-slate-800 rounded-xl p-4 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-slate-300">{label} (60s)</span>
                                    <span className="text-sm font-bold" style={{ color }}>{last.toFixed(1)} {unit}</span>
                                </div>
                                <Sparkline data={data} color={color} h={60} />
                                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                                    <span>0 {unit}</span><span>{max.toFixed(1)} {unit}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!stats && (
                <div className="flex-1 flex items-center justify-center">
                    <Activity size={24} className="animate-spin text-blue-400" />
                </div>
            )}
        </div>
    );
};

export default SystemMonitorApp;
