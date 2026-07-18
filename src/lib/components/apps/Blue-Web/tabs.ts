import { writable, get } from 'svelte/store';
import type { Tab } from './types';
import { normalizeUrl } from './types';
import { SystemBridge } from '../../../utils/systemBridge';

function makeTab(url = ''): Tab {
  const id = `t${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const title = url ? (() => { try { return new URL(url).hostname; } catch { return url; } })() : 'New Tab';
  return { id, url, title, isNew: !url };
}

export function createTabs(onNavigate: (url: string, tabId: string) => void) {
  const first = makeTab();
  const tabs = writable<Tab[]>([first]);
  const activeId = writable(first.id);

  async function openUrl(rawUrl: string, tabId?: string) {
    const url = normalizeUrl(rawUrl);
    const id = tabId ?? get(activeId);
    const title = (() => { try { return new URL(url).hostname; } catch { return url; } })();

    tabs.update((prev) => prev.map((t) => (t.id === id ? { ...t, url, title, isNew: false } : t)));
    onNavigate(url, id);

    if (SystemBridge.isTauri()) {
      try { await SystemBridge.invokeCommand('web_open_native', { url }); } catch {}
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  function addTab() {
    const t = makeTab();
    tabs.update((prev) => [...prev, t]);
    activeId.set(t.id);
    return t.id;
  }

  function closeTab(id: string, e?: MouseEvent) {
    e?.stopPropagation();
    const current = get(activeId);
    tabs.update((prev) => {
      if (prev.length === 1) { const t = makeTab(); activeId.set(t.id); return [t]; }
      const next = prev.filter((t) => t.id !== id);
      if (current === id) activeId.set(next[next.length - 1].id);
      return next;
    });
  }

  return { tabs, activeId, openUrl, addTab, closeTab };
}
