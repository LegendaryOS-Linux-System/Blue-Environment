<script lang="ts">
  import { Plus, RefreshCw, Settings, ChevronDown, Check } from 'lucide-svelte';
  import { t } from '../../../stores/language';
  import { createMailState } from './mailState';
  import { createAccounts, type MailAccount } from './accounts';
  import MailSidebar from './MailSidebar.svelte';
  import EmailList from './EmailList.svelte';
  import EmailViewer from './EmailViewer.svelte';
  import ComposeModal from './ComposeModal.svelte';
  import AccountModal from './AccountModal.svelte';

  const accts = createAccounts();
  const state = createMailState();
  const { accounts, activeAcct, activeAccount } = accts;
  const { loading, syncStatus } = state;

  let showAccountModal = false;
  let editingAccount: MailAccount | null = null;
  let showAccountPicker = false;

  $: if ($activeAcct) state.fetchFromServer($activeAcct);
</script>

<div class="flex flex-col h-full bg-slate-900 text-white">
  <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-white/5 shrink-0">
    {#if $accounts.length > 0}
      <div class="relative">
        <button on:click={() => (showAccountPicker = !showAccountPicker)} class="flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded-lg text-xs text-slate-300">
          {$activeAccount?.email ?? 'Select account'}<ChevronDown size={11} />
        </button>
        {#if showAccountPicker}
          <div class="absolute top-full left-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-20 min-w-[200px]">
            {#each $accounts as a (a.id)}
              <button on:click={() => { activeAcct.set(a.id); showAccountPicker = false; }} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left text-sm">
                {#if a.id === $activeAcct}<Check size={12} class="text-blue-400" />{/if}
                <div class="flex-1 min-w-0">
                  <div class="text-white truncate text-xs">{a.name}</div>
                  <div class="text-slate-500 truncate text-[10px]">{a.email}</div>
                </div>
              </button>
            {/each}
            <div class="border-t border-white/5 mx-2" />
            <button on:click={() => { editingAccount = null; showAccountModal = true; showAccountPicker = false; }} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left text-xs text-slate-400">
              <Plus size={12} /> Add account
            </button>
            {#if $activeAccount}
              <button on:click={() => { editingAccount = $activeAccount; showAccountModal = true; showAccountPicker = false; }} class="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left text-xs text-slate-400">
                <Settings size={12} /> Edit account
              </button>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <button on:click={() => { editingAccount = null; showAccountModal = true; }} class="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-xs text-blue-400">
        <Plus size={11} /> Add mail account
      </button>
    {/if}
    {#if $activeAcct}
      <button on:click={() => state.fetchFromServer($activeAcct)} disabled={$loading} class="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white disabled:opacity-40">
        <RefreshCw size={13} class={$loading ? 'animate-spin' : ''} />
      </button>
    {/if}
    {#if $syncStatus}<span class="text-[10px] text-slate-500 truncate">{$syncStatus}</span>{/if}
    <div class="flex-1" />
    <button on:click={() => { editingAccount = null; showAccountModal = true; }} class="p-1.5 hover:bg-white/10 rounded-lg text-slate-400" title="Manage accounts"><Settings size={13} /></button>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <MailSidebar {state} t={$t} />
    <EmailList {state} />
    <EmailViewer {state} />
  </div>

  <ComposeModal {state} t={$t} />

  {#if showAccountModal}
    <AccountModal account={editingAccount} on:save={(e) => accts.saveAccount(e.detail)} on:close={() => (showAccountModal = false)} />
  {/if}
</div>
