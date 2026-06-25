import { useState, useCallback } from 'react';
import { SystemBridge, PackageInfo } from '../../../../utils/systemBridge';
import { InstallLog } from './types';

export function usePackages() {
    const [packages,    setPackages]    = useState<PackageInfo[]>([]);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const [installLog,  setInstallLog]  = useState<InstallLog | null>(null);

    const loadPackages = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Parallel fetching from all package managers — only returns real
            // installed/available packages from the running system.
            // No placeholder data: if a package manager isn't installed, the
            // corresponding list is empty (the backend returns [] in that case).
            // LegendaryOS is Fedora-based, so the primary system package
            // source is dnf (not apt — Fedora has no apt at all); snap is
            // not part of the supported stack and isn't queried.
            const [dnf, flatpak, appimage] = await Promise.all([
                SystemBridge.getDnfPackages().catch((): PackageInfo[] => []),
                SystemBridge.getFlatpakPackages().catch((): PackageInfo[] => []),
                SystemBridge.getAppImagePackages().catch((): PackageInfo[] => []),
            ]);
            setPackages([...dnf, ...flatpak, ...appimage]);
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    const performAction = useCallback(async (
        pkg: PackageInfo,
        action: 'install' | 'remove' | 'update',
    ) => {
        setActiveAction(pkg.id);
        const label = action === 'install' ? 'Installing' : action === 'remove' ? 'Removing' : 'Updating';
        setInstallLog({ pkgId: pkg.id, lines: [`${label} ${pkg.name}…`], done: false, success: false });

        const addLog = (line: string) =>
            setInstallLog(prev => prev ? { ...prev, lines: [...prev.lines, line] } : null);

        try {
            addLog(`Source: ${pkg.source}`);
            let ok = false;

            if (action === 'install') {
                if (pkg.source === 'dnf')          ok = await SystemBridge.installDnfPackage(pkg.id);
                else if (pkg.source === 'flatpak') ok = await SystemBridge.installFlatpakPackage(pkg.id);
                else                                ok = await SystemBridge.installAppImage(pkg.id);
            } else if (action === 'remove') {
                if (pkg.source === 'dnf')          ok = await SystemBridge.removeDnfPackage(pkg.id);
                else if (pkg.source === 'flatpak') ok = await SystemBridge.removeFlatpakPackage(pkg.id);
                else                                ok = await SystemBridge.removeAppImage(pkg.id);
            } else {
                if (pkg.source === 'dnf')          ok = await SystemBridge.updateDnfPackage(pkg.id);
                else                                ok = await SystemBridge.updateFlatpakPackage(pkg.id);
            }

            addLog(ok ? '✓ Done successfully' : '✗ Operation failed');
            setInstallLog(prev => prev ? { ...prev, done: true, success: ok } : null);
            if (ok) await loadPackages();
        } catch (e: any) {
            addLog(`✗ Error: ${e?.message ?? String(e)}`);
            setInstallLog(prev => prev ? { ...prev, done: true, success: false } : null);
        } finally {
            setActiveAction(null);
        }
    }, [loadPackages]);

    return { packages, loading, error, setError, activeAction, installLog, setInstallLog, loadPackages, performAction };
}
