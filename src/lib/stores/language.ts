import { writable, derived, get } from 'svelte/store';
import { configStore } from '../utils/configStore';
import { english } from '../translations/english';
import { polish } from '../translations/polish';
import { german } from '../translations/german';
import { french } from '../translations/french';
import { spanish } from '../translations/spanish';
import { russian } from '../translations/russian';
import { ukrainian } from '../translations/ukrainian';
import { czech } from '../translations/czech';
import { italian } from '../translations/italian';
import { portuguese } from '../translations/portuguese';
import { dutch } from '../translations/dutch';
import { swedish } from '../translations/swedish';
import { turkish } from '../translations/turkish';
import { japanese } from '../translations/japanese';
import { chinese } from '../translations/chinese';
import { arabic } from '../translations/arabic';
import type { Translations } from '../translations/types';

export type Language = 'en' | 'pl' | 'de' | 'fr' | 'es' | 'ru' | 'uk' | 'cs'
  | 'it' | 'pt' | 'nl' | 'sv' | 'tr' | 'ja' | 'zh' | 'ar';

export interface LanguageMeta {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  /** Right-to-left script (currently only Arabic) — consumers can use this to set `dir="rtl"`. */
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: 'EN' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: 'PL' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: 'DE' },
  { code: 'fr', name: 'French', nativeName: 'Francais', flag: 'FR' },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol', flag: 'ES' },
  { code: 'ru', name: 'Russian', nativeName: 'Russkiy', flag: 'RU' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Ukrayinska', flag: 'UA' },
  { code: 'cs', name: 'Czech', nativeName: 'Cestina', flag: 'CS' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: 'IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugues', flag: 'PT' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: 'NL' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: 'SE' },
  { code: 'tr', name: 'Turkish', nativeName: 'Turkce', flag: 'TR' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: 'JP' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: 'CN' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: 'SA', rtl: true },
];

const LANGUAGE_MAP: Record<Language, Translations> = {
  en: english,
  pl: polish,
  de: german,
  fr: french,
  es: spanish,
  ru: russian,
  uk: ukrainian,
  cs: czech,
  it: italian,
  pt: portuguese,
  nl: dutch,
  sv: swedish,
  tr: turkish,
  ja: japanese,
  zh: chinese,
  ar: arabic,
};

function detectLocale(): Language {
  const nav = navigator.language.toLowerCase().split('-')[0];
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === nav);
  return match ? (match.code as Language) : 'en';
}

export const language = writable<Language>('en');

/** Reactive translator: `$t('topbar.start')`. Falls back to English, then the key itself. */
export const t = derived(language, ($language) => {
  return (key: string): string => LANGUAGE_MAP[$language]?.[key] ?? LANGUAGE_MAP.en?.[key] ?? key;
});

/** Non-reactive one-off lookup, e.g. inside event handlers or .ts files. */
export function translate(key: string): string {
  return LANGUAGE_MAP[get(language)]?.[key] ?? LANGUAGE_MAP.en?.[key] ?? key;
}

export function setLanguage(lang: Language) {
  language.set(lang);
  configStore.save({ language: lang }).catch(console.error);
}

let initialised = false;
/** Call once from the root App.svelte onMount. */
export function initLanguage() {
  if (initialised) return;
  initialised = true;

  configStore
    .init()
    .then((cfg) => {
      const lang = cfg.language as Language | undefined;
      if (lang && LANGUAGE_MAP[lang]) {
        language.set(lang);
      } else {
        const detected = detectLocale();
        language.set(detected);
        configStore.save({ language: detected }).catch(() => {});
      }
    })
    .catch(() => language.set(detectLocale()));

  configStore.subscribe((cfg) => {
    const lang = cfg.language as Language | undefined;
    if (lang && LANGUAGE_MAP[lang]) language.set(lang);
  });
}
