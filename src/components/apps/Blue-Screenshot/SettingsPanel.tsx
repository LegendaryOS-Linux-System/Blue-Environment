import React from 'react';
import { FolderOpen, Volume2, VolumeX, MousePointer, Copy } from 'lucide-react';
import type { ScreenshotSettings, OutputFormat } from './types';
import { SystemBridge } from '../../../utils/systemBridge';

interface Props {
    settings: ScreenshotSettings;
    onChange: (patch: Partial<ScreenshotSettings>) => void;
}

const SettingsPanel: React.FC<Props> = ({ settings, onChange }) => (
    <div className="space-y-4 p-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Settings</h3>

        {/* Format */}
        <div>
            <label className="block text-xs text-slate-500 mb-1.5">Format</label>
            <div className="flex gap-2">
                {(['png', 'jpg', 'webp'] as OutputFormat[]).map(fmt => (
                    <button key={fmt}
                        onClick={() => onChange({ format: fmt })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors uppercase
                            ${settings.format === fmt
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`}>
                        {fmt}
                    </button>
                ))}
            </div>
        </div>

        {/* Quality (JPG/WebP only) */}
        {settings.format !== 'png' && (
            <div>
                <label className="block text-xs text-slate-500 mb-1.5">
                    Quality: {settings.quality}%
                </label>
                <input type="range" min="1" max="100" value={settings.quality}
                    onChange={e => onChange({ quality: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
            </div>
        )}

        {/* Delay */}
        <div>
            <label className="block text-xs text-slate-500 mb-1.5">Delay (seconds)</label>
            <div className="flex gap-1.5">
                {[0, 2, 5, 10].map(d => (
                    <button key={d}
                        onClick={() => onChange({ delay: d })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                            ${settings.delay === d
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`}>
                        {d === 0 ? 'Now' : `${d}s`}
                    </button>
                ))}
            </div>
        </div>

        {/* Save path */}
        <div>
            <label className="block text-xs text-slate-500 mb-1.5">Save to</label>
            <div className="flex gap-2">
                <input type="text" value={settings.savePath}
                    onChange={e => onChange({ savePath: e.target.value })}
                    className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50" />
                <button
                    onClick={async () => {
                        const path = await SystemBridge.pickDirectory();
                        if (path) onChange({ savePath: path });
                    }}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg">
                    <FolderOpen size={14} />
                </button>
            </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-white/5">
            {[
                { key: 'showCursor',       label: 'Include cursor',    icon: MousePointer },
                { key: 'copyToClipboard',  label: 'Copy to clipboard', icon: Copy },
                { key: 'playSoundEffect',  label: 'Sound effect',      icon: Volume2 },
            ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Icon size={14} className="text-slate-500" /> {label}
                    </div>
                    <button
                        onClick={() => onChange({ [key]: !(settings as any)[key] })}
                        className={`w-10 h-5 rounded-full transition-colors relative
                            ${(settings as any)[key] ? 'bg-blue-600' : 'bg-slate-600'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform
                            ${(settings as any)[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
            ))}
        </div>
    </div>
);

export default SettingsPanel;
