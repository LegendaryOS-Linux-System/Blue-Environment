import React, { useState, useRef, useEffect } from 'react';
import { AppProps } from '../../../types';
import { Video, X, Plus } from 'lucide-react';
import { usePlaylist } from './src/usePlaylist';
import Controls from './src/Controls';

const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

const BlueVideoApp: React.FC<AppProps> = () => {
    const { playlist, currentIdx, setCurrentIdx, openFiles, remove } = usePlaylist();
    const videoRef    = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playing,      setPlaying]      = useState(false);
    const [current,      setCurrent]      = useState(0);
    const [duration,     setDuration]     = useState(0);
    const [volume,       setVolume]       = useState(1);
    const [muted,        setMuted]        = useState(false);
    const [speed,        setSpeed]        = useState(1);
    const [fullscreen,   setFullscreen]   = useState(false);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const currentItem = playlist[currentIdx];

    useEffect(() => {
        if (!videoRef.current || !currentItem) return;
        videoRef.current.src = currentItem.url;
        videoRef.current.play().catch(() => {});
    }, [currentIdx, currentItem]);

    const togglePlay = () => {
        const v = videoRef.current; if (!v) return;
        playing ? v.pause() : v.play();
    };
    const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = videoRef.current; if (v) v.currentTime = parseFloat(e.target.value);
    };
    const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = videoRef.current; if (!v) return;
        v.volume = parseFloat(e.target.value); v.muted = false; setVolume(parseFloat(e.target.value));
    };
    const changeSpeed = (s: number) => {
        const v = videoRef.current; if (v) v.playbackRate = s; setSpeed(s); setShowSettings(false);
    };
    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) { await containerRef.current?.requestFullscreen(); setFullscreen(true); }
        else { await document.exitFullscreen(); setFullscreen(false); }
    };

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-black text-white overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 flex items-center justify-center bg-black">
                    {!currentItem ? (
                        <div className="flex flex-col items-center gap-4 text-slate-600">
                            <Video size={48} />
                            <p className="text-sm text-slate-400">No video open</p>
                            <button onClick={openFiles} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm text-white">Open video files</button>
                        </div>
                    ) : (
                        <video ref={videoRef} className="max-w-full max-h-full"
                            onPlay={() => setPlaying(true)}
                            onPause={() => setPlaying(false)}
                            onTimeUpdate={() => setCurrent(videoRef.current?.currentTime ?? 0)}
                            onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                            onEnded={() => { if (currentIdx < playlist.length - 1) setCurrentIdx(currentIdx + 1); }}
                        />
                    )}
                </div>

                {showPlaylist && (
                    <div className="w-56 bg-slate-900 border-l border-white/5 flex flex-col overflow-hidden shrink-0">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                            <span className="text-xs font-medium">Playlist ({playlist.length})</span>
                            <button onClick={openFiles} className="text-blue-400 hover:text-blue-300"><Plus size={14}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {playlist.map((item, i) => (
                                <div key={i} onClick={() => setCurrentIdx(i)}
                                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-white/5 group ${i === currentIdx ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                                    <span className="flex-1 text-xs truncate">{item.name}</span>
                                    <button onClick={e => { e.stopPropagation(); remove(i); }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"><X size={11}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showSettings && (
                    <div className="absolute bottom-20 right-4 bg-slate-800 rounded-xl p-3 border border-white/10 shadow-xl z-10 w-40">
                        <div className="text-xs text-slate-400 mb-2">Playback Speed</div>
                        {speeds.map(s => (
                            <button key={s} onClick={() => changeSpeed(s)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs ${speed === s ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'}`}>
                                {s}x
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <Controls
                playing={playing} current={current} duration={duration}
                volume={volume} muted={muted} speed={speed} fullscreen={fullscreen}
                showPlaylist={showPlaylist} showSettings={showSettings}
                onPlay={togglePlay}
                onPrev={() => { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); }}
                onNext={() => { if (currentIdx < playlist.length - 1) setCurrentIdx(currentIdx + 1); }}
                onSeek={seek} onVolume={changeVolume} onMute={() => { const v = videoRef.current; if (v) v.muted = !v.muted; setMuted(m => !m); }}
                onFullscreen={toggleFullscreen}
                onTogglePlaylist={() => setShowPlaylist(s => !s)}
                onToggleSettings={() => { setShowSettings(s => !s); if (showPlaylist) setShowPlaylist(false); }}
                onOpenFiles={openFiles}
            />
        </div>
    );
};

export default BlueVideoApp;
