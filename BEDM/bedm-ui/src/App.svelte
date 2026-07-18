<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import {
    Power, ChevronLeft, Eye, EyeOff, AlertCircle, Loader2,
    ChevronDown, Wifi, WifiOff, Volume2, VolumeX,
    Shield, Monitor, Fingerprint, BatteryLow, BatteryMedium,
    BatteryFull, BatteryCharging, Languages, RefreshCw,
    UserPlus, ZoomIn, ZoomOut, Contrast,
    LockKeyhole, AlertTriangle,
  } from 'lucide-svelte';

  import Background from './lib/components/Background.svelte';
  import Clock from './lib/components/Clock.svelte';
  import UserCard from './lib/components/UserCard.svelte';
  import SessionPicker from './lib/components/SessionPicker.svelte';
  import PowerMenu from './lib/components/PowerMenu.svelte';
  import PatternLock from './lib/components/PatternLock.svelte';
  import { BedmBridge } from './lib/utils/tauri';
  import type { DaemonInfo, UserInfo, SessionInfo, Screen, PowerAction } from './lib/types';

  interface KeyboardLayout { id: string; label: string; flag?: string; }

  const KEYBOARD_LAYOUTS: KeyboardLayout[] = [
    { id: 'us', label: 'US English', flag: 'US' },
    { id: 'pl', label: 'Polish', flag: 'PL' },
    { id: 'de', label: 'German', flag: 'DE' },
    { id: 'fr', label: 'French', flag: 'FR' },
    { id: 'es', label: 'Spanish', flag: 'ES' },
    { id: 'ru', label: 'Russian', flag: 'RU' },
    { id: 'ua', label: 'Ukrainian', flag: 'UA' },
    { id: 'cz', label: 'Czech', flag: 'CZ' },
    { id: 'gb', label: 'UK English', flag: 'GB' },
    { id: 'jp', label: 'Japanese', flag: 'JP' },
    { id: 'cn', label: 'Chinese (PRC)', flag: 'CN' },
    { id: 'ar', label: 'Arabic', flag: 'AR' },
  ];

  const LOCKOUT_AFTER_ATTEMPTS = 5;
  const LOCKOUT_DURATION_SECS = 30;

  // ── Core state ──────────────────────────────────────────────────────────
  let screen: Screen = 'connecting';
  let daemon: DaemonInfo | null = null;
  let users: UserInfo[] = [];
  let sessions: SessionInfo[] = [];
  let wallpaper: string | null = null;
  let avatars: Record<string, string> = {};

  let selectedUser: UserInfo | null = null;
  let selectedSession = '';
  let showSessionPicker = false;

  let password = '';
  let showPassword = false;
  let authError: string | null = null;
  let attemptsLeft = LOCKOUT_AFTER_ATTEMPTS;
  let failCount = 0;
  let lockoutUntil: Date | null = null;
  let lockoutSecsLeft = 0;
  let shake = false;
  let isAuthenticating = false;

  let capsLock = false;
  let networkOk: boolean | null = null;
  let batteryPct: number | null = null;
  let batteryCharging = false;
  let volume: number | null = null;
  let kbLayout: KeyboardLayout = KEYBOARD_LAYOUTS[0];
  let showLayoutPicker = false;

  let highContrast = false;
  let fontSize = 16;

  let showPowerMenu = false;
  let connectError: string | null = null;
  let showGuestOption = false;

  let passwordInput: HTMLInputElement;
  let lockoutTimer: ReturnType<typeof setInterval>;
  let statusPollTimer: ReturnType<typeof setTimeout>;
  let keyHandler: (e: KeyboardEvent) => void;

  onMount(() => {
    init();
    pollSystemStatus();
    keyHandler = (e: KeyboardEvent) => {
      if (e.getModifierState) capsLock = e.getModifierState('CapsLock');
    };
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('keyup', keyHandler);
  });

  onDestroy(() => {
    clearInterval(lockoutTimer);
    clearTimeout(statusPollTimer);
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('keyup', keyHandler);
    }
  });

  async function init() {
    screen = 'connecting';
    try {
      daemon = await BedmBridge.connectDaemon();

      const [usersData, sessionsData, wp] = await Promise.all([
        BedmBridge.getUsers(),
        BedmBridge.getSessions(),
        BedmBridge.getWallpaper(),
      ]);

      users = usersData;
      sessions = sessionsData;
      wallpaper = wp;
      showGuestOption = usersData.some((u) => u.username === 'guest');

      const defaultSession = sessionsData.find((s) => s.id === 'blue-environment') ?? sessionsData[0];
      if (defaultSession) selectedSession = defaultSession.id;

      loadAvatars(usersData);
      screen = 'user-select';
    } catch (e: any) {
      connectError = e?.message ?? 'Cannot connect to BEDM daemon. Is it running as root?';
      screen = 'error';
    }
  }

  async function loadAvatars(usersData: UserInfo[]) {
    for (const user of usersData) {
      if (user.icon_path) {
        try {
          const data = await BedmBridge.readUserAvatar(user.icon_path);
          if (data) avatars = { ...avatars, [user.username]: data };
        } catch {}
      }
    }
  }

  async function pollSystemStatus() {
    try { networkOk = (await BedmBridge.checkNetwork?.()) ?? null; } catch {}
    try {
      const bat = await BedmBridge.getBattery?.();
      if (bat) { batteryPct = bat.percentage; batteryCharging = bat.charging; }
    } catch {}
    try {
      const vol = await BedmBridge.getVolume?.();
      if (vol != null) volume = vol;
    } catch {}
    statusPollTimer = setTimeout(pollSystemStatus, 30_000);
  }

  function startLockout(fails: number) {
    const dur = Math.min(LOCKOUT_DURATION_SECS * Math.pow(2, fails - LOCKOUT_AFTER_ATTEMPTS), 300);
    const until = new Date(Date.now() + dur * 1000);
    lockoutUntil = until;
    lockoutSecsLeft = dur;

    clearInterval(lockoutTimer);
    lockoutTimer = setInterval(async () => {
      const left = Math.ceil((until.getTime() - Date.now()) / 1000);
      if (left <= 0) {
        lockoutUntil = null;
        lockoutSecsLeft = 0;
        clearInterval(lockoutTimer);
        authError = null;
        await tick();
        passwordInput?.focus();
      } else {
        lockoutSecsLeft = left;
      }
    }, 500);
  }

  type AuthMethod = 'password' | 'pattern' | 'fingerprint';
  let authMethod: AuthMethod = 'password';
  let fingerprintAvailable = false;
  let patternAvailable = false;
  let patternError = false;

  async function selectUser(user: UserInfo) {
    selectedUser = user;
    password = '';
    authError = null;
    attemptsLeft = LOCKOUT_AFTER_ATTEMPTS;
    failCount = 0;
    lockoutUntil = null;
    authMethod = 'password';
    patternError = false;
    clearInterval(lockoutTimer);

    if (user.last_session) {
      const found = sessions.find((s) => s.id === user.last_session);
      if (found) selectedSession = user.last_session;
    }

    // Real hardware/config checks — not placeholders. If a laptop has no
    // fingerprint reader (or this user never enrolled one), the option is
    // simply not offered instead of showing a button that can't work.
    fingerprintAvailable = await BedmBridge.hasFingerprint(user.username).catch(() => false);
    patternAvailable = await BedmBridge.patternIsConfigured(user.username, user.home).catch(() => false);

    screen = 'password';
    await tick();
    setTimeout(() => passwordInput?.focus(), 150);
  }

  function goBack() {
    screen = 'user-select';
    selectedUser = null;
    password = '';
    authError = null;
    lockoutUntil = null;
    clearInterval(lockoutTimer);
  }

  $: isLockedOut = lockoutUntil != null && lockoutUntil > new Date();

  function handleAuthOutcome(result: { success: boolean; error?: string }) {
    if (result.success) {
      failCount = 0;
      launchSession(selectedUser!.username, selectedSession);
      return true;
    }
    const newFails = failCount + 1;
    failCount = newFails;
    attemptsLeft = Math.max(0, LOCKOUT_AFTER_ATTEMPTS - newFails);
    authError = result.error ?? 'Authentication failed';
    shake = true;
    setTimeout(() => (shake = false), 500);
    if (newFails >= LOCKOUT_AFTER_ATTEMPTS) startLockout(newFails);
    return false;
  }

  async function authenticate() {
    if (!selectedUser || !password || isAuthenticating || isLockedOut) return;

    isAuthenticating = true;
    authError = null;

    try {
      const result = await BedmBridge.authenticate(selectedUser.username, password);
      password = '';
      const ok = handleAuthOutcome(result);
      if (!ok && failCount < LOCKOUT_AFTER_ATTEMPTS) setTimeout(() => passwordInput?.focus(), 100);
    } catch (e: any) {
      authError = e?.message ?? 'Authentication error';
      shake = true;
      setTimeout(() => (shake = false), 500);
    } finally {
      isAuthenticating = false;
    }
  }

  async function authenticateWithPattern(pattern: number[]) {
    if (!selectedUser || isAuthenticating || isLockedOut) return;
    isAuthenticating = true;
    authError = null;
    patternError = false;
    try {
      const result = await BedmBridge.authenticatePattern(selectedUser.username, pattern);
      const ok = handleAuthOutcome(result);
      if (!ok) patternError = true;
      setTimeout(() => (patternError = false), 600);
    } catch (e: any) {
      authError = e?.message ?? 'Pattern authentication error';
      patternError = true;
    } finally {
      isAuthenticating = false;
    }
  }

  async function authenticateWithFingerprint() {
    if (!selectedUser || isAuthenticating || isLockedOut) return;
    isAuthenticating = true;
    authError = null;
    try {
      // This call blocks (real hardware scan) until the daemon's
      // fprintd-verify subprocess returns a match/no-match/timeout.
      const result = await BedmBridge.authenticateFingerprint(selectedUser.username);
      handleAuthOutcome(result);
    } catch (e: any) {
      authError = e?.message ?? 'Fingerprint authentication error';
    } finally {
      isAuthenticating = false;
    }
  }

  async function launchSession(username: string, sessionId: string) {
    screen = 'logging-in';
    try {
      await BedmBridge.startSession(username, sessionId);
    } catch (e: any) {
      authError = e?.message ?? 'Session failed to start';
      screen = 'password';
    }
  }

  async function loginAsGuest() {
    await launchSession('guest', selectedSession);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') authenticate();
    if (e.key === 'Escape') goBack();
  }

  async function handlePower(e: CustomEvent<PowerAction>) {
    showPowerMenu = false;
    await BedmBridge.powerAction(e.detail);
  }

  function changeKbLayout(layout: KeyboardLayout) {
    kbLayout = layout;
    showLayoutPicker = false;
    BedmBridge.setKeyboardLayout?.(layout.id).catch(() => {});
  }

  $: currentSession = sessions.find((s) => s.id === selectedSession);

  function formatUptime(secs: number) {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  $: BatteryIcon = batteryCharging
    ? BatteryCharging
    : batteryPct != null && batteryPct < 20
    ? BatteryLow
    : batteryPct != null && batteryPct < 60
    ? BatteryMedium
    : BatteryFull;

  $: rootStyle = `font-size:${fontSize}px; ${highContrast ? 'filter:contrast(1.4) saturate(0.7);' : ''}`;

  function isWayland(type?: string) { return type === 'wayland'; }
</script>

<!-- FIX "wychodzi poza ekran": use w-full/h-full anchored to the fixed,
     zero-inset #app root (see index.html) instead of w-screen/h-screen,
     which report the *display* viewport and can exceed the actual Tauri
     window box during the fullscreen negotiation on non-1920x1080 screens. -->
<div class="relative w-full h-full" style={rootStyle}>
  <Background {wallpaper} />

  <!-- Top system bar -->
  <div class="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-3 z-20">
    <div class="flex items-center gap-2.5">
      <div class="w-7 h-7 rounded-xl flex items-center justify-center"
           style="background:linear-gradient(135deg,#1d4ed8,#7c3aed); box-shadow:0 0 14px rgba(59,130,246,.4);">
        <Shield size={14} class="text-white" />
      </div>
      <span class="text-slate-500 text-xs tracking-[0.18em] uppercase" style="font-family:'Oxanium',monospace;">
        BEDM
      </span>
      {#if daemon}
        <span class="text-slate-700 text-xs" style="font-family:'JetBrains Mono',monospace;">v{daemon.version}</span>
      {/if}
    </div>

    <div class="flex items-center gap-3">
      {#if networkOk === true}
        <span title="Connected"><Wifi size={14} class="text-slate-500" /></span>
      {/if}
      {#if networkOk === false}
        <span title="No network"><WifiOff size={14} class="text-yellow-600" /></span>
      {/if}

      {#if volume != null}
        {#if volume > 0}
          <span title="Volume {volume}%"><Volume2 size={14} class="text-slate-500" /></span>
        {:else}
          <span title="Muted"><VolumeX size={14} class="text-slate-600" /></span>
        {/if}
      {/if}

      {#if batteryPct != null}
        <div class="flex items-center gap-1">
          <svelte:component this={BatteryIcon} size={14}
            class={batteryCharging ? 'text-green-500' : batteryPct < 20 ? 'text-red-500' : 'text-slate-500'} />
          <span class="text-[11px]" style="font-family:'JetBrains Mono',monospace; color:{batteryPct < 20 ? '#f87171' : '#64748b'};">
            {batteryPct}%
          </span>
        </div>
      {/if}

      <div class="relative">
        <button on:click={() => (showLayoutPicker = !showLayoutPicker)}
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors">
          <Languages size={13} class="text-slate-500" />
          <span class="text-slate-500 text-xs">{kbLayout.flag} {kbLayout.id.toUpperCase()}</span>
        </button>
        {#if showLayoutPicker}
          <div class="absolute right-0 top-full mt-1 w-48 rounded-xl overflow-hidden z-30"
               style="background:rgba(2,6,23,0.97); border:1px solid rgba(255,255,255,0.07);">
            <div class="max-h-64 overflow-y-auto py-1">
              {#each KEYBOARD_LAYOUTS as l (l.id)}
                <button on:click={() => changeKbLayout(l)}
                  class="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-white/5 {kbLayout.id === l.id ? 'text-blue-400' : 'text-slate-400'}">
                  <span class="text-base">{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <button on:click={() => (fontSize = Math.min(fontSize + 2, 24))}
        class="p-1.5 rounded-lg hover:bg-white/5 text-slate-600 hover:text-slate-400" title="Increase font size">
        <ZoomIn size={13} />
      </button>
      <button on:click={() => (fontSize = Math.max(fontSize - 2, 12))}
        class="p-1.5 rounded-lg hover:bg-white/5 text-slate-600 hover:text-slate-400" title="Decrease font size">
        <ZoomOut size={13} />
      </button>
      <button on:click={() => (highContrast = !highContrast)}
        class="p-1.5 rounded-lg hover:bg-white/5 transition-colors {highContrast ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}"
        title="Toggle high contrast">
        <Contrast size={13} />
      </button>

      {#if daemon}
        <span class="text-[11px] text-slate-700" style="font-family:'JetBrains Mono',monospace;">{daemon.hostname}</span>
      {/if}
    </div>
  </div>

  <button on:click={() => (showPowerMenu = true)}
    class="absolute bottom-6 right-6 z-20 p-3 rounded-xl bedm-btn-ghost group" title="Power Options">
    <Power size={18} class="text-slate-500 group-hover:text-red-400 transition-colors" />
  </button>

  {#if daemon}
    <div class="absolute bottom-6 left-6 z-20">
      <span class="text-slate-700 text-xs" style="font-family:'JetBrains Mono',monospace;">
        up {formatUptime(daemon.uptime)}
      </span>
    </div>
  {/if}

  <!-- Main content: overflow-y-auto so tall content scrolls WITHIN the
       window instead of pushing the layout past the visible screen. -->
  <div class="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden h-full"
       on:click={() => (showLayoutPicker = false)}>
    <div class="flex flex-col items-center justify-center px-4"
         style="min-height:100%; gap:clamp(0.75rem, 2.5vh, 2rem); padding-top:4rem; padding-bottom:4rem;">

      {#if screen !== 'logging-in' && screen !== 'connecting' && screen !== 'error'}
        <Clock className="animate-fade-in" />
      {/if}

      {#if screen === 'connecting'}
        <div class="flex flex-col items-center gap-6 animate-fade-in">
          <div class="w-20 h-20 rounded-2xl flex items-center justify-center"
               style="background:linear-gradient(135deg,#1d4ed8,#7c3aed); box-shadow:0 0 40px rgba(59,130,246,.4);">
            <Shield size={36} class="text-white" />
          </div>
          <div class="text-center">
            <div class="text-white text-2xl mb-2" style="font-family:'Oxanium',monospace; font-weight:400;">
              Blue Environment
            </div>
            <div class="text-slate-500 text-sm flex items-center gap-2 justify-center">
              <Loader2 size={14} class="animate-spin" />
              Connecting to BEDM daemon…
            </div>
          </div>
        </div>
      {/if}

      {#if screen === 'error'}
        <div class="flex flex-col items-center gap-6 animate-slide-up">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center"
               style="background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3);">
            <AlertCircle size={28} class="text-red-400" />
          </div>
          <div class="text-center max-w-sm">
            <div class="text-white text-lg mb-2">BEDM Connection Failed</div>
            <div class="text-slate-400 text-sm leading-relaxed">{connectError}</div>
          </div>
          <div class="flex gap-3">
            <button on:click={init} class="bedm-btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
              <RefreshCw size={14} />
              Retry
            </button>
            <button on:click={() => BedmBridge.powerAction('shutdown')}
              class="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white bedm-btn-ghost">
              Shut Down
            </button>
          </div>
          <p class="text-slate-700 text-xs max-w-xs text-center">
            Ensure <code class="text-slate-500">bedm-daemon</code> is running as root.
            Check <code class="text-slate-500">/var/log/bedm/</code> for errors.
          </p>
        </div>
      {/if}

      {#if screen === 'logging-in'}
        <div class="flex flex-col items-center gap-8 animate-fade-in">
          <div class="relative">
            <div class="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-medium text-white"
                 style="background:linear-gradient(135deg,#1d4ed8,#7c3aed); box-shadow:0 0 60px rgba(59,130,246,.5); font-family:'DM Sans',sans-serif;">
              {#if selectedUser && avatars[selectedUser.username]}
                <img src={avatars[selectedUser.username]} class="w-full h-full rounded-full object-cover" alt="" />
              {:else}
                {(selectedUser?.realname.charAt(0) ?? '?').toUpperCase()}
              {/if}
            </div>
            <div class="absolute inset-0 rounded-full animate-pulse-glow" style="border:2px solid rgba(59,130,246,.5);" />
          </div>
          <div class="text-center">
            <div class="text-white text-xl mb-2" style="font-family:'Oxanium',monospace;">
              Welcome, {selectedUser?.realname}
            </div>
            <div class="text-slate-400 text-sm flex items-center gap-2 justify-center">
              <Loader2 size={14} class="animate-spin" />
              Starting {currentSession?.name ?? 'session'}…
            </div>
          </div>
        </div>
      {/if}

      {#if screen === 'user-select'}
        <div class="flex flex-col items-center gap-6 animate-slide-up">
          <div class="glass-card rounded-3xl px-6 py-6 flex flex-col items-center gap-4 w-full"
               style="max-width:560px; min-width:min(520px, 90vw);">
            <div class="text-slate-400 text-xs tracking-[0.22em] uppercase" style="font-family:'Oxanium',monospace;">
              Select User
            </div>

            {#if users.length === 0}
              <div class="text-slate-500 text-sm py-4">No users found</div>
            {:else}
              <div class="flex gap-4 flex-wrap justify-center">
                {#each users as user (user.username)}
                  <UserCard {user} isSelected={false} avatarData={avatars[user.username]}
                    on:click={() => selectUser(user)} />
                {/each}
              </div>
            {/if}

            {#if showGuestOption}
              <button on:click={loginAsGuest}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 bedm-btn-ghost">
                <UserPlus size={14} />
                Continue as Guest
              </button>
            {/if}

            <div class="w-full pt-3 border-t border-white/5">
              <button on:click={() => (showSessionPicker = !showSessionPicker)}
                class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bedm-btn-ghost">
                <div class="flex items-center gap-2 text-sm text-slate-400">
                  <Monitor size={14} />
                  <span>{currentSession?.name ?? 'Select session…'}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded"
                        style="background:{isWayland(currentSession?.session_type) ? 'rgba(59,130,246,.15)' : 'rgba(249,115,22,.15)'};
                               color:{isWayland(currentSession?.session_type) ? '#93c5fd' : '#fdba74'};
                               font-family:'JetBrains Mono',monospace;">
                    {isWayland(currentSession?.session_type) ? 'WL' : 'X11'}
                  </span>
                </div>
                <ChevronDown size={14} class="text-slate-600 transition-transform {showSessionPicker ? 'rotate-180' : ''}" />
              </button>
              {#if showSessionPicker}
                <div class="mt-2 animate-slide-down">
                  <SessionPicker {sessions} selected={selectedSession}
                    on:select={(e) => { selectedSession = e.detail; showSessionPicker = false; }} />
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if screen === 'password' && selectedUser}
        <div class="flex flex-col items-center gap-6 animate-slide-up">
          <div class="glass-card rounded-3xl px-6 py-6 flex flex-col items-center gap-4" style="width:min(24rem, 90vw);">
            <div class="flex flex-col items-center gap-3">
              <div class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-medium text-white"
                   style="background:{avatars[selectedUser.username] ? 'transparent' : 'linear-gradient(135deg,#1d4ed8,#7c3aed)'};
                          box-shadow:0 0 0 3px rgba(59,130,246,.3),0 4px 20px rgba(0,0,0,.4);
                          font-family:'DM Sans',sans-serif;">
                {#if avatars[selectedUser.username]}
                  <img src={avatars[selectedUser.username]} class="w-full h-full rounded-full object-cover" alt="" />
                {:else}
                  {selectedUser.realname.charAt(0).toUpperCase()}
                {/if}
              </div>
              <div class="text-center">
                <div class="text-white font-medium">{selectedUser.realname}</div>
                <div class="text-slate-500 text-sm">{selectedUser.username}</div>
              </div>
            </div>

            {#if isLockedOut}
              <div class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm animate-slide-down"
                   style="background:rgba(234,179,8,.08); border:1px solid rgba(234,179,8,.2);">
                <LockKeyhole size={15} class="text-yellow-500 shrink-0" />
                <div>
                  <div class="text-yellow-400 font-medium text-xs">Account locked</div>
                  <div class="text-yellow-600 text-xs">Try again in {lockoutSecsLeft}s</div>
                </div>
              </div>
            {/if}

            {#if capsLock && !isLockedOut}
              <div class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                   style="background:rgba(249,115,22,.08); border:1px solid rgba(249,115,22,.2);">
                <AlertTriangle size={13} class="text-orange-400 shrink-0" />
                <span class="text-orange-400">Caps Lock is on</span>
              </div>
            {/if}

            {#if (patternAvailable || fingerprintAvailable) && !isLockedOut}
              <div class="flex gap-1 p-1 rounded-xl w-full" style="background:rgba(8,20,45,0.5);">
                <button on:click={() => (authMethod = 'password')}
                  class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors {authMethod === 'password' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}">
                  Password
                </button>
                {#if patternAvailable}
                  <button on:click={() => (authMethod = 'pattern')}
                    class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors {authMethod === 'pattern' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}">
                    Pattern
                  </button>
                {/if}
                {#if fingerprintAvailable}
                  <button on:click={() => (authMethod = 'fingerprint')}
                    class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors {authMethod === 'fingerprint' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}">
                    Fingerprint
                  </button>
                {/if}
              </div>
            {/if}

            {#if authMethod === 'password'}
              <div class="w-full space-y-2.5" style="animation:{shake ? 'shake .4s cubic-bezier(.36,.07,.19,.97)' : 'none'};">
                <div class="relative">
                  {#if showPassword}
                    <input
                      bind:this={passwordInput}
                      type="text"
                      bind:value={password}
                      on:keydown={handleKeyDown}
                      placeholder="Password"
                      class="bedm-input w-full px-4 py-3 rounded-xl pr-12 text-sm"
                      style="font-family:'DM Sans',sans-serif;"
                      autofocus
                      disabled={isAuthenticating || isLockedOut}
                    />
                  {:else}
                    <input
                      bind:this={passwordInput}
                      type="password"
                      bind:value={password}
                      on:keydown={handleKeyDown}
                      placeholder="Password"
                      class="bedm-input w-full px-4 py-3 rounded-xl pr-12 text-sm"
                      style="font-family:'DM Sans',sans-serif;"
                      autofocus
                      disabled={isAuthenticating || isLockedOut}
                    />
                  {/if}
                  <button type="button" on:click={() => (showPassword = !showPassword)}
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/5">
                    {#if showPassword}
                      <EyeOff size={15} class="text-slate-600" />
                    {:else}
                      <Eye size={15} class="text-slate-600" />
                    {/if}
                  </button>
                </div>

                {#if authError && !isLockedOut}
                  <div class="flex items-center gap-2 text-red-400 text-sm animate-slide-down">
                    <AlertCircle size={14} />
                    <span>{authError}</span>
                    {#if attemptsLeft < LOCKOUT_AFTER_ATTEMPTS && attemptsLeft > 0}
                      <span class="text-slate-600 text-xs ml-auto">{attemptsLeft} left</span>
                    {/if}
                  </div>
                {/if}

                <button on:click={authenticate}
                  disabled={!password || isAuthenticating || isLockedOut}
                  class="bedm-btn-primary w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                  {#if isAuthenticating}
                    <Loader2 size={16} class="animate-spin" /> Authenticating…
                  {:else if isLockedOut}
                    <LockKeyhole size={15} /> Locked ({lockoutSecsLeft}s)
                  {:else}
                    Log In
                  {/if}
                </button>
              </div>
            {:else if authMethod === 'pattern'}
              <div class="w-full flex flex-col items-center gap-3">
                <PatternLock disabled={isAuthenticating || isLockedOut} error={patternError}
                  on:complete={(e) => authenticateWithPattern(e.detail)} />
                {#if authError && !isLockedOut}
                  <div class="flex items-center gap-2 text-red-400 text-sm animate-slide-down">
                    <AlertCircle size={14} /><span>{authError}</span>
                  </div>
                {/if}
                <p class="text-slate-600 text-xs">Draw your pattern to unlock</p>
              </div>
            {:else if authMethod === 'fingerprint'}
              <div class="w-full flex flex-col items-center gap-4 py-4">
                <button on:click={authenticateWithFingerprint} disabled={isAuthenticating || isLockedOut}
                  class="w-20 h-20 rounded-full flex items-center justify-center transition-all"
                  style="background:{isAuthenticating ? 'rgba(59,130,246,0.2)' : 'rgba(8,20,45,0.6)'}; border:2px solid {isAuthenticating ? '#3b82f6' : 'rgba(59,130,246,0.3)'};">
                  {#if isAuthenticating}
                    <Loader2 size={32} class="text-blue-400 animate-spin" />
                  {:else}
                    <Fingerprint size={32} class="text-blue-400" />
                  {/if}
                </button>
                {#if authError && !isLockedOut}
                  <div class="flex items-center gap-2 text-red-400 text-sm animate-slide-down">
                    <AlertCircle size={14} /><span>{authError}</span>
                  </div>
                {/if}
                <p class="text-slate-600 text-xs">{isAuthenticating ? 'Scanning…' : 'Tap to scan your fingerprint'}</p>
              </div>
            {/if}


            <div class="w-full border-t border-white/5 pt-3">
              <button on:click={() => (showSessionPicker = !showSessionPicker)}
                class="w-full flex items-center justify-between px-3 py-2 rounded-xl bedm-btn-ghost text-sm">
                <div class="flex items-center gap-2 text-slate-500">
                  <Monitor size={13} />
                  <span class="text-xs">{currentSession?.name}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded"
                        style="background:{isWayland(currentSession?.session_type) ? 'rgba(59,130,246,.15)' : 'rgba(249,115,22,.15)'};
                               color:{isWayland(currentSession?.session_type) ? '#93c5fd' : '#fdba74'};
                               font-family:'JetBrains Mono',monospace;">
                    {isWayland(currentSession?.session_type) ? 'WL' : 'X11'}
                  </span>
                </div>
                <ChevronDown size={12} class="text-slate-700 transition-transform {showSessionPicker ? 'rotate-180' : ''}" />
              </button>
              {#if showSessionPicker}
                <div class="mt-1 animate-slide-down">
                  <SessionPicker {sessions} selected={selectedSession}
                    on:select={(e) => { selectedSession = e.detail; showSessionPicker = false; }} />
                </div>
              {/if}
            </div>
          </div>

          {#if users.length > 1}
            <button on:click={goBack} class="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
              <ChevronLeft size={16} />
              Switch User
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if showPowerMenu}
    <PowerMenu on:action={handlePower} on:close={() => (showPowerMenu = false)} />
  {/if}
</div>
