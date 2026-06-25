import React, { useState, useEffect, memo } from 'react';
import { AppId } from '../types';
import { APPS } from '../constants';
import { Search, Wifi, Bell, Command, CloudSun, Cloud, CloudRain, CloudSnow, Sun, Clipboard } from 'lucide-react';
import { SystemBridge } from '../utils/systemBridge';
import { configStore } from '../utils/configStore';

interface TopBarProps {
    openWindows: { id: string; appId: AppId; isMinimized: boolean; isActive: boolean; workspace: number }[];
    currentWorkspace: number;
    workspaceCount: number;
    onOpenApp: (appId: string) => void;
    onToggleWindow: (windowId: string) => void;
    onStartClick: () => void;
    onStartDoubleClick: () => void;
    onToggleControlCenter: () => void;
    onToggleNotifications: () => void;
    onSwitchWorkspace: (index: number) => void;
    isStartMenuOpen: boolean;
    isClipboardOpen: boolean;
    onToggleClipboard: () => void;
}

interface WeatherData {
    temp: string;
    code: number;
    city: string;
}

function getWeatherIcon(code: number) {
    if (code === 0) return <Sun size={14} className="text-yellow-300" />;
    if (code <= 3)  return <CloudSun size={14} className="text-yellow-200" />;
    if (code <= 67) return <CloudRain size={14} className="text-blue-300" />;
    if (code <= 77) return <CloudSnow size={14} className="text-blue-100" />;
    return <Cloud size={14} className="text-slate-300" />;
}

async function fetchWeather(): Promise<WeatherData | null> {
    try {
        // Get user location via IP geolocation (no permission needed, ~city accuracy)
        const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
        const geo = await geoRes.json();
        const { latitude, longitude, city } = geo;

        if (!latitude || !longitude) return null;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const wxRes = await fetch(url, { signal: AbortSignal.timeout(4000) });
        const wx = await wxRes.json();

        if (!wx.current_weather) return null;

        return {
            temp: `${Math.round(wx.current_weather.temperature)}°C`,
            code: wx.current_weather.weathercode,
            city: city ?? 'Unknown',
        };
    } catch {
        return null;
    }
}

