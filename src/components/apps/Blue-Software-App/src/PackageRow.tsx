import React from 'react';
import { Package, Loader2 } from 'lucide-react';
import { PackageInfo, SoftwareTab } from './types';
import { sourceBadge } from './PackageCard';

interface Props {
    pkg:        PackageInfo;
    tab:        SoftwareTab;
    busy:       boolean;
    onAction:   (pkg: PackageInfo, action: 'install' | 'remove' | 'update') => void;
}

const PackageRow: React.FC<Props> = ({ pkg, tab, busy, onAction }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-800/40 hover:bg-slate-800/70 rounded-xl border border-white/5 transition-colors">
        <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
            {pkg.icon
                ? <img src={pkg.icon} alt="" className="w-7 h-7 object-contain" onError={e => ((e.target as HTMLElement).style.display = 'none')} />
                : <Package size={18} className="text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white text-sm">{pkg.name}</span>
                {sourceBadge(pkg.source)}
                <span className="text-[10px] text-slate-500">{pkg.version}</span>
                {pkg.update_available && <span className="text-[10px] text-orange-400">● update</span>}
            </div>
            <div className="text-xs text-slate-500 truncate">{pkg.description}</div>
        </div>
        <div className="shrink-0">
            {tab === 'available' && (
                <button onClick={() => onAction(pkg, 'install')} disabled={busy}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs disabled:opacity-50 flex items-center gap-1">
                    {busy && <Loader2 size={11} className="animate-spin" />} Install
                </button>
            )}
            {tab === 'installed' && (
                <button onClick={() => onAction(pkg, 'remove')} disabled={busy}
                    className="px-3 py-1 bg-red-600/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs disabled:opacity-50">
                    Remove
                </button>
            )}
            {tab === 'updates' && (
                <button onClick={() => onAction(pkg, 'update')} disabled={busy}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-xs disabled:opacity-50 flex items-center gap-1">
                    {busy && <Loader2 size={11} className="animate-spin" />} Update
                </button>
            )}
        </div>
    </div>
);

export default PackageRow;
