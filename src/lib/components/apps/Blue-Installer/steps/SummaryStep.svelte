<script lang="ts">
  import { ClipboardCheck, AlertTriangle } from 'lucide-svelte';
  import { LOCALES, KEYBOARD_LAYOUTS } from '../types';
  import type { InstallState } from '../installState';

  export let state: InstallState;
  const { config } = state;
  let confirmText = '';

  $: localeLabel = LOCALES.find((l) => l.code === $config.locale)?.label ?? $config.locale;
  $: kbLabel = KEYBOARD_LAYOUTS.find((k) => k.id === $config.keyboardLayout)?.label ?? $config.keyboardLayout;
  $: readyToInstall = confirmText.trim().toUpperCase() === 'ERASE' && !!$config.disk && !!$config.username && !!$config.password;
</script>

<div class="flex-1 flex flex-col px-10 py-8 overflow-y-auto">
  <div class="flex items-center gap-2 mb-6"><ClipboardCheck size={20} class="text-blue-400" /><h2 class="text-xl font-semibold text-white">Ready to install</h2></div>

  <div class="max-w-md space-y-2 mb-6">
    <div class="flex justify-between text-sm py-1.5 border-b border-white/5"><span class="text-slate-500">Language</span><span class="text-white">{localeLabel}</span></div>
    <div class="flex justify-between text-sm py-1.5 border-b border-white/5"><span class="text-slate-500">Keyboard</span><span class="text-white">{kbLabel}</span></div>
    <div class="flex justify-between text-sm py-1.5 border-b border-white/5"><span class="text-slate-500">Disk</span><span class="text-white font-mono">{$config.disk?.path ?? '—'} ({$config.disk?.sizeLabel})</span></div>
    <div class="flex justify-between text-sm py-1.5 border-b border-white/5"><span class="text-slate-500">Partitioning</span><span class="text-white">{$config.diskMode === 'manual' ? `Manual (${$config.partitions.length} partitions)` : 'Erase disk (automatic)'}</span></div>
    <div class="flex justify-between text-sm py-1.5 border-b border-white/5"><span class="text-slate-500">Computer name</span><span class="text-white">{$config.hostname}</span></div>
    <div class="flex justify-between text-sm py-1.5 border-b border-white/5"><span class="text-slate-500">User</span><span class="text-white">{$config.fullName || $config.username} ({$config.username})</span></div>
    <div class="flex justify-between text-sm py-1.5"><span class="text-slate-500">Auto-login</span><span class="text-white">{$config.autoLogin ? 'Yes' : 'No'}</span></div>
  </div>

  <div class="max-w-md flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4 text-sm text-red-300">
    <AlertTriangle size={18} class="shrink-0 mt-0.5" />
    <div>
      <p class="font-medium mb-1">This will permanently erase {$config.disk?.path}</p>
      <p class="text-red-400/80 text-xs">Type <strong>ERASE</strong> below to confirm you understand this cannot be undone.</p>
    </div>
  </div>

  <div class="max-w-md">
    <input bind:value={confirmText} placeholder="Type ERASE to confirm"
      class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/50 font-mono" />
  </div>

  <button on:click={state.startInstall} disabled={!readyToInstall}
    class="mt-6 max-w-md px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors">
    Install now
  </button>
</div>
