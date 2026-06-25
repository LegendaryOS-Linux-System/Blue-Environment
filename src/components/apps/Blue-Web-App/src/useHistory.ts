import { useState, useCallback } from 'react';
import { HistoryEntry, BookmarkItem } from './types';

const LS_HISTORY   = 'bw_history';
const LS_BOOKMARKS = 'bw_bookmarks';
const MAX_HISTORY  = 200;

function load<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}

export function useHistory() {
    const [history,   setHistory]   = useState<HistoryEntry[]>(() => load(LS_HISTORY,   []));
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => load(LS_BOOKMARKS, []));
    const [navStack,  setNavStack]  = useState<string[]>([]);
    const [navIdx,    setNavIdx]    = useState(-1);

    const addHistory = useCallback((url: string, title: string) => {
        setNavStack(prev => {
            const next = [...prev.slice(0, navIdx + 1), url];
            setNavIdx(next.length - 1);
            return next;
        });
        setHistory(prev => {
            const next = [{ url, title, time: Date.now() }, ...prev.filter(h => h.url !== url)].slice(0, MAX_HISTORY);
            localStorage.setItem(LS_HISTORY, JSON.stringify(next));
            return next;
        });
    }, [navIdx]);

    const clearHistory = useCallback(() => { setHistory([]); localStorage.removeItem(LS_HISTORY); }, []);

    const toggleBookmark = useCallback((url: string, title: string) => {
        setBookmarks(prev => {
            const next = prev.some(b => b.url === url) ? prev.filter(b => b.url !== url) : [{ url, title }, ...prev];
            localStorage.setItem(LS_BOOKMARKS, JSON.stringify(next));
            return next;
        });
    }, []);

    const canGoBack    = navIdx > 0;
    const canGoForward = navIdx < navStack.length - 1;
    const goBack    = () => navIdx > 0 ? navStack[navIdx - 1] : null;
    const goForward = () => navIdx < navStack.length - 1 ? navStack[navIdx + 1] : null;
    const goBackNav    = () => { if (canGoBack)    setNavIdx(i => i - 1); return canGoBack    ? navStack[navIdx - 1] : null; };
    const goForwardNav = () => { if (canGoForward) setNavIdx(i => i + 1); return canGoForward ? navStack[navIdx + 1] : null; };

    return { history, clearHistory, bookmarks, toggleBookmark, addHistory, isBookmarked: (url: string) => bookmarks.some(b => b.url === url), canGoBack, canGoForward, goBackNav, goForwardNav };
}
