import React, { useState, useEffect } from 'react';
import { Save, FileText, Upload } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const NotepadApp: React.FC<AppProps> = () => {
    const [content, setContent] = useState('');
    const [filename, setFilename] = useState('new.txt');
    const [saved, setSaved] = useState(true);
    const [filePath, setFilePath] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => { if (!saved && content) handleSave(); }, 30000);
        return () => clearInterval(interval);
    }, [content, saved]);

    const handleSave = async () => {
        if (!content) return;
        try {
            const path = filePath || `/home/${SystemBridge.getUsername()}/Documents/${filename}`;
            await SystemBridge.writeFile(path, content);
            setFilePath(path);
            setSaved(true);
        } catch (e) { console.error('Save error:', e); }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            <div className="h-12 bg-slate-800 border-b border-white/5 flex items-center px-4 gap-2">
                <button onClick={() => { setContent(''); setFilePath(null); setSaved(true); }} className="p-2 hover:bg-white/10 rounded-lg" title="New"><FileText size={18} /></button>
                <button onClick={handleSave} className="p-2 hover:bg-white/10 rounded-lg" title="Save" disabled={saved}><Save size={18} className={saved ? 'text-slate-500' : 'text-blue-400'} /></button>
                <div className="w-px h-6 bg-white/10 mx-2" />
                <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500" />
                <div className="flex-1" />
                <span className="text-xs text-slate-500">{saved ? 'Saved' : 'Unsaved'}</span>
            </div>
            <textarea value={content} onChange={e => { setContent(e.target.value); setSaved(false); }}
                className="flex-1 w-full p-4 bg-slate-900 text-white font-mono text-sm resize-none focus:outline-none"
                placeholder="Start typing your note..." />
        </div>
    );
};
export default NotepadApp;
