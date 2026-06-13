import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const TabButton: React.FC<Props> = ({ icon: Icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition-all duration-200
            ${isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
    >
        <Icon size={18} /> {label}
    </button>
);

export default TabButton;
