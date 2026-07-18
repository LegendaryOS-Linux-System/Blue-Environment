<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let className: string = '';

  let time = '';
  let date = '';
  let interval: ReturnType<typeof setInterval>;

  function update() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    time = `${h}:${m}`;

    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    date = now.toLocaleDateString('en-US', opts);
  }

  onMount(() => {
    update();
    interval = setInterval(update, 1000);
  });

  onDestroy(() => clearInterval(interval));
</script>

<div class="text-center {className}">
  <div
    class="tabular-nums leading-none text-white"
    style="font-family:'Oxanium',monospace; font-size:clamp(48px,8vw,110px); font-weight:300; letter-spacing:-0.02em; text-shadow:0 0 60px rgba(59,130,246,0.3),0 2px 4px rgba(0,0,0,0.5);"
  >
    {time}
  </div>
  <div
    class="mt-2 text-slate-400 tracking-widest uppercase"
    style="font-family:'DM Sans',sans-serif; font-size:0.875rem; font-weight:300; letter-spacing:0.15em;"
  >
    {date}
  </div>
</div>
