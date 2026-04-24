<script>
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n';
  import { ListAuthFiles, SetAuthFileStatus, DeleteAuthFiles } from '../../wailsjs/go/main/App';
  import AccountDetailModal from '../components/biz/AccountDetailModal.svelte';

  export let sidecarStatus;

  let accounts = [];
  let loading = false;
  let searchTerm = '';
  let typeFilter = 'all';
  let onlyProblem = false;
  let selectedNames = new Set();
  let selectedAccount = null;

  async function loadAccounts() {
    if (sidecarStatus.code !== 'ready') return;
    loading = true;
    try {
      const res = await ListAuthFiles();
      accounts = res.files || [];
    } catch (e) { console.error(e); } finally { loading = false; }
  }

  $: filteredAccounts = accounts.filter(acc => {
    const matchesSearch = !searchTerm || acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || (acc.provider || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || (acc.type || 'unknown').toLowerCase() === typeFilter.toLowerCase();
    const isProblem = acc.unavailable || (acc.statusMessage && acc.statusMessage.trim() !== '') || acc.status === 'error';
    return matchesSearch && matchesType && (!onlyProblem || isProblem);
  });

  $: types = Array.from(new Set(accounts.map(a => (a.type || 'unknown').toLowerCase()))).sort();

  async function toggleStatus(name, disabled) {
    try { await SetAuthFileStatus(name, !disabled); await loadAccounts(); } catch (e) { alert('ERROR: ' + e); }
  }

  function handleSelect(name, checked) {
    if (checked) selectedNames.add(name); else selectedNames.delete(name);
    selectedNames = selectedNames;
  }

  onMount(() => loadAccounts());
  $: if (sidecarStatus.code === 'ready') loadAccounts();
</script>

<!-- 增加 h-full, p-12, overflow-auto, 以及 max-w 约束 -->
<div class="h-full w-full p-12 overflow-auto" data-collaboration-id="PAGE_ACCOUNTS">
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
      <div>
        <h2 class="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">{$t('accounts.title')}</h2>
        <p class="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">{$t('accounts.subtitle')} / {filteredAccounts.length} TOTAL</p>
      </div>
      <div class="flex gap-4">
        <button on:click={loadAccounts} class="btn-swiss">{$t('common.refresh')}</button>
        <button class="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]">{$t('common.upload')}</button>
      </div>
    </header>

    <div class="flex flex-wrap gap-6 items-center bg-[var(--bg-main)] border-2 border-[var(--border-color)] p-4 shadow-hard shadow-[var(--shadow-color)]">
      <div class="flex-1 min-w-[300px] flex items-center gap-3">
        <span class="text-[10px] font-black uppercase">{$t('common.search')}:</span>
        <input bind:value={searchTerm} type="text" class="input-swiss flex-1 uppercase" placeholder="NAME / PROVIDER..." />
      </div>
      <div class="flex items-center gap-3 border-l-2 border-[var(--border-color)] pl-6 h-10">
        <span class="text-[10px] font-black uppercase">{$t('common.type')}:</span>
        <select bind:value={typeFilter} class="input-swiss !py-1">
          <option value="all">ALL</option>
          {#each types as type}
            <option value={type}>{type.toUpperCase()}</option>
          {#each types as type}
            <option value={type}>{type.toUpperCase()}</option>
          {/each}
        </select>
      </div>
      <label class="flex items-center gap-2 cursor-pointer border-l-2 border-[var(--border-color)] pl-6 h-10 group">
        <input type="checkbox" bind:checked={onlyProblem} class="w-4 h-4 border-2 border-[var(--border-color)] rounded-none bg-[var(--bg-main)] text-[var(--border-color)] focus:ring-0" />
        <span class="text-[10px] font-black uppercase group-hover:underline">{$t('accounts.errors_only')}</span>
      </label>
    </div>

    {#if filteredAccounts.length === 0}
      <div class="border-2 border-dashed border-[var(--border-color)] p-20 text-center uppercase font-black italic text-[var(--text-muted)]">
        {$t('accounts.empty')}
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
        {#each filteredAccounts as acc}
          <div class="card-swiss group relative overflow-hidden">
            <div class="flex items-start justify-between mb-6">
              <div class="flex gap-3">
                <input type="checkbox" checked={selectedNames.has(acc.name)} on:change={(e) => handleSelect(acc.name, e.target.checked)} class="mt-1 w-4 h-4 border-2 border-[var(--border-color)] rounded-none bg-[var(--bg-main)] text-[var(--border-color)] focus:ring-0" />
                <div>
                  <h3 class="font-black text-sm break-all uppercase leading-none text-[var(--text-primary)]">{acc.name}</h3>
                  <div class="text-[9px] font-bold text-[var(--text-muted)] mt-2 uppercase tracking-tighter bg-[var(--bg-surface)] px-1.5 py-0.5 inline-block border border-[var(--border-color)]">
                    {acc.type || 'unknown'}
                  </div>
                </div>
              </div>
            </div>
            <div class="space-y-1.5 border-t-2 border-[var(--border-color)] pt-4 mt-auto">
              <div class="flex justify-between text-[10px] font-bold uppercase italic"><span class="text-[var(--text-muted)]">{$t('accounts.provider')}</span><span class="text-[var(--text-primary)]">{acc.provider || 'generic'}</span></div>
              <div class="flex justify-between text-[10px] font-bold uppercase italic"><span class="text-[var(--text-muted)]">{$t('accounts.size')}</span><span class="text-[var(--text-primary)]">{acc.size || 0} B</span></div>
              <div class="flex justify-between text-[10px] font-bold uppercase italic pt-2"><span class="text-[var(--text-muted)]">{$t('common.status')}</span><span class={acc.disabled ? 'text-zinc-500' : 'text-green-600'}>{acc.disabled ? 'DIS' : 'ACT'}</span></div>
            </div>
            <div class="absolute inset-0 bg-[var(--bg-main)] border-2 border-[var(--border-color)] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-4 gap-2">
              <div class="text-[9px] font-black uppercase mb-auto border-b border-[var(--border-color)] pb-1">{$t('accounts.quick_actions')}</div>
              <button on:click={() => toggleStatus(acc.name, acc.disabled)} class="btn-swiss !shadow-hard-sm uppercase">{acc.disabled ? $t('common.enable') : $t('common.disable')}</button>
              <button on:click={() => selectedAccount = acc} class="btn-swiss !shadow-hard-sm uppercase">{$t('common.details')}</button>
              <button class="btn-swiss !text-red-500 !shadow-hard-sm uppercase">{$t('common.delete')}</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if selectedAccount}
  <AccountDetailModal account={selectedAccount} on:close={() => selectedAccount = null} />
{/if}