const TopBar: React.FC<TopBarProps> = ({
    openWindows, currentWorkspace, workspaceCount, onOpenApp, onToggleWindow,
    onStartClick, onStartDoubleClick, onToggleControlCenter, onToggleNotifications,
    onSwitchWorkspace, isStartMenuOpen, isClipboardOpen, onToggleClipboard,
}) => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [hasClipboardContent, setHasClipboardContent] = useState(false);
    const [pinnedApps, setPinnedApps] = useState<AppId[]>([AppId.TERMINAL, AppId.EXPLORER, AppId.SYSTEM_MONITOR, AppId.SETTINGS]);
    const [panelOpacity, setPanelOpacity] = useState(0.95);
    const [panelHeight, setPanelHeight] = useState(48);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Weather — geo-located, refreshes every 30 min
    useEffect(() => {
        const load = () => fetchWeather().then(w => { if (w) setWeather(w); });
        load();
        const id = setInterval(load, 30 * 60 * 1000);
        return () => clearInterval(id);
    }, []);

    // Clipboard indicator
    useEffect(() => {
        const check = async () => {
            try {
                const has = await SystemBridge.hasText();
                setHasClipboardContent(has);
            } catch {}
        };
        check();
        const id = setInterval(check, 4000);
        return () => clearInterval(id);
    }, []);

    // Pinned apps + panel appearance from config
    useEffect(() => {
        const unsub = configStore.subscribe(cfg => {
            const pinned = (cfg as any).pinnedApps as AppId[] | undefined;
            if (pinned && Array.isArray(pinned) && pinned.length > 0) {
                setPinnedApps(pinned);
            }
            if (typeof cfg.panelOpacity === 'number') setPanelOpacity(cfg.panelOpacity);
            if (typeof cfg.panelSize === 'number' && cfg.panelSize > 0) setPanelHeight(cfg.panelSize);
        });
        return unsub;
    }, []);

    const handleStartClick = (e: React.MouseEvent) => {
        if (e.detail === 2) onStartDoubleClick();
        else onStartClick();
    };

        return (
            <div
            className="absolute top-0 left-0 right-0 backdrop-blur-sm border-b border-white/5
            flex items-center justify-between px-3 z-50 select-none"
            style={{ height: panelHeight, backgroundColor: `rgba(15, 23, 42, ${panelOpacity})` }}>

            {/* Left: Start + search */}
            <div className="flex items-center gap-3 w-1/3">
            <button
            onClick={handleStartClick}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all group
                ${isStartMenuOpen ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
                title="Start (double-click for full screen)"
                >
                <div className="relative">
                <Command size={18} className="group-hover:rotate-12 transition-transform duration-200"/>
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full"/>
                </div>
                <span className="font-bold text-sm tracking-tight hidden sm:block">Blue</span>
                </button>
                <div
                className="hidden md:flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80
                border border-white/5 rounded-full px-3 py-1 text-xs text-slate-400 cursor-text transition-colors w-44"
                onClick={onStartClick}
                >
                <Search size={12}/>
                <span>Search apps...</span>
                </div>
                </div>

                {/* Center: pinned apps */}
                <div className="flex items-center justify-center w-1/3">
                <div className="flex items-center gap-1 bg-slate-800/60 border border-white/5 rounded-2xl px-2 py-1 shadow-lg">
                {pinnedApps.map(appId => {
                    const app = APPS[appId];
                    if (!app) return null;
                    const openInsts = openWindows.filter(w => w.appId === appId);
                    const isOpen   = openInsts.length > 0;
                    const isActive = openInsts.some(w => w.isActive && !w.isMinimized);
                    return (
                        <button
                        key={appId}
                        onClick={() => {
                            const inst = openWindows.find(w => w.appId === appId);
                            if (inst) onToggleWindow(inst.id);
                            else onOpenApp(appId);
                        }}
                        className="relative group p-2 rounded-xl transition-all hover:bg-white/10"
                        title={app.title}
                        >
                        {typeof app.icon !== 'string' && (
                            <app.icon size={20} className={`transition-colors duration-200
                                ${isOpen ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`}/>
                        )}
                        {isOpen && (
                            <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all
                                ${isActive ? 'w-3.5 bg-blue-400' : 'w-1 bg-slate-500'}`}/>
                        )}
                        </button>
                    );
                })}
                </div>
                </div>

                {/* Right */}
                <div className="flex items-center justify-end gap-2 w-1/3">
                {/* Workspace dots */}
                <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/5 transition-colors">
                {Array.from({ length: workspaceCount }, (_, i) => {
                    const hasWins = openWindows.some(w => w.workspace === i && !w.isMinimized);
                    return (
                        <button key={i} onClick={() => onSwitchWorkspace(i)}
                        title={`Workspace ${i + 1}`}
                        className={`transition-all duration-200 rounded-full
                            ${i === currentWorkspace
                                ? 'w-4 h-2 bg-blue-400'
                    : `w-2 h-2 ${hasWins ? 'bg-slate-400' : 'bg-slate-600'} hover:bg-slate-300`}`}
                    />
                    );
                })}
                </div>

                {/* Weather */}
                {weather && (
                    <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-white/5 cursor-default transition-colors"
                    title={`${weather.city}: ${weather.temp}`}>
                    {getWeatherIcon(weather.code)}
                    <span className="text-xs font-medium text-slate-200">{weather.temp}</span>
                    </div>
                )}

                {/* Clipboard */}
                <button onClick={onToggleClipboard}
                className={`relative p-2 rounded-full transition-colors group
                    ${isClipboardOpen ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10 text-slate-300'}`}
                    title="Clipboard history">
                    <Clipboard size={15} className="group-hover:text-white"/>
                    {hasClipboardContent && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full"/>
                    )}
                    </button>

                    {/* Clock + control center */}
                    <button onClick={onToggleControlCenter}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors border border-transparent hover:border-white/5">
                    <Wifi size={13} className="text-slate-300"/>
                    <span className="text-xs font-medium text-slate-200 tabular-nums">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    </button>

                    {/* Notifications */}
                    <button onClick={onToggleNotifications}
                    className="relative p-2 rounded-full hover:bg-white/10 transition-colors group">
                    <Bell size={15} className="text-slate-300 group-hover:text-white"/>
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 border border-slate-900 rounded-full"/>
                    </button>
                    </div>
                    </div>
        );
};

export default memo(TopBar);
