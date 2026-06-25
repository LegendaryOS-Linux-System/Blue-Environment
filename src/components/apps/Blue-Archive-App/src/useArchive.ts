import { useState, useCallback } from 'react';
import { SystemBridge } from '../../../../utils/systemBridge';
import { ArchiveState } from './types';

export function useArchive() {
    const [archive, setArchive] = useState<ArchiveState | null>(null);
    const [loading,  setLoading]  = useState(false);
    const [status,   setStatus]   = useState('');
    const [error,    setError]    = useState('');

    const openFile = useCallback(async () => {
        const path = await SystemBridge.pickFile([
            { name: 'Archives', extensions: ['zip','tar','gz','bz2','xz','7z','rar','zst','lz4','tgz'] },
        ], 'Open Archive');
        if (!path) return;

        setLoading(true);
        setError('');
        setStatus('');
        try {
            const info = await SystemBridge.invoke<any>('archive_list', { path });
            setArchive({ path, name: path.split('/').pop() || path, info });
            if (info.error) setError(info.error);
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    const extract = useCallback(async () => {
        if (!archive) return;
        const dir = await SystemBridge.pickDirectory();
        if (!dir) return;
        setLoading(true);
        setStatus('Extracting...');
        try {
            const msg = await SystemBridge.invoke<string>('archive_extract', { path: archive.path, destDir: dir });
            setStatus(msg || 'Done');
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
            setTimeout(() => setStatus(''), 5000);
        }
    }, [archive]);

    return { archive, loading, status, error, openFile, extract };
}
