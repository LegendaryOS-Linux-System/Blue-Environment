import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { X, Minus, Maximize2, Square } from 'lucide-react';
import { WindowState } from '../types';

interface WindowProps {
    window: WindowState;
    isActive: boolean;
    onClose: (id: string) => void;
    onMinimize: (id: string) => void;
    onMaximize: (id: string) => void;
    onFocus: (id: string) => void;
    onMove: (id: string, x: number, y: number) => void;
    onResize: (id: string, width: number, height: number) => void;
    children: React.ReactNode;
}

const TOPBAR_HEIGHT = 48;
const MIN_WIDTH     = 280;
const MIN_HEIGHT    = 180;
const SNAP_ZONE     = 20; // px from edge to trigger snap

type SnapRegion = 'none' | 'left' | 'right' | 'top' | 'top-left' | 'top-right';

interface SnapPreview { x: number; y: number; w: number; h: number }

function getSnapRegion(x: number, y: number): SnapRegion {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const nearLeft  = x <= SNAP_ZONE;
    const nearRight = x >= W - SNAP_ZONE;
    const nearTop   = y <= TOPBAR_HEIGHT + SNAP_ZONE;

    if (nearTop && nearLeft)  return 'top-left';
    if (nearTop && nearRight) return 'top-right';
    if (nearTop)              return 'top';
    if (nearLeft)             return 'left';
    if (nearRight)            return 'right';
    return 'none';
}

function snapGeometry(region: SnapRegion): SnapPreview {
    const W = window.innerWidth;
    const H = window.innerHeight - TOPBAR_HEIGHT;
    switch (region) {
        case 'left':      return { x: 0,       y: TOPBAR_HEIGHT, w: W / 2,   h: H };
        case 'right':     return { x: W / 2,   y: TOPBAR_HEIGHT, w: W / 2,   h: H };
        case 'top':       return { x: 0,       y: TOPBAR_HEIGHT, w: W,       h: H };
        case 'top-left':  return { x: 0,       y: TOPBAR_HEIGHT, w: W / 2,   h: H / 2 };
        case 'top-right': return { x: W / 2,   y: TOPBAR_HEIGHT, w: W / 2,   h: H / 2 };
        default:          return { x: 0, y: 0, w: 0, h: 0 };
    }
}

