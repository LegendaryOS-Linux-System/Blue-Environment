import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface PromptOptions {
    title: string;
    label?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

export interface AlertOptions {
    title: string;
    message: string;
    confirmLabel?: string;
}

interface PendingPrompt {
    kind: 'prompt';
    options: PromptOptions;
    resolve: (value: string | null) => void;
}

interface PendingConfirm {
    kind: 'confirm';
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
}

interface PendingAlert {
    kind: 'alert';
    options: AlertOptions;
    resolve: () => void;
}

type PendingDialog = PendingPrompt | PendingConfirm | PendingAlert;

interface DialogContextType {
    /** Show an in-shell text input dialog. Resolves to the trimmed string, or null if cancelled. */
    prompt: (options: PromptOptions) => Promise<string | null>;
    /** Show an in-shell yes/no confirmation dialog. Resolves to true/false. */
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    /** Show an in-shell single-button informational dialog (replaces window.alert). */
    alert: (options: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const useDialog = (): DialogContextType => {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return ctx;
};

/**
 * Renders in-shell modal dialogs for text prompts and confirmations.
 *
 * This exists so that things like "New Folder" / "New File" naming, or
 * destructive-action confirmations, never fall back to the browser's
 * native window.prompt()/window.confirm(), which renders as an
 * out-of-shell OS dialog (title bar "JavaScript - tauri://localhost").
 * Every other major desktop environment asks these questions inside its
 * own UI, and so does Blue.
 */
export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dialog, setDialog] = useState<PendingDialog | null>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
        return new Promise(resolve => {
            setInputValue(options.defaultValue ?? '');
            setDialog({ kind: 'prompt', options, resolve });
        });
    }, []);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setDialog({ kind: 'confirm', options, resolve });
        });
    }, []);

    const alert = useCallback((options: AlertOptions): Promise<void> => {
        return new Promise(resolve => {
            setDialog({ kind: 'alert', options, resolve: () => resolve() });
        });
    }, []);

    const close = useCallback((result: string | boolean | null) => {
        setDialog(current => {
            if (!current) return null;
            if (current.kind === 'prompt') current.resolve(result as string | null);
            else if (current.kind === 'confirm') current.resolve(result as boolean);
            else current.resolve();
            return null;
        });
    }, []);

    // Autofocus + select the input text whenever a prompt dialog opens.
    useEffect(() => {
        if (dialog?.kind === 'prompt') {
            const id = requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
            return () => cancelAnimationFrame(id);
        }
    }, [dialog]);

    // Keyboard handling: Escape cancels, Enter confirms (prompt only —
    // confirm dialogs require an explicit button click for safety).
    useEffect(() => {
        if (!dialog) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close(dialog.kind === 'prompt' ? null : false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (dialog.kind === 'prompt') close(inputValue.trim());
                else if (dialog.kind === 'alert') close(null);
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [dialog, inputValue, close]);

    return (
        <DialogContext.Provider value={{ prompt, confirm, alert }}>
            {children}
            {dialog && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onMouseDown={e => {
                        if (e.target === e.currentTarget) close(dialog.kind === 'prompt' ? null : false);
                    }}
                >
                    <div className="w-[400px] bg-slate-800 border border-white/10 rounded-2xl shadow-2xl p-5">
                        <h3 className="text-white font-semibold text-base mb-1">{dialog.options.title}</h3>

                        {dialog.kind === 'prompt' && (
                            <>
                                {dialog.options.label && (
                                    <p className="text-slate-400 text-xs mb-3">{dialog.options.label}</p>
                                )}
                                <input
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    placeholder={dialog.options.placeholder}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 mb-4"
                                />
                            </>
                        )}

                        {dialog.kind === 'confirm' && (
                            <p className="text-slate-300 text-sm mb-4 mt-2 leading-relaxed">{dialog.options.message}</p>
                        )}

                        {dialog.kind === 'alert' && (
                            <p className="text-slate-300 text-sm mb-4 mt-2 leading-relaxed">{dialog.options.message}</p>
                        )}

                        <div className="flex justify-end gap-2">
                            {dialog.kind !== 'alert' && (
                                <button
                                    onClick={() => close(dialog.kind === 'prompt' ? null : false)}
                                    className="px-3.5 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-200"
                                >
                                    {dialog.kind === 'confirm' ? (dialog.options.cancelLabel || 'Cancel') : 'Cancel'}
                                </button>
                            )}
                            <button
                                onClick={() => close(dialog.kind === 'prompt' ? inputValue.trim() : true)}
                                className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors text-white ${
                                    dialog.kind === 'confirm' && dialog.options.danger
                                        ? 'bg-red-600 hover:bg-red-500'
                                        : 'bg-blue-600 hover:bg-blue-500'
                                }`}
                            >
                                {dialog.kind === 'alert'
                                    ? (dialog.options.confirmLabel || 'OK')
                                    : (dialog.options.confirmLabel || (dialog.kind === 'prompt' ? 'Create' : 'Confirm'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};
