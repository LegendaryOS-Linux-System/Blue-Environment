import { useState, useCallback } from 'react';
import { SystemBridge } from '../../../../utils/systemBridge';

export interface VideoItem { name: string; url: string; }

export function usePlaylist() {
    const [playlist, setPlaylist] = useState<VideoItem[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);

    const openFiles = useCallback(async () => {
        const paths = await SystemBridge.pickFiles([
            { name: 'Videos', extensions: ['mp4','webm','mkv','avi','mov','flv','wmv','ogg','ts','m4v'] },
        ], 'Open Videos');
        if (!paths.length) return;
        const items: VideoItem[] = paths.map(p => ({ name: p.split('/').pop() || p, url: `file://${p}` }));
        setPlaylist(prev => {
            const next = [...prev, ...items];
            if (prev.length === 0) setCurrentIdx(0);
            return next;
        });
    }, []);

    const remove = useCallback((i: number) => {
        setPlaylist(prev => prev.filter((_, j) => j !== i));
        setCurrentIdx(prev => (i < prev ? prev - 1 : Math.min(prev, playlist.length - 2)));
    }, [playlist.length]);

    return { playlist, currentIdx, setCurrentIdx, openFiles, remove };
}
