<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { AppId } from '../types';
  import { APPS } from '../constants';
  import { Search, Wifi, Bell, Command, CloudSun, Cloud, CloudRain, CloudSnow, Sun, Clipboard } from 'lucide-svelte';
  import { SystemBridge } from '../utils/systemBridge';
  import { configStore } from '../utils/configStore';
  import { createEventDispatcher } from 'svelte';

  export let openWindows: { id: string; appId: AppId; isMinimized: boolean; isActive: boolean; workspace: number }[] = [];
  export let currentWorkspace = 0;
  export let workspaceCount = 4;
  export let isStartMenuOpen = false;
  export let isClipboardOpen = false;

  const dispatch = createEventDispatcher<{
    openApp: string;
    toggleWindow: string;
    startClick: void;
    startDoubleClick: void;
    toggleControlCenter: void;
    toggleNotifications: void;
    switchWorkspace: number;
    toggleClipboard: void;
  }>();

  interface WeatherData { temp: string; code: number; city: string; }

  function weatherIconFor(code: number) {
    if (code === 0) return { Icon: Sun, cls: 'text-yellow-300' };
    if (code <= 3) return { Icon: CloudSun, cls: 'text-yellow-200' };
    if (code <= 67) return { Icon: CloudRain, cls: 'text-blue-300' };
    if (code <= 77) return { Icon: CloudSnow, cls: 'text-blue-100' };
    return { Icon: Cloud, cls: 'text-slate-300' };
  }

  async function fetchWeather(): Promise<WeatherData | null> {
    try {
      const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      const geo = await geoRes.json();
      const { latitude, longitude, city } = geo;
      if (!latitude || !longitude) return null;

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
      const wxRes = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const wx = await wxRes.json();
      if (!wx.current_weather) return null;

      return {
        temp: `${Math.round(wx.current_weather.temperature)}°C`,
        code: wx.current_weather.weathercode,
        city: city ?? 'Unknown',
      };
    } catch {
      return null;
    }
  }

  let time = new Date();
  let weather: WeatherData | null = null;
  let hasClipboardContent = false;
  let pinnedApps: AppId[] = [AppId.TERMINAL, AppId.EXPLORER, AppId.SYSTEM_MONITOR, AppId.SETTINGS];
  let panelOpacity = 0.95;
  let panelHeight = 48;

  let clockTimer: ReturnType<typeof setInterval>;
  let weatherTimer: ReturnType<typeof setInterval>;
  let clipboardTimer: ReturnType<typeof setInterval>;
  let unsubConfig: () => void;

  onMount(() => {
    clockTimer = setInterval(() => (time = new Date()), 1000);

    const loadWeather = () => fetchWeather().then((w) => { if (w) weather = w; });
    loadWeather();
    weatherTimer = setInterval(loadWeather, 30 * 60 * 1000);

    const checkClipboard = async () => {
      try { hasClipboardContent = await SystemBridge.hasText(); } catch {}
    };
    checkClipboard();
    clipboardTimer = setInterval(checkClipboard, 4000);

    unsubConfig = configStore.subscribe((cfg) => {
      const pinned = (cfg as any).pinnedApps as AppId[] | undefined;
      if (pinned && Array.isArray(pinned) && pinned.length > 0) pinnedApps = pinned;
      if (typeof cfg.panelOpacity === 'number') panelOpacity = cfg.panelOpacity;
      if (typeof cfg.panelSize === 'number' && cfg.panelSize > 0) panelHeight = cfg.panelSize;
    });
  });

  onDestroy(() => {
    clearInterval(clockTimer);
    clearInterval(weatherTimer);
    clearInterval(clipboardTimer);
    unsubConfig?.();
  });

  function handleStartClick(e: MouseEvent) {
    if (e.detail === 2) dispatch('startDoubleClick');
    else dispatch('startClick');
  }
</script>

<div
  class="absolute top-0 left-0 right-0 backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-3 z-50 select-none"
  style="height:{panelHeight}px; background-color:rgba(15, 23, 42, {panelOpacity});"
