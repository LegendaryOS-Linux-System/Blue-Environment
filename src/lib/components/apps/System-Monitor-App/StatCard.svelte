<script lang="ts">
  import type { HistPoint } from './types';
  import Sparkline from './Sparkline.svelte';
  import Bar from './Bar.svelte';

  export let icon: any;
  export let label: string;
  export let value: string;
  export let sub: string | undefined = undefined;
  export let pctVal: number;
  export let hist: HistPoint[];
  export let color: string;
</script>

<div class="bg-slate-800/60 rounded-2xl p-4 border border-white/5 flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <svelte:component this={icon} size={15} style="color:{color};" />
      <span class="text-xs text-slate-400">{label}</span>
    </div>
    <span class="text-xs text-slate-600">{Math.round(pctVal)}%</span>
  </div>
  <div class="flex items-end justify-between gap-4">
    <div>
      <div class="text-2xl font-light text-white tabular-nums">{value}</div>
      {#if sub}<div class="text-xs text-slate-600 mt-0.5">{sub}</div>{/if}
    </div>
    <div style="flex:1; max-width:100px;">
      <Sparkline data={hist} {color} h={40} />
    </div>
  </div>
  <Bar value={pctVal} {color} />
</div>
