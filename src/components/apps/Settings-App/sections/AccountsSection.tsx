import React, { useState } from 'react';
import type { UserConfig } from '../../../../types';
import { SystemBridge } from '../../../../utils/systemBridge';

interface Props { config: UserConfig; onSave: (p: Partial<UserConfig>) => Promise<void>; }

const AccountsSection: React.FC<Props> = ({ config, onSave }) => {
    const [showLogin, setShowLogin] = useState(false);

    const handleGoogle = async () => {
        const result = await SystemBridge.googleSignIn();
        if (result) { await onSave({ accounts: { ...config.accounts, google: result.user } }); setShowLogin(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-2xl font-bold text-white">Accounts</h2>
            <div className="bg-slate-800 p-6 rounded-2xl border border-white/5">
                {!config.accounts?.google && (
                    <button onClick={() => setShowLogin(true)}
                        className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 p-3 rounded-lg hover:bg-slate-100 transition-colors">
                        <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                        Sign in with Google
                    </button>
                )}
                {config.accounts?.google && (
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                            {(config.accounts.google as any).email}
                        </div>
                        <button onClick={() => onSave({ accounts: { ...config.accounts, google: undefined } })}
                            className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                )}
            </div>
            {showLogin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-2xl p-6 w-96 border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4">Sign in with Google</h3>
                        <p className="text-sm text-slate-300 mb-4">You will be redirected to Google.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowLogin(false)}
                                className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600">Cancel</button>
                            <button onClick={handleGoogle}
                                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500">Continue</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default AccountsSection;
