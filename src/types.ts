import { ReactNode } from 'react';

export enum AppId {
    TERMINAL       = 'terminal',
    AI_ASSISTANT   = 'ai_assistant',
    EXPLORER       = 'explorer',
    SETTINGS       = 'settings',
    ABOUT          = 'about',
    BLUE_WEB       = 'blue_web',
    CALCULATOR     = 'calculator',
    SYSTEM_MONITOR = 'system_monitor',
    NOTEPAD        = 'notepad',
    BLUE_CODE      = 'blue_code',
    BLUE_SOFTWARE  = 'blue_software',
    MAIL           = 'mail',
    BLUE_EDIT      = 'blue_edit',
    BLUE_IMAGES    = 'blue_images',
    BLUE_VIDEOS    = 'blue_videos',
    BLUE_MUSIC     = 'blue_music',
    BLUE_SCREEN    = 'blue_screen',
    CAMERA         = 'camera',
    EXTERNAL       = 'external',
}

export interface DesktopEntry {
    id: string;
    name: string;
    comment: string;
    icon: string;
    exec: string;
    categories: string[];
    desktop_file?: string;
    is_external?: boolean;
}

export interface AppDefinition {
    id: AppId | string;
    title: string;
    icon: React.ComponentType<any> | string;
    component?: React.ComponentType<any>;
    isExternal?: boolean;
    externalPath?: string;
    defaultWidth?: number;
    defaultHeight?: number;
}

export interface WindowState {
    id: string;
    appId: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isMinimized: boolean;
    isMaximized: boolean;
    zIndex: number;
    isExternal: boolean;
    workspace: number;
    externalWindowId?: string;
    pid?: number;
}

export interface AppsEnabled {
    blueAI: boolean;
    blueCode: boolean;
    blueSoftware: boolean;
    mail: boolean;
    calculator: boolean;
    notepad: boolean;
    systemMonitor: boolean;
    explorer: boolean;
    terminal: boolean;
    blueWeb: boolean;
    about: boolean;
}

export interface AIConfig {
    service: string;
    model: string;
    apiKey: string;
}

export interface UserConfig {
    wallpaper: string;
    // Using string (not literal union) so it is compatible with the
    // systemBridge.ts UserConfig which also uses string.
    theme: string;
    themeName: string;
    accentColor: string;
    displayScale: number;
    customThemes?: ThemeDefinition[];
    desktopPath: string;
    panelEnabled: boolean;
    panelPosition: string;
    panelSize: number;
    panelOpacity: number;
    language: string;
    nightLightEnabled: boolean;
    nightLightTemperature: number;
    nightLightSchedule: 'manual' | 'sunset';
    nightLightStartHour: number;
    nightLightEndHour: number;
    // Use Record<string, boolean> to match systemBridge expectations, keep
    // Partial<AppsEnabled> assignment-compatible via explicit cast where needed.
    appsEnabled?: Record<string, boolean>;
    aiConfig?: AIConfig;
    accounts?: Record<string, any>;
}

// ThemeDefinition - colors is Record<string,string> (required) to match
// systemBridge. The optional specialised shape is handled at call sites.
export interface ThemeDefinition {
    id: string;
    name: string;
    // 'type' kept optional so systemBridge (which lacks it) stays assignable.
    type?: 'builtin' | 'custom';
    css?: string;
    colors?: Record<string, string>;
}

export interface PowerProfile {
    name: string;
    active: boolean;
    icon?: string;
    description: string;
}

export interface AppProps {
    windowId: string;
    id?: string;
    onClose?: () => void;
}

export interface Notification {
    id: string;
    title: string;
    // 'message' aliased as optional to stay compatible with systemBridge
    // Notification which uses 'body' instead.
    message?: string;
    body?: string;
    appId?: string;
    app?: string;
    timestamp: number;
    read: boolean;
    icon?: string;
    actions?: { label: string; action: string }[];
}

export interface PackageInfo {
    id: string;
    name: string;
    description: string;
    version: string;
    source: 'apt' | 'flatpak' | 'snap' | 'appimage';
    installed: boolean;
    updateAvailable?: boolean;
    icon?: string;
    size?: string;
}

export interface SystemStats {
    cpu: number;
    ram: number;
    battery: number;
    isCharging: boolean;
    volume: number;
    brightness: number;
    wifiSSID: string;
    kernel: string;
    sessionType: string;
    uptime?: number;
    totalRam?: number;
    cpuModel?: string;
    diskUsage?: string;
    gpuModel?: string;
    hostname?: string;
}

export interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ExternalWindow {
    id: string;
    pid: number;
    title: string;
    class: string;
    iconPath: string;
    isMinimized: boolean;
    desktop: number;
}

export interface AICallRequest {
    service: string;
    apiKey: string;
    model: string;
    messages: AIMessage[];
}

export type PowerAction = 'shutdown' | 'reboot' | 'suspend' | 'hibernate';
