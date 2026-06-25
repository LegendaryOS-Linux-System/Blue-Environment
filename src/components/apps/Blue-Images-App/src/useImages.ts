import { useState, useCallback } from 'react';
import { SystemBridge } from '../../../../utils/systemBridge';

export interface ImageItem { name: string; url: string; path?: string; }

export function useImages() {
    const [images, setImages] = useState<ImageItem[]>([]);
    const [idx,    setIdx]    = useState(0);

    const openFiles = useCallback(async () => {
        const paths = await SystemBridge.pickFiles([
            { name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','bmp','tiff','svg','avif','heic'] },
        ], 'Open Images');
        if (!paths.length) return;
        const items: ImageItem[] = paths.map(p => ({
            name: p.split('/').pop() || p,
            url: `file://${p}`,
            path: p,
        }));
        setImages(prev => {
            const next = [...prev, ...items];
            if (prev.length === 0) setIdx(0);
            return next;
        });
    }, []);

    const remove = useCallback((i: number) => {
        setImages(prev => prev.filter((_, j) => j !== i));
        setIdx(prev => (i < prev ? prev - 1 : Math.min(prev, images.length - 2)));
    }, [images.length]);

    return { images, idx, setIdx, openFiles, remove };
}
