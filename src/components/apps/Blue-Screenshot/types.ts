export type CaptureMode = 'fullscreen' | 'region' | 'window' | 'timer';
export type OutputFormat = 'png' | 'jpg' | 'webp';

export interface Screenshot {
    id: string;
    path: string;
    dataUrl: string;
    width: number;
    height: number;
    timestamp: number;
    mode: CaptureMode;
}

export interface ScreenshotSettings {
    format: OutputFormat;
    quality: number;       // 1-100
    delay: number;         // seconds
    savePath: string;
    showCursor: boolean;
    copyToClipboard: boolean;
    playSoundEffect: boolean;
}

export const DEFAULT_SETTINGS: ScreenshotSettings = {
    format: 'png',
    quality: 95,
    delay: 0,
    savePath: 'HOME/Pictures/Screenshots',
    showCursor: true,
    copyToClipboard: true,
    playSoundEffect: true,
};
