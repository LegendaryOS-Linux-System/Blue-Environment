import React from 'react';
import {
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Maximize2, Settings, List, FolderOpen,
} from 'lucide-react';

interface Props {
    playing: boolean;
    current: number;
    duration: number;
    volume: number;
    muted: boolean;
    speed: number;
    fullscreen: boolean;
    showPlaylist: boolean;
    showSettings: boolean;
    onPlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVolume: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMute: () => void;
    onFullscreen: () => void;
    onTogglePlaylist: () => void;
    onToggleSettings: () => void;
    onOpenFiles: () => void;
}

function fmtTime(s: number) {
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const Controls: React.FC<Props> = ({
    playing, current, duration, volume, muted, speed, fullscreen,
    showPlaylist, showSettings,
    onPlay, onPrev, onNext, onSeek, onVolume, onMute, onFullscreen,
    onTogglePlaylist, onToggleSettings, onOpenFiles,
}) => (
    <div className="bg-slate-900/95 border-t border-white/5 p-2 shrink-0">
        <input type="range" min={0} max={duration || 1} value={current} step={0.1} onChange={onSeek}
            className="w-full h-1 mb-2 accent-blue-500 cursor-pointer" />
        <div className="flex items-center gap-2">
            <button onClick={onPrev}     className="p-1.5 hover:bg-white/10 rounded"><SkipBack    size={16}/></button>
            <button onClick={onPlay}     className="p-2    hover:bg-white/10 rounded">{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
            <button onClick={onNext}     className="p-1.5 hover:bg-white/10 rounded"><SkipForward size={16}/></button>
            <span className="text-xs text-slate-400 font-mono mx-1">{fmtTime(current)} / {fmtTime(duration)}</span>
            <div className="flex-1" />
            <button onClick={onMute}     className="p-1.5 hover:bg-white/10 rounded">{muted ? <VolumeX size={15}/> : <Volume2 size={15}/>}</button>
            <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={onVolume}
                className="w-20 accent-blue-500 cursor-pointer" />
            <span className="text-xs text-slate-500">{speed}x</span>
            <button onClick={onOpenFiles}      className="p-1.5 hover:bg-white/10 rounded"><FolderOpen  size={15}/></button>
            <button onClick={onTogglePlaylist} className={`p-1.5 rounded ${showPlaylist ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10'}`}><List       size={15}/></button>
            <button onClick={onToggleSettings} className={`p-1.5 rounded ${showSettings ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10'}`}><Settings   size={15}/></button>
            <button onClick={onFullscreen}     className="p-1.5 hover:bg-white/10 rounded"><Maximize2   size={15}/></button>
        </div>
    </div>
);

export default Controls;
