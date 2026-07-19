<script lang="ts">
  import { onMount } from 'svelte';
  import { Signal, RefreshCw } from 'lucide-svelte';
  import { SystemBridge } from '../../../../utils/systemBridge';

  let hasModem = false;
  let status: { connected: boolean; signal: number; carrier: string } | null = null;
  let enabled = true;
  let loading = true;
  let busy = false;

  async function refresh() {
    loading = true;
    hasModem = await SystemBridge.hasCellularModem();
    if (hasModem) status = await SystemBridge.getCellularStatus();
    loading = false;
  }

  async function toggle() {
    busy = true;
    enabled = !enabled;
    await SystemBridge.setCellularEnabled(enabled);
    if (enabled) status = await SystemBridge.getCellularStatus();
    busy = false;
  }

  onMount(refresh);
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold text-white">Cellular</h2>
    <button on:click={refresh} class="p-2 bg-slate-800 rounded-full hover:bg-white/10"><RefreshCw size={18} class={loading ? 'animate-spin' : ''} /></button>
  </div>

  {#if loading}
    <div class="text-slate-500 text-sm">Checking for a mobile broadband modem…</div>
  {:else if !hasModem}
    <div class="bg-slate-800 border border-white/5 rounded-2xl p-8 text-center text-slate-500 text-sm">
      No WWAN / cellular modem detected on this device.
    </div>
  {:else}
    <div class="bg-slate-800 p-4 rounded-xl flex items-center justify-between">
      <span class="text-white">Mobile Data</span>
      <button on:click={toggle} disabled={busy} class="w-12 h-6 rounded-full transition-colors relative {enabled ? 'bg-blue-600' : 'bg-slate-600'}">
        <div class="w-4 h-4 rounded-full bg-white absolute top-1 transition-transform {enabled ? 'translate-x-7' : 'translate-x-1'}" />
      </button>
    </div>
    <div class="bg-slate-800 border border-white/5 rounded-2xl p-4">
      {#if status}
        <div class="flex items-center gap-3">
          <Signal size={20} class={status.connected ? 'text-green-400' : 'text-slate-500'} />
          <div>
            <div class="font-medium text-white">{status.carrier || 'Unknown carrier'}</div>
            <div class="text-xs text-slate-400">{status.connected ? `Connected · Signal ${status.signal}%` : 'Not connected'}</div>
          </div>
        </div>
      {:else}
        <div class="text-slate-500 text-sm text-center py-4">No status available</div>
      {/if}
    </div>
  {/if}
</div>
