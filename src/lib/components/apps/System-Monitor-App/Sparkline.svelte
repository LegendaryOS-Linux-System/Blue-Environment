<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import type { HistPoint } from './types';
  import { MAX_HISTORY } from './types';

  export let data: HistPoint[];
  export let color: string;
  export let h = 48;

  let canvas: HTMLCanvasElement;

  function draw() {
    const c = canvas;
    if (!c || data.length < 2) return;
    const ctx = c.getContext('2d')!;
    const W = c.offsetWidth || 280, H = h;
    c.width = W; c.height = H;
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...data.map((d) => d.v), 1);
    const pts: [number, number][] = data.map((d, i) => [(i / (MAX_HISTORY - 1)) * W, H - (d.v / max) * H * 0.85]);
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    pts.slice(1).forEach((p) => ctx.lineTo(...p));
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = color + '25'; ctx.fill();
  }

  onMount(draw);
  afterUpdate(draw);
</script>

<canvas bind:this={canvas} class="w-full" style="height:{h}px;" />