>
  <!-- Left: Start + search -->
  <div class="flex items-center gap-3 w-1/3">
    <button
      on:click={handleStartClick}
      class="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all group {isStartMenuOpen ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'}"
      title="Start (double-click for full screen)"
    >
      <div class="relative">
        <Command size={18} class="group-hover:rotate-12 transition-transform duration-200" />
        <div class="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
      </div>
      <span class="font-bold text-sm tracking-tight hidden sm:block">Blue</span>
    </button>
    <div
      class="hidden md:flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 rounded-full px-3 py-1 text-xs text-slate-400 cursor-text transition-colors w-44"
      on:click={() => dispatch('startClick')}
    >
      <Search size={12} />
      <span>Search apps...</span>
    </div>
  </div>

  <!-- Center: pinned apps -->
  <div class="flex items-center justify-center w-1/3">
    <div class="flex items-center gap-1 bg-slate-800/60 border border-white/5 rounded-2xl px-2 py-1 shadow-lg">
      {#each pinnedApps as appId (appId)}
        {@const app = APPS[appId]}
        {#if app}
          {@const openInsts = openWindows.filter((w) => w.appId === appId)}
          {@const isOpen = openInsts.length > 0}
          {@const isActive = openInsts.some((w) => w.isActive && !w.isMinimized)}
          <button
            on:click={() => {
              const inst = openWindows.find((w) => w.appId === appId);
              if (inst) dispatch('toggleWindow', inst.id);
              else dispatch('openApp', appId);
            }}
            class="relative group p-2 rounded-xl transition-all hover:bg-white/10"
            title={app.title}
          >
            {#if typeof app.icon !== 'string'}
              <svelte:component this={app.icon} size={20}
                class="transition-colors duration-200 {isOpen ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}" />
            {/if}
            {#if isOpen}
              <span class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all {isActive ? 'w-3.5 bg-blue-400' : 'w-1 bg-slate-500'}" />
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Right -->
  <div class="flex items-center justify-end gap-2 w-1/3">
    <div class="hidden lg:flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/5 transition-colors">
      {#each Array.from({ length: workspaceCount }, (_, i) => i) as i (i)}
        {@const hasWins = openWindows.some((w) => w.workspace === i && !w.isMinimized)}
        <button on:click={() => dispatch('switchWorkspace', i)} title="Workspace {i + 1}"
          class="transition-all duration-200 rounded-full {i === currentWorkspace ? 'w-4 h-2 bg-blue-400' : `w-2 h-2 ${hasWins ? 'bg-slate-400' : 'bg-slate-600'} hover:bg-slate-300`}" />
      {/each}
    </div>

    {#if weather}
      {@const wi = weatherIconFor(weather.code)}
      <div class="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-white/5 cursor-default transition-colors"
           title="{weather.city}: {weather.temp}">
        <svelte:component this={wi.Icon} size={14} class={wi.cls} />
        <span class="text-xs font-medium text-slate-200">{weather.temp}</span>
      </div>
    {/if}

    <button on:click={() => dispatch('toggleClipboard')}
      class="relative p-2 rounded-full transition-colors group {isClipboardOpen ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/10 text-slate-300'}"
      title="Clipboard history">
      <Clipboard size={15} class="group-hover:text-white" />
      {#if hasClipboardContent}
        <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
      {/if}
    </button>

    <button on:click={() => dispatch('toggleControlCenter')}
      class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors border border-transparent hover:border-white/5">
      <Wifi size={13} class="text-slate-300" />
      <span class="text-xs font-medium text-slate-200 tabular-nums">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </button>

    <button on:click={() => dispatch('toggleNotifications')} class="relative p-2 rounded-full hover:bg-white/10 transition-colors group">
      <Bell size={15} class="text-slate-300 group-hover:text-white" />
      <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 border border-slate-900 rounded-full" />
    </button>
  </div>
</div>