const Window: React.FC<WindowProps> = ({
    window: win, isActive,
    onClose, onMinimize, onMaximize, onFocus, onMove, onResize,
    children,
}) => {
    const [isDragging,  setIsDragging]  = useState(false);
    const [isResizing,  setIsResizing]  = useState(false);
    const [snapRegion,  setSnapRegion]  = useState<SnapRegion>('none');
    const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);

    const dragOffset  = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
    // Save pre-snap geometry so we can restore on un-snap
    const preSnapGeom = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

    const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
        if (win.isMaximized) return;
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        onFocus(win.id);
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - win.x, y: e.clientY - win.y };
    }, [win.isMaximized, win.id, win.x, win.y, onFocus]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        onFocus(win.id);
        setIsResizing(true);
        resizeStart.current = { x: e.clientX, y: e.clientY, w: win.width, h: win.height };
    }, [win.id, win.width, win.height, onFocus]);

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newX = e.clientX - dragOffset.current.x;
                const newY = Math.max(TOPBAR_HEIGHT, e.clientY - dragOffset.current.y);
                onMove(win.id, newX, newY);

                // Snap detection
                const region = getSnapRegion(e.clientX, e.clientY);
                setSnapRegion(region);
                if (region !== 'none') {
                    setSnapPreview(snapGeometry(region));
                } else {
                    setSnapPreview(null);
                }
            }
            if (isResizing) {
                const dx = e.clientX - resizeStart.current.x;
                const dy = e.clientY - resizeStart.current.y;
                onResize(win.id,
                         Math.max(MIN_WIDTH,  resizeStart.current.w + dx),
                         Math.max(MIN_HEIGHT, resizeStart.current.h + dy));
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isDragging && snapRegion !== 'none') {
                // Save pre-snap geometry
                preSnapGeom.current = { x: win.x, y: win.y, w: win.width, h: win.height };
                const geom = snapGeometry(snapRegion);
                onMove(win.id, geom.x, geom.y);
                onResize(win.id, geom.w, geom.h);
            }
            setIsDragging(false);
            setIsResizing(false);
            setSnapRegion('none');
            setSnapPreview(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup',   handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup',   handleMouseUp);
        };
    }, [isDragging, isResizing, snapRegion, win.id, win.x, win.y, win.width, win.height, onMove, onResize]);

    if (win.isMinimized) return null;

    const style: React.CSSProperties = win.isMaximized
    ? { left: 0, top: TOPBAR_HEIGHT, width: '100vw',
        height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
        borderRadius: 0, border: 'none', zIndex: win.zIndex }
        : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex };

        return (
            <>
            {/* Snap preview overlay */}
            {snapPreview && (
                <div className="fixed pointer-events-none z-[9999]"
                style={{
                    left: snapPreview.x, top: snapPreview.y,
                    width: snapPreview.w, height: snapPreview.h,
                    background: 'rgba(59,130,246,0.15)',
                             border: '2px solid rgba(59,130,246,0.5)',
                             borderRadius: 12,
                             transition: 'all 0.12s ease',
                }}
                />
            )}

            <div
            className={`absolute flex flex-col overflow-hidden shadow-2xl border transition-shadow duration-150
                theme-bg-primary
                ${isActive ? 'border-blue-500/60 shadow-blue-500/20' : 'theme-border shadow-black/60'}
                ${isDragging ? 'cursor-grabbing select-none' : ''}
                ${win.isMaximized ? '' : 'rounded-xl'}
                `}
                style={style}
                onMouseDown={() => onFocus(win.id)}
                >
                {/* Title Bar */}
                <div
                className={`h-9 flex items-center justify-between px-3 select-none shrink-0
                    theme-bg-secondary theme-border border-b
                    ${win.isMaximized ? '' : 'cursor-default'}
                    `}
                    onMouseDown={handleTitleMouseDown}
                    onDoubleClick={() => onMaximize(win.id)}
                    >
                    <div className="flex items-center gap-2 text-sm font-medium theme-text-primary min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 transition-colors
                        ${isActive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}`}
                        />
                        <span className="truncate">{win.title}</span>
                        {win.isExternal && (
                            <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 rounded">ext</span>
                        )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0" onMouseDown={e => e.stopPropagation()}>
                        <button onClick={() => onMinimize(win.id)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md
                        theme-text-secondary hover:text-yellow-400 transition-colors"
                        title="Minimize (Super+↓)">
                        <Minus size={13}/>
                        </button>
                        <button onClick={() => onMaximize(win.id)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md
                        theme-text-secondary hover:text-green-400 transition-colors"
                        title="Maximize (Super+↑)">
                        {win.isMaximized ? <Square size={11}/> : <Maximize2 size={11}/>}
                        </button>
                        <button onClick={() => onClose(win.id)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-red-500/80 rounded-md
                        theme-text-secondary hover:text-white transition-colors"
                        title="Close (Alt+F4)">
                        <X size={13}/>
                        </button>
                        </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto relative theme-bg-primary theme-text-primary select-text cursor-auto">
                        {children}
                        </div>

                        {/* Resize handle */}
                        {!win.isMaximized && (
                            <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 group"
                            onMouseDown={handleResizeMouseDown}>
                            <svg width="12" height="12" viewBox="0 0 12 12"
                            className="absolute bottom-1 right-1 opacity-30 group-hover:opacity-70 transition-opacity">
                            <path d="M0 12 L12 0 M4 12 L12 4 M8 12 L12 8"
                            stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            </div>
                        )}
                        </div>
                        </>
        );
};

export default memo(Window, (prev, next) =>
prev.window === next.window && prev.isActive === next.isActive);
