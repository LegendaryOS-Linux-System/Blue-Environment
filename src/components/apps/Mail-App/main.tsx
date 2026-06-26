import React, { useState, useEffect } from 'react';
import { AppProps } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useMailState } from './useMailState';
import { useAccounts } from './src/useAccounts';
import MailSidebar from './MailSidebar';
import EmailList from './EmailList';
import EmailViewer from './EmailViewer';
import ComposeModal from './ComposeModal';
import AccountModal from './src/AccountModal';
import { Plus, RefreshCw, Settings, ChevronDown, Check } from 'lucide-react';

const MailApp: React.FC<AppProps> = () => {
    const { t } = useLanguage();
    const accts = useAccounts();
    const state = useMailState(accts.activeAcct ?? undefined);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [showAccountPicker, setShowAccountPicker] = useState(false);

    useEffect(() => {
        if (accts.activeAcct) state.fetchFromServer(accts.activeAcct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accts.activeAcct]);

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-white/5 shrink-0">
                {accts.accounts.length > 0 ? (
                    <div className="relative">
                        <button onClick={() => setShowAccountPicker(p => !p)}
                            className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded-lg text-xs text-slate-300">
                            {accts.activeAccount?.email ?? 'Select account'}<ChevronDown size={11}/>
                        </button>
                        {showAccountPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-20 min-w-[200px]">
                                {accts.accounts.map(a => (
                                    <button key={a.id} onClick={() => { accts.setActiveAcct(a.id); setShowAccountPicker(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left text-sm">
                                        {a.id === accts.activeAcct && <Check size={12} className="text-blue-400"/>}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white truncate text-xs">{a.name}</div>
                                            <div className="text-slate-500 truncate text-[10px]">{a.email}</div>
                                        </div>
                                    </button>
                                ))}
                                <div className="border-t border-white/5 mx-2"/>
                                <button onClick={() => { setEditingAccount(null); setShowAccountModal(true); setShowAccountPicker(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left text-xs text-slate-400">
                                    <Plus size={12}/> Add account
                                </button>
                                {accts.activeAccount && (
                                    <button onClick={() => { setEditingAccount(accts.activeAccount); setShowAccountModal(true); setShowAccountPicker(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left text-xs text-slate-400">
                                        <Settings size={12}/> Edit account
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <button onClick={() => { setEditingAccount(null); setShowAccountModal(true); }}
                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-xs text-blue-400">
                        <Plus size={11}/> Add mail account
                    </button>
                )}
                {accts.activeAcct && (
                    <button onClick={() => state.fetchFromServer(accts.activeAcct!)} disabled={state.loading}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white disabled:opacity-40">
                        <RefreshCw size={13} className={state.loading ? 'animate-spin' : ''}/>
                    </button>
                )}
                {state.syncStatus && <span className="text-[10px] text-slate-500 truncate">{state.syncStatus}</span>}
                <div className="flex-1"/>
                <button onClick={() => { setEditingAccount(null); setShowAccountModal(true); }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400" title="Manage accounts">
                    <Settings size={13}/>
                </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
                <MailSidebar state={state} t={t}/>
                <EmailList state={state}/>
                <EmailViewer state={state}/>
            </div>
            <ComposeModal state={state} t={t}/>
            {showAccountModal && (
                <AccountModal account={editingAccount} onSave={accts.saveAccount} onClose={() => setShowAccountModal(false)}/>
            )}
        </div>
    );
};

export default MailApp;
