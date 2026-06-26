import React, { useEffect, useState } from 'react';
import { Info, ExternalLink } from 'lucide-react';
import { SystemBridge } from '../../../../utils/systemBridge';

interface DistroInfo { Name?: string; Version?: string; Copyright?: string; [key: string]: any; }

const AboutSection: React.FC = () => {
    const [distro, setDistro] = useState<DistroInfo>({});
    const [username, setUsername] = useState('');

    useEffect(() => {
        SystemBridge.getDistroInfo().then(setDistro).catch(() => {});
        try { setUsername(SystemBridge.getUsername()); } catch {}
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-2xl font-bold text-white">About</h2>
            <div className="bg-slate-800 p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Info size={24} className="text-white" />
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-white">{distro.Name || 'Blue Environment'}</div>
                        <div className="text-sm text-slate-400">Version {distro.Version || '0.6'}</div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pt-2">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-slate-500 text-xs mb-1">Signed in as</div>
                        <div className="font-medium text-white">{username || 'unknown'}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-slate-500 text-xs mb-1">Shell</div>
                        <div className="font-medium text-white">Blue Shell</div>
                    </div>
                </div>
                {distro.Copyright && (
                    <p className="text-xs text-slate-500 pt-2">{distro.Copyright}</p>
                )}
                <a
                    href="https://github.com/LegendaryOS-Linux-System/Blue-Environment"
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                    Project page <ExternalLink size={11} />
                </a>
            </div>
        </div>
    );
};

export default AboutSection;
