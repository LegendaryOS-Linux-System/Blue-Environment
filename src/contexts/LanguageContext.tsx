import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemBridge } from '../utils/systemBridge';

// ------------------------------------------------------------------
// Typy i słowniki
// ------------------------------------------------------------------

type Language = 'en' | 'pl';

type Translations = Record<string, string>;

const en: Translations = {
    // Ogólne
    'app.name': 'Blue Environment',
    'app.version': 'Version',

    // Top bar
    'topbar.search': 'Search apps…',
    'topbar.start': 'Start',
    'topbar.workspace': 'Workspace',

    // Start menu
    'startmenu.recent': 'Recent',
    'startmenu.all_apps': 'All apps',
    'startmenu.power': 'Power',
    'startmenu.shutdown': 'Shut Down',
    'startmenu.restart': 'Restart',
    'startmenu.logout': 'Log Out',
    'startmenu.suspend': 'Suspend',
    'startmenu.hibernate': 'Hibernate',
    'startmenu.new_folder': 'New Folder',
    'startmenu.new_text_file': 'New Text File',
    'startmenu.session': 'Session',

    // Ustawienia
    'settings.title': 'Settings',
    'settings.display': 'Display',
    'settings.personalization': 'Personalization',
    'settings.wifi': 'Wi-Fi',
    'settings.bluetooth': 'Bluetooth',
    'settings.power': 'Power',
    'settings.panel': 'Panel',
    'settings.about': 'About',
    'settings.language': 'Language',
    'settings.accounts': 'Accounts',
    'settings.apps': 'Applications',
    'settings.brightness': 'Brightness',
    'settings.display_scale': 'Display Scale',
    'settings.resolution': 'Resolution',
    'settings.refresh_rate': 'Refresh Rate',
    'settings.wallpaper': 'Wallpaper',
    'settings.builtin_themes': 'Built-in Themes',
    'settings.custom_themes': 'Custom Themes',
    'settings.add_theme': 'Add Theme',
    'settings.new_css_theme': 'New CSS Theme',
    'settings.theme_name': 'Theme Name',
    'settings.css_code': 'CSS Code',
    'settings.accent': 'Accent',
    'settings.custom_theme': 'Custom Theme',
    'settings.apply': 'Apply',
    'settings.delete': 'Delete',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save',
    'settings.connected': 'Connected',
    'settings.secured': 'Secured',
    'settings.open': 'Open',
    'settings.disconnect': 'Disconnect',
    'settings.connect': 'Connect',
    'settings.connecting': 'Connecting...',
    'settings.no_networks': 'No networks found',
    'settings.no_devices': 'No devices found',
    'settings.disconnected': 'Disconnected',
    'settings.battery': 'Battery',
    'settings.charging': 'Charging',
    'settings.on_battery': 'On battery',
    'settings.power_profiles': 'Power Profiles',
    'settings.power_saver': 'Power Saver',
    'settings.balanced': 'Balanced',
    'settings.performance': 'Performance',
    'settings.enable_panel': 'Enable Panel',
    'settings.panel_position': 'Position',
    'settings.panel_size': 'Size',
    'settings.panel_opacity': 'Opacity',
    'settings.top': 'Top',
    'settings.bottom': 'Bottom',
    'settings.left': 'Left',
    'settings.right': 'Right',
    'settings.select_language': 'Select language',
    'settings.language_restart_hint': 'Language change requires restart',
    'settings.night_light': 'Night Light',
    'settings.night_light_temperature': 'Color temperature',
    'settings.night_light_schedule': 'Schedule',
    'settings.manual': 'Manual',
    'settings.sunset': 'Sunset to sunrise',
    'settings.start_hour': 'Start hour',
    'settings.end_hour': 'End hour',
    'settings.loading': 'Loading',
    'settings.no_custom_themes': 'No custom themes yet',

    // Aplikacje
    'blueai.title': 'Blue AI',
    'bluecode.title': 'Blue Code',
    'bluesoftware.title': 'Blue Software',
    'mail.title': 'Mail',
    'terminal.title': 'Terminal',
    'bluearchive.title': 'Blue Archive',
    'blueimages.title': 'Blue Images',
    'bluevideo.title': 'Blue Video',
    'bluescreenshot.title': 'Blue Screenshot',
    'systemmonitor.title': 'System Monitor',

    // Mail
    'mail.select_email': 'Select an email to read',
    'mail.send': 'Send',
    'mail.inbox': 'Inbox',
    'mail.sent': 'Sent',
    'mail.drafts': 'Drafts',
    'mail.compose': 'Compose',
    'mail.subject': 'Subject',
    'mail.body': 'Message',

    // Terminal
    'terminal.help': 'Type "help" for commands.',

    // Software
    'software.installed': 'Installed',
    'software.available': 'Available',
    'software.updates': 'Updates',
    'software.install': 'Install',
    'software.uninstall': 'Uninstall',
    'software.update': 'Update',

    // Code
    'code.file': 'File',
    'code.edit': 'Edit',
    'code.view': 'View',
    'code.new_file': 'New File',
    'code.open_file': 'Open File',
    'code.save': 'Save',

    // AI
    'ai.service': 'AI Service',
    'ai.select_service': 'Select AI Service',
    'ai.login': 'Login',
    'ai.logout': 'Logout',
    'ai.placeholder': 'Ask me anything...',
    'ai.thinking': 'Thinking...',
    'ai.welcome': 'Welcome to Blue AI! Choose a service and set your API key to get started.',

    // Archive
    'archive.open': 'Open Archive',
    'archive.extract': 'Extract All',
    'archive.entries': 'entries',
    'archive.ready': 'Ready',
    'archive.loading': 'Archive loaded — entries require Tauri backend',

    // Screenshot
    'screenshot.capture': 'Capture',
    'screenshot.fullscreen': 'Fullscreen',
    'screenshot.region': 'Region',
    'screenshot.window': 'Window',
    'screenshot.timer': 'Timer',
    'screenshot.history': 'History',
    'screenshot.settings': 'Screenshot Settings',
    'screenshot.save_path': 'Save path',
    'screenshot.format': 'Format',
    'screenshot.copy': 'Copy to clipboard',
    'screenshot.saved': 'Saved',
};

