import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppProps } from '../../types';
import {
    Camera, Video, Image, FlipHorizontal, Settings,
    Circle, Square, Download, RefreshCw, Zap, ZapOff,
    SwitchCamera, Timer, Grid3x3, X, Check
} from 'lucide-react';

type Mode = 'photo' | 'video';
type TimerSecs = 0 | 3 | 5 | 10;

const CameraApp: React.FC<AppProps> = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval>>();

    const [mode, setMode] = useState<Mode>('photo');
    const [recording, setRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);
    const [captures, setCaptures] = useState<{ url: string; type: 'photo' | 'video'; name: string }[]>([]);
    const [mirrored, setMirrored] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [timer, setTimer] = useState<TimerSecs>(0);
    const [countdown, setCountdown] = useState(0);
    const [flash, setFlash] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [deviceIdx, setDeviceIdx] = useState(0);
    const [resolution, setResolution] = useState({ w: 1280, h: 720 });
    const [showSettings, setShowSettings] = useState(false);
    const [flashAnim, setFlashAnim] = useState(false);

    const startCamera = useCallback(async (devIdx = deviceIdx) => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setError(null);
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const cams = allDevices.filter(d => d.kind === 'videoinput');
            setDevices(cams);
            const constraints: MediaStreamConstraints = {
                video: {
                    deviceId: cams[devIdx]?.deviceId ? { ideal: cams[devIdx].deviceId } : undefined,
                    width: { ideal: resolution.w },
                    height: { ideal: resolution.h },
                },
                audio: mode === 'video',
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch (e: any) {
            setError(e.message.includes('Permission')
                ? 'Camera permission denied. Allow access in browser settings.'
                : `Camera unavailable: ${e.message}`);
        }
    }, [deviceIdx, resolution, mode]);

    useEffect(() => {
        startCamera();
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            clearInterval(timerRef.current);
        };
    }, []);

    const doCapture = useCallback(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        // Flash animation
        setFlashAnim(true);
        setTimeout(() => setFlashAnim(false), 300);

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        if (mirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const name = `photo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
            setCaptures(prev => [{ url, type: 'photo', name }, ...prev]);

            // Auto-download to ~/Pictures
            const a = document.createElement('a');
            a.href = url; a.download = name; a.click();
        }, 'image/jpeg', 0.92);
    }, [mirrored]);

    const takePhoto = () => {
        if (timer === 0) { doCapture(); return; }
        let count = timer;
        setCountdown(count);
        const id = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) { clearInterval(id); setCountdown(0); doCapture(); }
        }, 1000);
    };

    const startRecording = async () => {
        if (!streamRef.current) return;
        // Re-request with audio if needed
        if (!streamRef.current.getAudioTracks().length) {
            await startCamera(deviceIdx);
            await new Promise(r => setTimeout(r, 500));
        }
        const stream = streamRef.current;
        if (!stream) return;
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const mr = new MediaRecorder(stream, { mimeType: mime });
        chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mime });
            const url = URL.createObjectURL(blob);
            const name = `video-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
            setCaptures(prev => [{ url, type: 'video', name }, ...prev]);
            const a = document.createElement('a');
            a.href = url; a.download = name; a.click();
        };
        mr.start(250);
        mediaRecorderRef.current = mr;
        setRecording(true);
        setRecordTime(0);
        timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        clearInterval(timerRef.current);
        setRecording(false);
        setRecordTime(0);
    };

    const switchCamera = () => {
        const next = (deviceIdx + 1) % Math.max(devices.length, 1);
        setDeviceIdx(next);
        startCamera(next);
    };

    const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="flex flex-col h-full bg-black text-white overflow-hidden">
            {/* Viewfinder */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                        <Camera size={48} className="text-slate-600 mb-4" />
                        <p className="text-slate-300 text-sm mb-2">{error}</p>
                        <button onClick={() => startCamera()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm mt-2">
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            className="w-full h-full object-contain"
                            style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
                            playsInline muted autoPlay
                        />

                        {/* Grid overlay */}
                        {showGrid && (
                            <div className="absolute inset-0 pointer-events-none">
                                {[1, 2].map(i => (
                                    <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-white/20" style={{ left: `${i * 33.33}%` }} />
                                ))}
                                {[1, 2].map(i => (
                                    <div key={`h${i}`} className="absolute left-0 right-0 border-t border-white/20" style={{ top: `${i * 33.33}%` }} />
                                ))}
                            </div>
                        )}

                        {/* Flash animation */}
                        {flashAnim && <div className="absolute inset-0 bg-white animate-ping pointer-events-none" style={{ animation: 'flash 0.3s ease-out' }} />}

                        {/* Countdown */}
                        {countdown > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-8xl font-bold text-white drop-shadow-2xl" style={{ textShadow: '0 0 30px rgba(0,0,0,0.8)' }}>
                                    {countdown}
                                </span>
                            </div>
                        )}

                        {/* Recording indicator */}
                        {recording && (
                            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-sm font-mono text-white">{fmtTime(recordTime)}</span>
                            </div>
                        )}

                        {/* Top toolbar */}
                        <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => setMirrored(m => !m)} className={`p-2 rounded-full backdrop-blur-sm ${mirrored ? 'bg-blue-600/80' : 'bg-black/40 hover:bg-black/60'}`}>
                                <FlipHorizontal size={16} />
                            </button>
                            <button onClick={() => setShowGrid(g => !g)} className={`p-2 rounded-full backdrop-blur-sm ${showGrid ? 'bg-blue-600/80' : 'bg-black/40 hover:bg-black/60'}`}>
                                <Grid3x3 size={16} />
                            </button>
                            {devices.length > 1 && (
                                <button onClick={switchCamera} className="p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm">
                                    <SwitchCamera size={16} />
                                </button>
                            )}
                            <button onClick={() => setShowSettings(s => !s)} className={`p-2 rounded-full backdrop-blur-sm ${showSettings ? 'bg-blue-600/80' : 'bg-black/40 hover:bg-black/60'}`}>
                                <Settings size={16} />
                            </button>
                        </div>

                        {/* Settings panel */}
                        {showSettings && (
                            <div className="absolute top-14 right-3 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-white/10 p-4 w-56 space-y-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Camera</label>
                                    <select value={deviceIdx} onChange={e => { setDeviceIdx(+e.target.value); startCamera(+e.target.value); }}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none">
                                        {devices.map((d, i) => <option key={d.deviceId} value={i}>{d.label || `Camera ${i + 1}`}</option>)}
                                        {devices.length === 0 && <option value={0}>Default Camera</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Resolution</label>
                                    <select value={`${resolution.w}x${resolution.h}`} onChange={e => {
                                        const [w, h] = e.target.value.split('x').map(Number);
                                        setResolution({ w, h }); startCamera();
                                    }} className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none">
                                        <option value="3840x2160">4K (3840×2160)</option>
                                        <option value="1920x1080">FHD (1920×1080)</option>
                                        <option value="1280x720">HD (1280×720)</option>
                                        <option value="640x480">SD (640×480)</option>
                                    </select>
                                </div>
                                <button onClick={() => setShowSettings(false)} className="w-full text-center text-xs text-slate-500 hover:text-white pt-1">Close</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Controls bar */}
            <div className="shrink-0 bg-slate-900 border-t border-white/5">
                {/* Mode + Timer selector */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <div className="flex bg-slate-800 rounded-xl p-0.5">
                        <button onClick={() => setMode('photo')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'photo' ? 'bg-white text-black' : 'text-slate-400'}`}>
                            <Camera size={13} /> Photo
                        </button>
                        <button onClick={() => setMode('video')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'video' ? 'bg-white text-black' : 'text-slate-400'}`}>
                            <Video size={13} /> Video
                        </button>
                    </div>
                    {mode === 'photo' && (
                        <div className="flex items-center gap-1">
                            {([0, 3, 5, 10] as TimerSecs[]).map(t => (
                                <button key={t} onClick={() => setTimer(t)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${timer === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                    {t === 0 ? <X size={12} className="mx-auto" /> : `${t}s`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main capture row */}
                <div className="flex items-center justify-center gap-8 px-4 py-4 relative">
                    {/* Gallery preview */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 border border-white/10 shrink-0">
                        {captures.length > 0 ? (
                            captures[0].type === 'photo'
                                ? <img src={captures[0].url} className="w-full h-full object-cover" alt="" />
                                : <video src={captures[0].url} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Image size={20} className="text-slate-600" /></div>
                        )}
                    </div>

                    {/* Shutter / Record button */}
                    <div className="relative">
                        {mode === 'photo' ? (
                            <button onClick={takePhoto} disabled={countdown > 0}
                                className="w-16 h-16 rounded-full bg-white hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-white/20">
                                <div className="w-12 h-12 rounded-full border-2 border-slate-300" />
                            </button>
                        ) : (
                            <button onClick={recording ? stopRecording : startRecording}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg ${recording ? 'bg-red-500 hover:bg-red-400 shadow-red-500/30' : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'}`}>
                                {recording ? <Square size={20} fill="white" /> : <Circle size={20} fill="white" />}
                            </button>
                        )}
                    </div>

                    {/* Count */}
                    <div className="w-14 h-14 flex items-center justify-center text-slate-500 text-xs text-center shrink-0">
                        {captures.length > 0 && <span className="font-medium text-slate-300">{captures.length}<br /><span className="text-slate-600 font-normal">saved</span></span>}
                    </div>
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <style>{`
                @keyframes flash { 0% { opacity: 0.8; } 100% { opacity: 0; } }
            `}</style>
        </div>
    );
};
export default CameraApp;
