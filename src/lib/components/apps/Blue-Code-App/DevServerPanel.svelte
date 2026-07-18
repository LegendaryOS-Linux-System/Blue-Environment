<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { Play, Square, ExternalLink, Zap, Loader2 } from 'lucide-svelte';
  import { createDevServer } from './devServer';

  export let rootPath: { subscribe: (fn: (v: string) => void) => () => void };

  const dev = createDevServer(rootPath);
  const { state, detectedCommand } = dev;

  let command = '';
  let logEl: HTMLDivElement;
  let prevLogLen = 0;

  detectedCommand.subscribe((v) => { if (!command && v) command = v; });

  afterUpdate(() => {
    if ($state.log.length !== prevLogLen) { logEl?.scrollTo(0, logEl.scrollHeight); prevLogLen = $state.log.length; }
  });
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="p-2 space-y-2 border-b border-white/5">
    <div class="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1"><Zap size={11} /> Active Dev Mode</div>
    <input bind:value={command} disabled={$state.running || $state.starting} placeholder="npm run dev"
      class="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-60" />
    <div class="flex gap-1.5">
      {#if !$state.running && !$state.starting}
        <button on:click={() => dev.start(command)} disabled={!command.trim()} class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded text-xs text-white transition-colors">
          <Play size={12} /> Start
        </button>
      {:else}
        <button on:click={dev.stop} class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs text-white transition-colors">
          <Square size={11} /> Stop
        </button>
      {/if}
      {#if $state.url}
        <button on:click={dev.openInBrowser} class="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition-colors">
          <ExternalLink size={12} /> Open
        </button>
      {/if}
    </div>
    {#if $state.starting}
      <div class="flex items-center gap-1.5 text-[10px] text-slate-500"><Loader2 size={10} class="animate-spin" /> Starting…</div>
    {/if}
    {#if $state.port}
      <div class="text-[10px] text-green-400 flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Running on port {$state.port}</div>
    {/if}
  </div>

  <div bind:this={logEl} class="flex-1 overflow-y-auto p-2 font-mono text-[10px] text-slate-400 space-y-0.5 bg-slate-950/50">
    {#if $state.log.length === 0}<p class="text-slate-600 px-1">Output will appear here once started.</p>{/if}
    {#each $state.log as line, i (i)}<div class="whitespace-pre-wrap break-all">{line}</div>{/each}
  </div>
</div>
