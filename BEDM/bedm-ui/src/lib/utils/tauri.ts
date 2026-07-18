function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}
const isTauri = isTauriEnv();

async function invoke<T>(cmd: string, args?: unknown): Promise<T> {
  if (isTauri) {
    const core = await import('@tauri-apps/api/core');
    return core.invoke(cmd, args as any) as Promise<T>;
  }
  // Dev mock
  return mockInvoke<T>(cmd, args);
}

// ── Real Tauri commands ────────────────────────────────────────────────────

import type {
  AuthResult,
  DaemonInfo,
  SessionInfo,
  UserInfo,
} from '../types';

export const BedmBridge = {
  connectDaemon: () => invoke<DaemonInfo>('connect_daemon'),

  getSessions: () => invoke<SessionInfo[]>('get_sessions'),

  getUsers: () => invoke<UserInfo[]>('get_users'),

  authenticate: (username: string, password: string) =>
    invoke<AuthResult>('authenticate', { username, password }),

  authenticatePattern: (username: string, pattern: number[]) =>
    invoke<AuthResult>('authenticate_pattern', { username, pattern }),

  authenticateFingerprint: (username: string) =>
    invoke<AuthResult>('authenticate_fingerprint', { username }),

  /** Real fprintd hardware+enrollment check — see main.rs has_fingerprint(). */
  hasFingerprint: (username: string): Promise<boolean> =>
    invoke<boolean>('has_fingerprint', { username }).catch(() => false),

  patternIsConfigured: (username: string, home: string): Promise<boolean> =>
    invoke<boolean>('pattern_is_configured', { username, home }).catch(() => false),

  startSession: (username: string, session: string) =>
    invoke<string>('start_session', { username, session }),

  powerAction: (action: string) =>
    invoke<boolean>('power_action', { action }),

  getWallpaper: () => invoke<string | null>('get_wallpaper'),

  getHostname: () => invoke<string>('get_hostname'),

  getCurrentTime: () => invoke<string>('get_current_time'),

  getCurrentDate: () => invoke<string>('get_current_date'),

  readUserAvatar: (path: string) => invoke<string | null>('read_user_avatar', { path }),

  // ── New methods added for expanded greeter ────────────────────────────
  checkNetwork: async (): Promise<boolean> => {
    try {
      const result = await invoke<boolean>('check_network');
      return result;
    } catch {
      return true; // assume connected if command missing
    }
  },

  getBattery: async (): Promise<{ percentage: number; charging: boolean } | null> => {
    try {
      return await invoke<{ percentage: number; charging: boolean } | null>('get_battery_info');
    } catch {
      return null;
    }
  },

  getVolume: async (): Promise<number | null> => {
    try {
      return await invoke<number | null>('get_volume_level');
    } catch {
      return null;
    }
  },

  setKeyboardLayout: async (layout: string): Promise<void> => {
    try {
      await invoke<void>('set_keyboard_layout_bedm', { layout });
    } catch {}
  },
};

// ── Dev mocks (used when running in browser without Tauri) ─────────────────

function mockInvoke<T>(cmd: string, args?: unknown): Promise<T> {
  const MOCK_USERS: UserInfo[] = [
    {
      username: 'michal',
      realname: 'Michał Kowalski',
      uid: 1000,
      home: '/home/michal',
      shell: '/bin/bash',
      icon_path: undefined,
      last_session: 'blue-environment',
    },
    {
      username: 'admin',
      realname: 'System Administrator',
      uid: 1001,
      home: '/home/admin',
      shell: '/bin/bash',
      icon_path: undefined,
      last_session: undefined,
    },
  ];

  const MOCK_SESSIONS: SessionInfo[] = [
    {
      id: 'blue-environment',
      name: 'Blue Environment',
      exec: '/usr/share/Blue-Environment/lib/blue-compositor',
      session_type: 'wayland',
      desktop_names: ['Blue'],
      comment: 'Blue Environment Wayland Desktop',
    },
    {
      id: 'gnome',
      name: 'GNOME',
      exec: 'gnome-session',
      session_type: 'wayland',
      desktop_names: ['GNOME'],
      comment: 'GNOME Desktop Environment',
    },
    {
      id: 'plasma',
      name: 'KDE Plasma',
      exec: 'startplasma-wayland',
      session_type: 'wayland',
      desktop_names: ['KDE'],
      comment: 'KDE Plasma Desktop',
    },
    {
      id: 'openbox',
      name: 'Openbox',
      exec: 'openbox-session',
      session_type: 'x11',
      desktop_names: ['Openbox'],
      comment: 'Openbox Window Manager',
    },
  ];

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  switch (cmd) {
    case 'connect_daemon':
      return delay(600).then(
        () =>
          ({
            version: '1.0.0',
            hostname: 'legendaryos-pc',
            uptime: 3600,
            os_name: 'LegendaryOS Linux',
            os_version: '0.2.0-alpha',
            connected: true,
          } as unknown as T)
      );

    case 'get_users':
      return delay(200).then(() => MOCK_USERS as unknown as T);

    case 'get_sessions':
      return delay(200).then(() => MOCK_SESSIONS as unknown as T);

    case 'authenticate': {
      const { username, password } = args as { username: string; password: string };
      return delay(800).then(() => {
        if (password === 'demo' || password === '') {
          return { success: true, username, error: undefined, attempts_left: 5 } as unknown as T;
        }
        return {
          success: false,
          username: undefined,
          error: 'Incorrect password',
          attempts_left: 4,
        } as unknown as T;
      });
    }

    case 'authenticate_pattern': {
      const { username, pattern } = args as { username: string; pattern: number[] };
      return delay(600).then(() => {
        // Dev mock: the demo pattern is the "Z" shape 0-1-2-4-6-7-8.
        const demo = [0, 1, 2, 4, 6, 7, 8];
        const ok = pattern.length === demo.length && pattern.every((v, i) => v === demo[i]);
        return (ok
          ? { success: true, username, error: undefined, attempts_left: 5 }
          : { success: false, username: undefined, error: 'Pattern not recognised', attempts_left: 4 }
        ) as unknown as T;
      });
    }

    case 'authenticate_fingerprint': {
      const { username } = args as { username: string };
      return delay(1000).then(() => ({ success: true, username, error: undefined, attempts_left: 5 }) as unknown as T);
    }

    case 'has_fingerprint':
      return delay(100).then(() => true as unknown as T);

    case 'pattern_is_configured':
      return delay(100).then(() => true as unknown as T);

    case 'start_session':
      return delay(1200).then(() => 'mock-session-id' as unknown as T);

    case 'power_action':
      return delay(300).then(() => true as unknown as T);

    case 'get_wallpaper':
      return Promise.resolve(null as unknown as T);

    case 'get_hostname':
      return Promise.resolve('legendaryos-pc' as unknown as T);

    case 'get_current_time': {
      const now = new Date();
      const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      return Promise.resolve(t as unknown as T);
    }

    case 'get_current_date': {
      const now = new Date();
      const opts: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      };
      return Promise.resolve(now.toLocaleDateString('en-US', opts) as unknown as T);
    }

    case 'read_user_avatar':
      return Promise.resolve(null as unknown as T);

    default:
      console.warn('[MockBridge] Unknown command:', cmd);
      return Promise.resolve(null as unknown as T);
  }
}