const pl: Translations = {
    // Ogólne
    'app.name': 'Blue Environment',
    'app.version': 'Wersja',

    // Top bar
    'topbar.search': 'Szukaj aplikacji…',
    'topbar.start': 'Start',
    'topbar.workspace': 'Obszar roboczy',

    // Start menu
    'startmenu.recent': 'Ostatnie',
    'startmenu.all_apps': 'Wszystkie aplikacje',
    'startmenu.power': 'Zasilanie',
    'startmenu.shutdown': 'Wyłącz',
    'startmenu.restart': 'Uruchom ponownie',
    'startmenu.logout': 'Wyloguj',
    'startmenu.suspend': 'Uśpij',
    'startmenu.hibernate': 'Hibernuj',
    'startmenu.new_folder': 'Nowy folder',
    'startmenu.new_text_file': 'Nowy plik tekstowy',
    'startmenu.session': 'Sesja',

    // Ustawienia
    'settings.title': 'Ustawienia',
    'settings.display': 'Ekran',
    'settings.personalization': 'Personalizacja',
    'settings.wifi': 'Wi-Fi',
    'settings.bluetooth': 'Bluetooth',
    'settings.power': 'Zasilanie',
    'settings.panel': 'Panel',
    'settings.about': 'O systemie',
    'settings.language': 'Język',
    'settings.accounts': 'Konta',
    'settings.apps': 'Aplikacje',
    'settings.brightness': 'Jasność',
    'settings.display_scale': 'Skalowanie',
    'settings.resolution': 'Rozdzielczość',
    'settings.refresh_rate': 'Częstotliwość',
    'settings.wallpaper': 'Tapeta',
    'settings.builtin_themes': 'Motywy wbudowane',
    'settings.custom_themes': 'Motywy własne',
    'settings.add_theme': 'Dodaj motyw',
    'settings.new_css_theme': 'Nowy motyw CSS',
    'settings.theme_name': 'Nazwa motywu',
    'settings.css_code': 'Kod CSS',
    'settings.accent': 'Akcent',
    'settings.custom_theme': 'Motyw własny',
    'settings.apply': 'Zastosuj',
    'settings.delete': 'Usuń',
    'settings.cancel': 'Anuluj',
    'settings.save': 'Zapisz',
    'settings.connected': 'Połączono',
    'settings.secured': 'Zabezpieczona',
    'settings.open': 'Otwarta',
    'settings.disconnect': 'Rozłącz',
    'settings.connect': 'Połącz',
    'settings.connecting': 'Łączenie...',
    'settings.no_networks': 'Brak sieci',
    'settings.no_devices': 'Brak urządzeń',
    'settings.disconnected': 'Rozłączono',
    'settings.battery': 'Bateria',
    'settings.charging': 'Ładowanie',
    'settings.on_battery': 'Na baterii',
    'settings.power_profiles': 'Profile zasilania',
    'settings.power_saver': 'Oszczędzanie energii',
    'settings.balanced': 'Zrównoważony',
    'settings.performance': 'Wydajność',
    'settings.enable_panel': 'Włącz panel',
    'settings.panel_position': 'Pozycja',
    'settings.panel_size': 'Rozmiar',
    'settings.panel_opacity': 'Przezroczystość',
    'settings.top': 'Góra',
    'settings.bottom': 'Dół',
    'settings.left': 'Lewo',
    'settings.right': 'Prawo',
    'settings.select_language': 'Wybierz język',
    'settings.language_restart_hint': 'Zmiana języka wymaga restartu',
    'settings.night_light': 'Nocne światło',
    'settings.night_light_temperature': 'Temperatura barwowa',
    'settings.night_light_schedule': 'Harmonogram',
    'settings.manual': 'Ręcznie',
    'settings.sunset': 'Zachód – wschód słońca',
    'settings.start_hour': 'Godzina rozpoczęcia',
    'settings.end_hour': 'Godzina zakończenia',
    'settings.loading': 'Ładowanie',
    'settings.no_custom_themes': 'Brak własnych motywów',

    // Aplikacje
    'blueai.title': 'Blue AI',
    'bluecode.title': 'Blue Code',
    'bluesoftware.title': 'Blue Software',
    'mail.title': 'Poczta',
    'terminal.title': 'Terminal',
    'bluearchive.title': 'Blue Archive',
    'blueimages.title': 'Blue Images',
    'bluevideo.title': 'Blue Video',
    'bluescreenshot.title': 'Blue Screenshot',
    'systemmonitor.title': 'Monitor systemu',

    // Mail
    'mail.select_email': 'Wybierz wiadomość',
    'mail.send': 'Wyślij',
    'mail.inbox': 'Odebrane',
    'mail.sent': 'Wysłane',
    'mail.drafts': 'Szkice',
    'mail.compose': 'Nowa wiadomość',
    'mail.subject': 'Temat',
    'mail.body': 'Treść',

    // Terminal
    'terminal.help': 'Wpisz "help" aby zobaczyć komendy.',

    // Software
    'software.installed': 'Zainstalowane',
    'software.available': 'Dostępne',
    'software.updates': 'Aktualizacje',
    'software.install': 'Zainstaluj',
    'software.uninstall': 'Odinstaluj',
    'software.update': 'Aktualizuj',

    // Code
    'code.file': 'Plik',
    'code.edit': 'Edycja',
    'code.view': 'Widok',
    'code.new_file': 'Nowy plik',
    'code.open_file': 'Otwórz plik',
    'code.save': 'Zapisz',

    // AI
    'ai.service': 'Usługa AI',
    'ai.select_service': 'Wybierz usługę AI',
    'ai.login': 'Zaloguj',
    'ai.logout': 'Wyloguj',
    'ai.placeholder': 'Zadaj pytanie...',
    'ai.thinking': 'Myślę...',
    'ai.welcome': 'Witaj w Blue AI! Wybierz usługę i ustaw klucz API.',

    // Archive
    'archive.open': 'Otwórz archiwum',
    'archive.extract': 'Wypakuj wszystko',
    'archive.entries': 'elementów',
    'archive.ready': 'Gotowy',
    'archive.loading': 'Archiwum załadowane — elementy wymagają backendu Tauri',

    // Screenshot
    'screenshot.capture': 'Przechwyć',
    'screenshot.fullscreen': 'Pełny ekran',
    'screenshot.region': 'Obszar',
    'screenshot.window': 'Okno',
    'screenshot.timer': 'Timer',
    'screenshot.history': 'Historia',
    'screenshot.settings': 'Ustawienia zrzutów',
    'screenshot.save_path': 'Ścieżka zapisu',
    'screenshot.format': 'Format',
    'screenshot.copy': 'Kopiuj do schowka',
    'screenshot.saved': 'Zapisano',
};

const translations = { en, pl };

// ------------------------------------------------------------------
// Kontekst
// ------------------------------------------------------------------

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = (): LanguageContextType => {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return ctx;
};

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('en');

    useEffect(() => {
        // Pobranie zapisanego języka z konfiguracji użytkownika
        SystemBridge.loadConfig()
        .then(config => {
            if (config.language === 'pl') setLanguage('pl');
            else setLanguage('en');
        })
        .catch(() => {
            // W razie błędu pozostaje angielski
            setLanguage('en');
        });
    }, []);

    const t = (key: string): string => {
        const dict = translations[language];
        return dict[key] ?? key;
    };

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        // Zapis do konfiguracji użytkownika
        SystemBridge.loadConfig()
        .then(config => {
            SystemBridge.saveConfig({ ...config, language: lang }).catch(console.error);
        })
        .catch(console.error);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
        {children}
        </LanguageContext.Provider>
    );
};
