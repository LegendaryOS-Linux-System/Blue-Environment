import React, { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    Monitor, Palette, Globe, Moon, Package, Tv2, Printer as PrinterIcon,
    Users, User, Info, Battery, PanelBottom, RefreshCw,
    Wifi as WifiIcon, Bluetooth as BluetoothIcon,
} from 'lucide-react';
import type { AppProps, UserConfig, ThemeDefinition } from '../../../types';
import { SystemBridge } from '../../../utils/systemBridge';
import { useLanguage } from '../../../contexts/LanguageContext';
import { configStore } from '../../../utils/configStore';
import { MonitorsSection, PrintersSection, UsersSection } from '../../SettingsSections';
import AboutApp from '../AboutApp';

import TabButton from './TabButton';
import DisplaySection      from './sections/DisplaySection';
import PersonalizationSection from './sections/PersonalizationSection';
import WifiSection         from './sections/WifiSection';
import BluetoothSection    from './sections/BluetoothSection';
import PowerSection        from './sections/PowerSection';
import NightLightSection   from './sections/NightLightSection';
import AppsSection         from './sections/AppsSection';
import AccountsSection     from './sections/AccountsSection';
import { getAvailableModes, getCurrentResolution, getCurrentRefreshRate } from './display_helpers';

const SettingsApp: React.FC<AppProps> = () => {
    const { language, setLanguage } = useLanguage();
    const [config,   setConfig]   = useState<UserConfig | null>(null);
    const [tab,      setTab]      = useState('display');
    const [customThemes, setCustomThemes] = useState<ThemeDefinition[]>([]);
    const [wallpapers,   setWallpapers]   = useState<string[]>([]);
    const [wallpaperPreviews, setWallpaperPreviews] = useState<Map<string,string>>(new Map());
    const [brightness,   setBrightness]   = useState(80);
    const [resolution,   setResolution]   = useState('1920x1080');
    const [refreshRate,  setRefreshRate]  = useState(60);
    const [availModes,   setAvailModes]   = useState<{resolution:string;rates:number[]}[]>([]);

    useEffect(() => {
        configStore.init().then((cfg: UserConfig) => setConfig(cfg));
        loadWallpapers();
        SystemBridge.getCustomThemes().then(setCustomThemes);
        Promise.all([getCurrentResolution(), getCurrentRefreshRate(), getAvailableModes()])
            .then(([res, rate, modes]) => { setResolution(res); setRefreshRate(rate); setAvailModes(modes); });
        const handler = (e: CustomEvent) => setTab(e.detail);
        window.addEventListener('blue:settings-tab', handler as EventListener);
        return () => window.removeEventListener('blue:settings-tab', handler as EventListener);
    }, []);

    const loadWallpapers = async () => {
        const wps = await SystemBridge.getWallpapers();
        setWallpapers(wps);
        const previews = new Map<string,string>();
        for (let i = 0; i < Math.min(wps.length, 12); i++) {
            const p = await SystemBridge.getWallpaperPreview(wps[i]);
            if (p) previews.set(wps[i], p);
        }
        setWallpaperPreviews(new Map(previews));
    };

    const handleSave = async (patch: Partial<UserConfig>) => {
        if (!config) return;
        await configStore.update(patch);
        setConfig({ ...config, ...patch });
    };

    const applyTheme = (id: string) => {
        document.documentElement.setAttribute('data-theme', id);
        const custom = customThemes.find(t => t.id === id);
        if (custom?.css) {
            let s = document.getElementById('custom-theme-style');
            if (!s) { s = document.createElement('style'); s.id='custom-theme-style'; document.head.appendChild(s); }
            s.innerHTML = custom.css;
        } else {
            document.getElementById('custom-theme-style')?.remove();
        }
    };

    if (!config) return (
        <div className="h-full flex items-center justify-center text-slate-400">
            <RefreshCw className="animate-spin mr-2" size={20} /> Loading settings…
        </div>
    );

    const resolutionList = availModes.length > 0
        ? availModes.map(m => m.resolution)
        : ['1920x1080','2560x1440','3840x2160','1366x768'];
    const rateList = availModes.find(m => m.resolution === resolution)?.rates ?? [60,75,120,144];

    const TABS: [LucideIcon, string, string][] = [
        [Monitor,      'Display',         'display'],
        [Palette,      'Personalization', 'personalization'],
        [WifiIcon,     'Wi-Fi',           'wifi'],
        [BluetoothIcon,'Bluetooth',       'bluetooth'],
        [Battery,      'Power',           'power'],
        [PanelBottom,  'Panel',           'panel'],
        [Globe,        'Language',        'language'],
        [Moon,         'Night Light',     'nightLight'],
        [Package,      'Applications',    'apps'],
        [Tv2,          'Monitors',        'monitors'],
        [PrinterIcon,  'Printers',        'printers'],
        [Users,        'Users',           'users'],
        [User,         'Accounts',        'accounts'],
        [Info,         'About',           'about'],
    ];

    const renderContent = () => {
        switch (tab) {
            case 'display': return (
                <DisplaySection
                    config={config} onSave={handleSave}
                    wallpapers={wallpapers} wallpaperPreviews={wallpaperPreviews}
                    onReloadWallpapers={loadWallpapers}
                    brightness={brightness} onBrightnessChange={setBrightness}
                    resolution={resolution} onResolutionChange={setResolution}
                    refreshRate={refreshRate} onRefreshRateChange={setRefreshRate}
                    resolutionList={resolutionList} rateList={rateList}
                />
            );
            case 'personalization': return (
                <PersonalizationSection
                    config={config} onSave={handleSave}
                    customThemes={customThemes} setCustomThemes={setCustomThemes}
                    applyTheme={applyTheme}
                />
            );
            case 'wifi':       return <WifiSection />;
            case 'bluetooth':  return <BluetoothSection />;
            case 'power':      return <PowerSection />;
            case 'nightLight': return <NightLightSection config={config} onSave={handleSave} />;
            case 'apps':       return <AppsSection config={config} onSave={handleSave} />;
            case 'accounts':   return <AccountsSection config={config} onSave={handleSave} />;
            case 'panel': return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold text-white">Panel</h2>
                    <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-sm font-medium text-slate-400">Enable Panel</label>
                            <input type="checkbox" checked={config.panelEnabled ?? true}
                                onChange={async e => { const v=e.target.checked; handleSave({panelEnabled:v}); await SystemBridge.setPanelEnabled(v); }}
                                className="w-4 h-4 accent-blue-500" />
                        </div>
                        {(config.panelEnabled ?? true) && (
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Position</label>
                                <select value={config.panelPosition ?? 'bottom'}
                                    onChange={e => handleSave({panelPosition: e.target.value as any})}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none">
                                    <option value="top">Top</option>
                                    <option value="bottom">Bottom</option>
                                    <option value="left">Left</option>
                                    <option value="right">Right</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            );
            case 'language': return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold text-white">Language</h2>
                    <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Select language</label>
                        <select value={language} onChange={e => setLanguage(e.target.value as 'en'|'pl')}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none">
                            <option value="en">English</option>
                            <option value="pl">Polski</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-2">Language change requires restart</p>
                    </div>
                </div>
            );
            case 'monitors': return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold text-white">Monitors</h2>
                    <MonitorsSection />
                </div>
            );
            case 'printers': return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold text-white">Printers</h2>
                    <PrintersSection />
                </div>
            );
            case 'users': return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold text-white">Users</h2>
                    <UsersSection />
                </div>
            );
            case 'about': return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 -m-8 h-[calc(100%+4rem)]">
                    <AboutApp windowId="settings-about" />
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="flex h-full bg-slate-900 text-white">
            <div className="w-64 bg-slate-800/50 border-r border-white/5 p-4 flex flex-col gap-1 overflow-y-auto shrink-0">
                <h2 className="text-xl font-bold mb-6 px-2 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs font-bold">B</div>
                    Settings
                </h2>
                {TABS.map(([Icon, label, id]) => (
                    <TabButton key={id} icon={Icon} label={label} isActive={tab===id}
                        onClick={() => { setTab(id); if (id==='wifi' || id==='bluetooth') {} }} />
                ))}
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                {renderContent()}
            </div>
        </div>
    );
};

export default SettingsApp;
