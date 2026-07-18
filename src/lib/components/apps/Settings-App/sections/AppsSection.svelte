<script lang="ts">
  import type { UserConfig } from '../../../../types';

  export let config: UserConfig;
  export let onSave: (p: Partial<UserConfig>) => Promise<void>;

  const APP_LIST = [
    ['Blue AI', 'blueAI'], ['Blue Code', 'blueCode'], ['Blue Software', 'blueSoftware'],
    ['Mail', 'mail'], ['Calculator', 'calculator'], ['Notepad', 'notepad'], ['Blue Docs', 'blue_docs'],
    ['System Monitor', 'systemMonitor'], ['Explorer', 'explorer'], ['Terminal', 'terminal'],
    ['Blue Web', 'blueWeb'], ['Camera', 'camera'],
  ] as const;

  function isAppEnabled(key: string): boolean {
    const appsEnabled = config.appsEnabled as Record<string, boolean> | undefined;
    return appsEnabled?.[key] ?? true;
  }
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold text-white">Applications</h2>
  <div class="bg-slate-800 p-6 rounded-2xl border border-white/5 space-y-4">
    {#each APP_LIST as [name, key] (key)}
      <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <span class="text-white">{name}</span>
        <input type="checkbox" checked={isAppEnabled(key)}
          on:change={(e) => onSave({ appsEnabled: { ...config.appsEnabled, [key]: e.currentTarget.checked } })}
          class="w-4 h-4 accent-blue-500" />
      </div>
    {/each}
  </div>
</div>
