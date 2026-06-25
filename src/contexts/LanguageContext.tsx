import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { configStore } from '../utils/configStore';
import { english } from './translations/english';
import { polish } from './translations/polish';
import type { Translations } from './translations/types';

// ── Types ──────────────────────────────────────────────────────────────────

export type Language = 'en' | 'pl';

const LANGUAGE_MAP: Record<Language, Translations> = { en: english, pl: polish };

interface LanguageContextType {
    language: Language;
    /** Persists the new language via configStore. Change takes effect immediately. */
    setLanguage: (lang: Language) => void;
    /** Returns the localised string for `key`, falling back to the key itself. */
    t: (key: string) => string;
}

// ── Context ────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = (): LanguageContextType => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
    return ctx;
};

// ── Provider ───────────────────────────────────────────────────────────────

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLangState] = useState<Language>('en');

    // On mount, read the language that was previously saved in the config file.
    useEffect(() => {
        configStore.init().then(cfg => {
            const lang = cfg.language as Language | undefined;
            if (lang === 'pl' || lang === 'en') setLangState(lang);
        }).catch(() => {});

        // Also subscribe so that if another part of the app calls
        // configStore.save({ language: ... }) the language here follows.
        const unsub = configStore.subscribe(cfg => {
            const lang = cfg.language as Language | undefined;
            if (lang && LANGUAGE_MAP[lang]) setLangState(lang);
        });
        return unsub;
    }, []);

    const handleSetLanguage = useCallback((lang: Language) => {
        setLangState(lang);
        // Persist through configStore — the single path for all config writes.
        // This was the root cause of language changes not surviving: the old
        // code saved via SystemBridge directly, so the next configStore.save()
        // call (e.g. saving wallpaper) would overwrite the file from its own
        // cached copy that didn't include the language change.
        configStore.save({ language: lang }).catch(console.error);
    }, []);

    const t = useCallback((key: string): string => {
        return LANGUAGE_MAP[language]?.[key] ?? LANGUAGE_MAP['en']?.[key] ?? key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
