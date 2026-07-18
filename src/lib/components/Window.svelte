<script lang="ts">
  import { X, Minus, Maximize2, Square, PictureInPicture2 } from 'lucide-svelte';
  import type { WindowState } from '../types';
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let win: WindowState;
  export let isActive: boolean;

  const dispatch = createEventDispatcher<{
    close: string; minimize: string; maximize: string; focus: string; pip: string;
    move: { id: string; x: number; y: number };
    resize: { id: string; width: number; height: number };
  }>();

  const TOPBAR_HEIGHT = 48;
  const MIN_WIDTH = 280;
  const MIN_HEIGHT = 180;
  const SNAP_ZONE = 20;

  type SnapRegion = 'none' | 'left' | 'right' | 'top' | 'top-left' | 'top-right';
  interface SnapPreview { x: number; y: number; w: number; h: number; }

  function getSnapRegion(x: number, y: number): SnapRegion {
    const W = window.innerWidth;
    const nearLeft = x <= SNAP_ZONE;
    const nearRight = x >= W - SNAP_ZONE;
    const nearTop = y <= TOPBAR_HEIGHT + SNAP_ZONE;
    if (nearTop && nearLeft) return 'top-left';
    if (nearTop && nearRight) return 'top-right';
    if (nearTop) return 'top';
    if (nearLeft) return 'left';
    if (nearRight) return 'right';
    return 'none';
  }

  function snapGeometry(region: SnapRegion): SnapPreview {
    const W = window.innerWidth;
    const H = window.innerHeight - TOPBAR_HEIGHT;
    switch (region) {
      case 'left': return { x: 0, y: TOPBAR_HEIGHT, w: W / 2, h: H };
      case 'right': return { x: W / 2, y: TOPBAR_HEIGHT, w: W / 2, h: H };
      case 'top': return { x: 0, y: TOPBAR_HEIGHT, w: W, h: H };
      case 'top-left': return { x: 0, y: TOPBAR_HEIGHT, w: W / 2, h: H / 2 };
      case 'top-right': return { x: W / 2, y: TOPBAR_HEIGHT, w: W / 2, h: H / 2 };
      default: return { x: 0, y: 0, w: 0, h: 0 };
    }
  }

  let isDragging = false;
  let isResizing = false;
  let snapRegion: SnapRegion = 'none';
  let snapPreview: SnapPreview | null = null;

  let dragOffset = { x: 0, y: 0 };
  let resizeStart = { x: 0, y: 0, w: 0, h: 0 };

  function handleTitleMouseDown(e: MouseEvent) {
    if (win.isMaximized) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dispatch('focus', win.id);
    isDragging = true;
    dragOffset = { x: e.clientX - win.x, y: e.clientY - win.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleResizeMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('focus', win.id);
    isResizing = true;
    resizeStart = { x: e.clientX, y: e.clientY, w: win.width, h: win.height };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = Math.max(TOPBAR_HEIGHT, e.clientY - dragOffset.y);
      dispatch('move', { id: win.id, x: newX, y: newY });

      const region = getSnapRegion(e.clientX, e.clientY);
      snapRegion = region;
      snapPreview = region !== 'none' ? snapGeometry(region) : null;
    }
    if (isResizing) {
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      dispatch('resize', {
        id: win.id,
        width: Math.max(MIN_WIDTH, resizeStart.w + dx),
        height: Math.max(MIN_HEIGHT, resizeStart.h + dy),
      });
    }
  }

  function handleMouseUp() {
    if (isDragging && snapRegion !== 'none') {
      const geom = snapGeometry(snapRegion);
      dispatch('move', { id: win.id, x: geom.x, y: geom.y });
      dispatch('resize', { id: win.id, width: geom.w, height: geom.h });
    }
    isDragging = false;
    isResizing = false;
    snapRegion = 'none';
    snapPreview = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  $: style = win.isMaximized
    ? `left:0; top:${TOPBAR_HEIGHT}px; width:100vw; height:calc(100vh - ${TOPBAR_HEIGHT}px); border-radius:0; border:none; z-index:${win.zIndex};`
    : win.isPiP
    ? `left:${win.x}px; top:${win.y}px; width:${win.width}px; height:${win.height}px; z-index:9998;`
    : `left:${win.x}px; top:${win.y}px; width:${win.width}px; height:${win.height}px; z-index:${win.zIndex};`;
</script>

{#if !win.isMinimized}
  {#if snapPreview}
    <div class="fixed pointer-events-none z-[9999]"
         style="left:{snapPreview.x}px; top:{snapPreview.y}px; width:{snapPreview.w}px; height:{snapPreview.h}px;
                background:rgba(59,130,246,0.15); border:2px solid rgba(59,130,246,0.5); border-radius:12px; transition:all 0.12s ease;" />
  {/if}

  <div
    class="absolute flex flex-col overflow-hidden shadow-2xl border transition-shadow duration-150 theme-bg-primary
      {isActive ? 'border-blue-500/60 shadow-blue-500/20' : 'theme-border shadow-black/60'}
      {isDragging ? 'cursor-grabbing select-none' : ''}
      {win.isPiP ? 'rounded-2xl ring-2 ring-blue-500/50 shadow-blue-500/30' : win.isMaximized ? '' : 'rounded-xl'}"
    {style}
    on:mousedown={() => dispatch('focus', win.id)}
  >
    <div
      class="h-9 flex items-center justify-between px-3 select-none shrink-0 theme-bg-secondary theme-border border-b {win.isMaximized ? '' : 'cursor-default'}"
      on:mousedown={handleTitleMouseDown}
      on:dblclick={() => dispatch('maximize', win.id)}
    >
      <div class="flex items-center gap-2 text-sm font-medium theme-text-primary min-w-0">
        <div class="w-2 h-2 rounded-full shrink-0 transition-colors {isActive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}" />
        <span class="truncate">{win.title}</span>
        {#if win.isExternal}
          <span class="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 rounded">ext</span>
        {/if}
      </div>
      <div class="flex items-center gap-0.5 shrink-0" on:mousedown={(e) => e.stopPropagation()}>
        <button on:click={() => dispatch('minimize', win.id)}
          class="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md theme-text-secondary hover:text-yellow-400 transition-colors"
          title="Minimize (Super+↓)">
          <Minus size={13} />
        </button>
        <button on:click={() => dispatch('pip', win.id)}
          class="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md theme-text-secondary transition-colors {win.isPiP ? 'text-blue-400' : 'hover:text-blue-400'}"
          title="Picture-in-Picture">
          <PictureInPicture2 size={12} />
        </button>
        <button on:click={() => dispatch('maximize', win.id)}
          class="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md theme-text-secondary hover:text-green-400 transition-colors"
          title="Maximize (Super+↑)">
          {#if win.isMaximized}<Square size={11} />{:else}<Maximize2 size={11} />{/if}
        </button>
        <button on:click={() => dispatch('close', win.id)}
          class="w-7 h-7 flex items-center justify-center hover:bg-red-500/80 rounded-md theme-text-secondary hover:text-white transition-colors"
          title="Close (Alt+F4)">
          <X size={13} />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto relative theme-bg-primary theme-text-primary select-text cursor-auto">
      <slot />
    </div>

    {#if !win.isMaximized}
      <div class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 group" on:mousedown={handleResizeMouseDown}>
        <svg width="12" height="12" viewBox="0 0 12 12" class="absolute bottom-1 right-1 opacity-30 group-hover:opacity-70 transition-opacity">
          <path d="M0 12 L12 0 M4 12 L12 4 M8 12 L12 8" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>
    {/if}
  </div>
{/if}
