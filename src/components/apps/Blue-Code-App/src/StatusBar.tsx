import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
    languageLabel: string;
    line: number;
    col: number;
    errors: number;
    warnings: number;
    editorTheme: string;
    onToggleTheme: () => void;
    fontSize: number;
    onFontSizeChange: (fn: (s: number) => number) => void;
}

const StatusBar: React.FC<Props> = ({
    languageLabel, line, col, errors, warnings,
    editorTheme, onToggleTheme, fontSize, onFontSizeChange,
}) => (
    <div className="h-6 bg-slate-800 border-t border-white/5 flex items-center px-3 gap-4 text-[11px] text-slate-500 shrink-0">
        <span>{languageLabel}</span>
        <span>Ln {line}, Col {col}</span>
        {errors > 0 && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {errors}</span>}
        {warnings > 0 && <span className="text-yellow-400 flex items-center gap-1"><AlertCircle size={11} /> {warnings}</span>}
        <div className="flex-1" />
        <button onClick={onToggleTheme} className="hover:text-white">{editorTheme === 'blue-dark' ? '🌙' : '☀️'}</button>
        <button onClick={() => onFontSizeChange(s => Math.max(10, s - 1))} className="hover:text-white">A-</button>
        <span>{fontSize}px</span>
        <button onClick={() => onFontSizeChange(s => Math.min(24, s + 1))} className="hover:text-white">A+</button>
    </div>
);

export default StatusBar;
