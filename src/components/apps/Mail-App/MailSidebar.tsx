import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { SystemBridge } from '../../../utils/systemBridge';
import { FOLDERS } from './types';
import { MailState } from './useMailState';

interface Props {
    state: MailState;
    t: (key: string) => string;
}

const MailSidebar: React.FC<Props> = ({ state, t }) => {
    const { activeFolder, searchQuery, setSearchQuery, unreadCount, openCompose, selectFolder, searchRef } = state;

    return (
        <div className="w-52 bg-slate-800/50 border-r border-white/5 flex flex-col">
            <div className="p-3">
                <button
                    onClick={openCompose}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} /> {t('mail.compose')}
                </button>
            </div>

            <div className="px-3 pb-2">
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                    <Search size={13} className="text-slate-400 shrink-0" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search mail..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent text-sm text-white flex-1 focus:outline-none placeholder-slate-500"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')}>
                            <X size={12} className="text-slate-400 hover:text-white" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {FOLDERS.map(folder => {
                    const count = unreadCount(folder.id);
                    return (
                        <button
                            key={folder.id}
                            onClick={() => selectFolder(folder.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                                activeFolder === folder.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            <folder.icon size={16} />
                            <span className="flex-1 text-left">{folder.label}</span>
                            {count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                    activeFolder === folder.id ? 'bg-white/20 text-white' : 'bg-blue-600/30 text-blue-400'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="p-3 border-t border-white/5">
                <div className="flex items-center gap-2 px-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                        {SystemBridge.getUsername().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{SystemBridge.getUsername()}</div>
                        <div className="text-[10px] text-slate-500 truncate">@blue.env</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MailSidebar;
