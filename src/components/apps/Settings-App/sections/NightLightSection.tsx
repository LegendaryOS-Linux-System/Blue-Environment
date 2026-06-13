import React from 'react';
import type { UserConfig } from '../../../../types';
import { applyNightLight } from '../display_helpers';

interface Props { config: UserConfig; onSave: (p: Partial<UserConfig>) => Promise<void>; }

const NightLightSection: React.FC<Props> = ({ config, onSave }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <h2 className="text-2xl font-bold text-white">Night Light</h2>
        <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-slate-400">Night Light</label>
                <input type="checkbox" checked={config.nightLightEnabled ?? false}
                    onChange={async e => {
                        const v = e.target.checked;
                        await onSave({ nightLightEnabled: v });
                        await applyNightLight(v, config.nightLightTemperature ?? 4000);
                    }}
                    className="w-4 h-4 accent-blue-500" />
            </div>
            {config.nightLightEnabled && (
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Color Temperature (K)</label>
                    <input type="range" min="1000" max="10000" step="100"
                        value={config.nightLightTemperature ?? 4000}
                        onChange={async e => {
                            const v = parseInt(e.target.value);
                            await onSave({ nightLightTemperature: v });
                            await applyNightLight(true, v);
                        }}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-400" />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>🕯️ 1000K</span>
                        <span>{config.nightLightTemperature ?? 4000}K</span>
                        <span>☀️ 10000K</span>
                    </div>
                </div>
            )}
        </div>
    </div>
);
export default NightLightSection;
