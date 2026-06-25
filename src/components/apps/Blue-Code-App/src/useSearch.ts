import { useState, useCallback } from 'react';
import { SystemBridge } from '../../../../utils/systemBridge';
import { SearchResult } from './types';
import { SEARCHABLE_EXT_RE } from './languageMap';

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'build', '__pycache__', '.next', 'vendor']);

export function useSearch(rootPath: string) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    const searchFiles = useCallback(async () => {
        if (!searchTerm.trim() || !rootPath) return;
        const results: SearchResult[] = [];
        const term = searchTerm.toLowerCase();

        const searchDir = async (dir: string) => {
            if (results.length >= 50) return;
            const files = await SystemBridge.getFiles(dir);
            for (const file of files) {
                if (results.length >= 50) return;
                if (file.is_dir) {
                    if (SKIP_DIRS.has(file.name)) continue;
                    await searchDir(file.path);
                    continue;
                }
                if (!file.mime_type?.startsWith('text/') && !SEARCHABLE_EXT_RE.test(file.name)) continue;
                const content = await SystemBridge.readFile(file.path).catch(() => '');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase().includes(term)) {
                        results.push({ file: file.path, line: i + 1, content: lines[i].trim() });
                        if (results.length >= 50) break;
                    }
                }
            }
        };

        await searchDir(rootPath);
        setSearchResults(results);
    }, [searchTerm, rootPath]);

    return { searchTerm, setSearchTerm, searchResults, searchFiles };
}
