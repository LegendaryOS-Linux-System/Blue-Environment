import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ThemeDefinition } from '../../../../types';
import { SystemBridge, ThemeDefinition as SBThemeDefinition } from '../../../../utils/systemBridge';
import { useDialog } from '../../../../contexts/DialogContext';

const PRESET_ACCENTS = [
    { label: 'Blue',   accent: '#3b82f6', background: '#0f172a' },
    { label: 'Violet', accent: '#8b5cf6', background: '#1e1b2e' },
    { label: 'Emerald', accent: '#10b981', background: '#0f1f1a' },
    { label: 'Rose',   accent: '#f43f5e', background: '#1f0f17' },
    { label: 'Amber',  accent: '#f59e0b', background: '#1f1709' },
];

function toSBTheme(t: ThemeDefinition): SBThemeDefinition {
    return {
        id: t.id,
        name: t.name,
        colors: (t.colors ?? {}) as Record<string, string>,
        type: t.type,
        css: t.css,
    };
}

function fromSBTheme(t: SBThemeDefinition): ThemeDefinition {
    return {
        id: t.id,
        name: t.name,
        colors: t.colors,
        type: t.type,
        css: t.css,
    };
}

const PersonalizationSection: React.FC = () => {
    const [themes, setThemes] = useState<ThemeDefinition[]>([]);
    const dialog = useDialog();

    useEffect(() => {
        SystemBridge.getCustomThemes().then((ts: SBThemeDefinition[]) => setThemes(ts.map(fromSBTheme)));
    }, []);

    const handleSave = async (t: ThemeDefinition) => {
        await SystemBridge.saveCustomTheme(toSBTheme(t));
        setThemes(prev => {
            const idx = prev.findIndex(x => x.id === t.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = t; return n; }
            return [...prev, t];
        });
    };

    const handleDelete = async (id: string) => {
        await SystemBridge.deleteCustomTheme(id);
        setThemes(prev => prev.filter(t => t.id !== id));
    };

    const createTheme = async () => {
        const name = await dialog.prompt({
            title: 'New Theme',
            label: 'Give your custom theme a name.',
            placeholder: 'My Theme',
            confirmLabel: 'Next',
        });
        if (!name) return;

        // Simple inline accent picker via a follow-up confirm-style prompt:
        // pick from a small curated set of presets by typing its number.
        const list = PRESET_ACCENTS.map((p, i) => `${i + 1}. ${p.label}`).join('  ·  ');
        const choice = await dialog.prompt({
            title: 'Accent color',
            label: `Pick a palette: ${list}`,
            placeholder: '1',
            defaultValue: '1',
            confirmLabel: 'Create',
        });
        const idx = Math.min(Math.max(parseInt(choice || '1', 10) - 1, 0), PRESET_ACCENTS.length - 1);
        const preset = PRESET_ACCENTS[isNaN(idx) ? 0 : idx];

        const theme: ThemeDefinition = {
            id: `custom-${Date.now()}`,
            name,
            type: 'custom',
            colors: { accent: preset.accent, background: preset.background },
        };
        await handleSave(theme);
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Personalization</h2>
                <button
                    onClick={createTheme}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white transition-colors"
                >
                    <Plus size={13} /> New Theme
                </button>
            </div>
            <div className="space-y-2">
                {themes.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 border border-white/5">
                        <span className="flex items-center gap-2 text-sm text-white">
                            {t.colors?.accent && (
                                <span className="w-3 h-3 rounded-full inline-block" style={{ background: t.colors.accent }} />
                            )}
                            {t.name}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSave(t)}
                                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded-lg"
                            >
                                Apply
                            </button>
                            <button
                                onClick={() => handleDelete(t.id)}
                                className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
                {themes.length === 0 && (
                    <p className="text-slate-500 text-sm">No custom themes yet — create one above.</p>
                )}
            </div>
        </div>
    );
};

export default PersonalizationSection;
