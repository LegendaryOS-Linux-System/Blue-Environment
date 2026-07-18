<script lang="ts">
  export let icon: any;
  export let label: string;
  export let isActive: boolean;
</script>

<button on:click
  class="w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition-all duration-200 {isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1' : 'text-slate-400 hover:bg-white/5 hover:text-white'}">
  <svelte:component this={icon} size={18} /> {label}
</button>
