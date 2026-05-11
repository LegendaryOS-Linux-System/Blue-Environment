import React, { useEffect, useState } from 'react';
import { Activity, Cpu, CircuitBoard } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const SystemMonitorApp: React.FC<AppProps> = () => {
    const [stats, setStats] = useState<any>(null);
    const [processes, setProcesses] = useState<any[]>([]);
    useEffect(() => {
        const fetch = async () => { setStats(await SystemBridge.getSystemStats()); setProcesses(await SystemBridge.getProcesses()); };
        fetch();
        const i = setInterval(fetch, 2000);
        return () => clearInterval(i);
    }, []);
    if (!stats) return <div className="p-4 text-white flex items-center gap-2"><Activity size={16} className="animate-spin" /> Loading...</div>;
    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100">
            <div className="p-4 grid grid-cols-3 gap-4 bg-slate-800/50 border-b border-white/5">
                {[
                    { icon: Cpu, color: 'blue', label: 'CPU', value: `${stats.cpu.toFixed(1)}%` },
                    { icon: CircuitBoard, color: 'purple', label: 'Memory', value: `${stats.ram.toFixed(1)}%` },
                    { icon: Activity, color: 'green', label: 'Kernel', value: stats.kernel?.split('-')[0] || 'N/A' },
                ].map(({ icon: Icon, color, label, value }) => (
                    <div key={label} className="bg-slate-800 p-4 rounded-xl border border-white/5 flex items-center gap-4">
                        <div className={`p-3 rounded-full bg-${color}-500/20 text-${color}-400`}><Icon size={24} /></div>
                        <div><div className="text-xs text-slate-400">{label}</div><div className="text-xl font-bold truncate max-w-[100px]">{value}</div></div>
                    </div>
                ))}
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800 sticky top-0">
                        <tr>{['Name','PID','CPU','Memory'].map(h => <th key={h} className="p-3 font-medium text-slate-400">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {processes.map(p => (
                            <tr key={p.pid} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-3 font-mono text-blue-300">{p.name}</td>
                                <td className="p-3 text-slate-500">{p.pid}</td>
                                <td className="p-3">{p.cpu.toFixed(1)}%</td>
                                <td className="p-3">{(p.memory / 1024 / 1024).toFixed(1)} MB</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default SystemMonitorApp;
