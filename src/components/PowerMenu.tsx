import React, { useState } from 'react';
import { Power, RefreshCcw, Moon, HardDrive, X } from 'lucide-react';
import type { PowerAction } from '../types';

interface PowerMenuProps {
    onAction: (action: PowerAction) => void;
    onClose: () => void;
}

const ACTIONS = [
    { action: 'shutdown'  as PowerAction, label: 'Shut Down', Icon: Power,     color: '#ef4444', glow: 'rgba(239,68,68,0.3)',   description: 'Power off the system' },
    { action: 'reboot'    as PowerAction, label: 'Restart',   Icon: RefreshCcw, color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',  description: 'Reboot the system' },
    { action: 'suspend'   as PowerAction, label: 'Suspend',   Icon: Moon,       color: '#3b82f6', glow: 'rgba(59,130,246,0.3)',  description: 'Sleep — resume quickly' },
    { action: 'hibernate' as PowerAction, label: 'Hibernate', Icon: HardDrive,  color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)', description: 'Save state to disk' },
] as const;

export const PowerMenu: React.FC<PowerMenuProps> = ({ onAction, onClose }) => {
    const [confirming, setConfirming] = useState<PowerAction | null>(null);
    const [countdown, setCountdown] = useState(5);

    const handleSelect = (action: PowerAction) => {
        setConfirming(action);
        setCountdown(5);
        const id = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(id); onAction(action); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const selected = ACTIONS.find(a => a.action === confirming);

    return (
        <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(2,8,18,0.8)', backdropFilter: 'blur(20px)' }}
        onClick={onClose}
        >
        <div
        className="relative glass-card rounded-3xl p-8 w-96 animate-scale-in"
        onClick={e => e.stopPropagation()}
        style={{ border: '1px solid rgba(59,130,246,0.2)' }}
        >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bedm-btn-ghost rounded-xl">
        <X size={16} />
        </button>

        {confirming && selected ? (
            <div className="text-center">
            <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: `radial-gradient(circle, ${selected.glow} 0%, transparent 70%)`, border: `2px solid ${selected.color}30` }}
            >
            <selected.Icon size={36} style={{ color: selected.color, filter: `drop-shadow(0 0 8px ${selected.color})` }} />
            </div>
            <div className="text-6xl font-light tabular-nums mb-2" style={{ fontFamily: '"Oxanium", monospace', color: selected.color }}>
            {countdown}
            </div>
            <p className="text-slate-300 mb-1 text-lg">{selected.label}ing…</p>
            <p className="text-slate-500 text-sm mb-8">{selected.description}</p>
            <button onClick={() => setConfirming(null)} className="bedm-btn-ghost px-8 py-3 rounded-xl text-sm font-medium">
            Cancel
            </button>
            </div>
        ) : (
            <>
            <h2 className="text-center text-white mb-2" style={{ fontFamily: '"Oxanium", monospace', fontSize: '1.25rem', fontWeight: 400 }}>
            Power Options
            </h2>
            <p className="text-center text-slate-500 text-sm mb-8">Choose an action</p>
            <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map(({ action, label, Icon, color, glow, description }) => (
                <button
                key={action}
                onClick={() => handleSelect(action)}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200"
                style={{ background: 'rgba(8,20,45,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.background = `rgba(${color.slice(1).match(/../g)!.map(x=>parseInt(x,16)).join(',')},0.08)`;
                    el.style.borderColor = `${color}40`;
                    el.style.boxShadow = `0 0 24px ${glow}`;
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.background = 'rgba(8,20,45,0.6)';
                    el.style.borderColor = 'rgba(255,255,255,0.06)';
                    el.style.boxShadow = 'none';
                }}
                >
                <Icon size={28} className="text-slate-500 group-hover:scale-110 transition-all" style={{ transition: 'color 0.2s, transform 0.2s' }} />
                <div>
                <div className="text-slate-300 text-sm font-medium group-hover:text-white transition-colors">{label}</div>
                <div className="text-slate-600 text-xs mt-0.5">{description}</div>
                </div>
                </button>
            ))}
            </div>
            </>
        )}
        </div>
        </div>
    );
};
