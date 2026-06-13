import React, { useState } from 'react';
import { Palette, Droplet, Plus, Check, Trash2, Save } from 'lucide-react';
import type { UserConfig, ThemeDefinition } from '../../../../types';
import { SystemBridge } from '../../../../utils/systemBridge';

const BUILTIN_THEMES: Record<string, ThemeDefinition> = {
    'blue-default': { id: 'blue-default', name: 'Blue Glass',  type: 'builtin', colors: { primary: '#0f172a', secondary: '#1e293b', text: '#f1f5f9', accent: '#2563eb' } },
    'cyberpunk':    { id: 'cyberpunk',    name: 'Cyberpunk',   type: 'builtin', colors: { primary: '#09090b', secondary: '#18181b', text: '#e4e4e7', accent: '#eab308' } },
    'dracula':      { id: 'dracula',      name: 'Dracula',     type: 'builtin', colors: { primary: '#282a36', secondary: '#44475a', text: '#f8f8f2', accent: '#bd93f9' } },
    'light-glass':  { id: 'light-glass',  name: 'Light Glass', type: 'builtin', colors: { primary: '#e2e8f0', secondary: '#ffffff', text: '#0f172a', accent: '#0ea5e9' } },
};

interface Props {
    config: UserConfig;
    onSave: (patch: Partial<UserConfig>) => Promise<void>;
    customThemes: ThemeDefinition[];
    setCustomThemes: (t: ThemeDefinition[]) => void;
    applyTheme: (id: string) => void;
}

const PersonalizationSection: React.FC<Props> = ({ config, onSave, customThemes, setCustomThemes, applyTheme }) => {
    const [showEditor, setShowEditor] = useState(false);
    const [themeName, setThemeName] = useState('');
    const [themeCss,  setThemeCss]  = useState('');

    const saveCustom = async () => {
        if (!themeName.trim()) return;
        const t: ThemeDefinition = {
            id: `custom-${Date.now()}`, name: themeName, type: 'custom', css: themeCss,
            colors: { primary: '#1a1a1a', secondary: '#2a2a2a', text: '#fff', accent: '#f60' },
        };
        await SystemBridge.saveCustomTheme(t);
        setCustomThemes([...customThemes, t]);
        setShowEditor(false); setThemeName(''); setThemeCss('');
    };

    const deleteCustom = async (id: string) => {
        await SystemBridge.deleteCustomTheme(id);
        setCustomThemes(customThemes.filter(t => t.id !== id));
        if (config.themeName === id) onSave({ themeName: 'blue-default' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-2xl font-bold text-white">Personalization</h2>

            <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
                <label className="block text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                    <Palette size={16} className="text-purple-400" /> Built-in Themes
                </label>
                <div className="grid grid-cols-2 gap-4">
                    {Object.values(BUILTIN_THEMES).map(theme => (
                        <button key={theme.id}
                            onClick={() => { onSave({ themeName: theme.id }); applyTheme(theme.id); }}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                                ${config.themeName === theme.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-white/5 hover:bg-slate-700'}`}>
                            <div className="w-12 h-12 rounded-lg" style={{ background: theme.colors?.primary }} />
                            <div className="text-left">
                                <div className="font-bold text-white">{theme.name}</div>
                                <div className="text-xs text-slate-400">Accent: {theme.colors?.accent}</div>
                            </div>
                            {config.themeName === theme.id && <Check size={20} className="ml-auto text-blue-400" />}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Droplet size={16} className="text-pink-400" /> Custom Themes
                    </label>
                    <button onClick={() => setShowEditor(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2">
                        <Plus size={14} /> Add Theme
                    </button>
                </div>
                {customThemes.length === 0
                    ? <div className="text-center py-6 text-slate-500 text-sm">No custom themes yet</div>
                    : <div className="space-y-2">
                        {customThemes.map(theme => (
                            <div key={theme.id}
                                className={`flex items-center justify-between p-3 rounded-xl border
                                    ${config.themeName === theme.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-white/5'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded" style={{ background: theme.colors?.primary }} />
                                    <div>
                                        <div className="font-medium text-white">{theme.name}</div>
                                        <div className="text-xs text-slate-400">Custom CSS</div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { onSave({ themeName: theme.id }); applyTheme(theme.id); }}
                                        className={`p-2 rounded-lg ${config.themeName === theme.id ? 'text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                        <Check size={16} />
                                    </button>
                                    <button onClick={() => deleteCustom(theme.id)}
                                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                }
            </div>

            {showEditor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-2xl p-6 w-96 border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4">New CSS Theme</h3>
                        <input type="text" placeholder="Theme name" value={themeName}
                            onChange={e => setThemeName(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white mb-4 focus:outline-none" />
                        <textarea placeholder={`:root {\n  --bg-primary: #1a1a1a;\n}`}
                            value={themeCss} onChange={e => setThemeCss(e.target.value)} rows={6}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none" />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowEditor(false)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Cancel</button>
                            <button onClick={saveCustom}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2">
                                <Save size={14} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalizationSection;
