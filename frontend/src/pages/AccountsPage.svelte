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
    } catch (e) { console.error('LOAD_ERROR:', e); } finally { loading = false; }
  }

  $: filteredAccounts = accounts.filter(acc => {
    const nameStr = (acc.name || '').toLowerCase();
    const providerStr = (acc.provider || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || nameStr.includes(q) || providerStr.includes(q);
    const matchesType = typeFilter === 'all' || (acc.type || 'unknown').toLowerCase() === typeFilter.toLowerCase();
    const isProblem = acc.unavailable || (acc.statusMessage && acc.statusMessage.trim() !== '') || acc.status === 'error';
    return matchesSearch && matchesType && (!onlyProblem || isProblem);
  });

  $: types = Array.from(new Set(accounts.map(a => (a.type || 'unknown').toLowerCase()))).sort();

  async function toggleStatus(name, disabled) {
    try { await SetAuthFileStatus(name, !disabled); await loadAccounts(); } catch (e) { alert('ERROR: ' + e); }
  }

  async function deleteAccount(name) {
    if (!confirm(`CONFIRM_DELETE: ${name}?`)) return;
    try {
      await DeleteAuthFiles([name]);
      selectedNames.delete(name);
      selectedNames = selectedNames;
      await loadAccounts();
    } catch (e) { alert('DELETE_FAILED: ' + e); }
  }

  async function deleteSelected() {
    if (selectedNames.size === 0) return;
    if (!confirm(`CONFIRM_DELETE: ${selectedNames.size} ITEMS?`)) return;
    try {
      await DeleteAuthFiles(Array.from(selectedNames));
      selectedNames = new Set();
      await loadAccounts();
    } catch (e) { alert('DELETE_FAILED: ' + e); }
  }

  function handleSelect(name, checked) {
    if (checked) selectedNames.add(name); else selectedNames.delete(name);
    selectedNames = selectedNames;
  }

  onMount(() => loadAccounts());
  $: if (sidecarStatus.code === 'ready') loadAccounts();
</script>

<div class="h-full w-full p-12 overflow-auto" data-collaboration-id="PAGE_ACCOUNTS">
  <div class="max-w-6xl mx-auto space-y-8 pb-32">
    <header class="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
      <div>
        <h2 class="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">Inventory</h2>
        <p class="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">{$t('accounts.subtitle')} / {filteredAccounts.length} TOTAL</p>
      </div>
      <div class="flex gap-4">
        <button on:click={loadAccounts} class="btn-swiss">{$t('common.refresh')}</button>
        <button class="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]">{$t('common.upload')}</button>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="flex flex-wrap gap-6 items-center bg-[var(--bg-main)] border-2 border-[var(--border-color)] p-4 shadow-hard shadow-[var(--shadow-color)]">
      <div class="flex-1 min-w-[300px] flex items-center gap-3">
        <span class="text-[10px] font-black uppercase">Search:</span>
        <input bind:value={searchTerm} type="text" class="input-swiss flex-1 uppercase" placeholder="NAME / PROVIDER..." />
      </div>
      {#if selectedNames.size > 0}
        <button on:click={deleteSelected} class="btn-swiss !text-red-500 border-red-500 !py-1 !px-3 shadow-hard-sm">
          DELETE_SELECTED ({selectedNames.size})
        </button>
      {/if}
    </div>

    <!-- Grid -->
    {#if filteredAccounts.length === 0}
      <div class="border-2 border-dashed border-[var(--border-color)] p-20 text-center uppercase font-black italic text-[var(--text-muted)]">
        NO_RECORDS_FOUND
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
        {#each filteredAccounts as acc (acc.name)}
          <div class="card-swiss bg-[var(--bg-main)] flex flex-col h-full relative group hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform">
            <div class="flex items-start justify-between mb-4">
              <div class="flex gap-3 overflow-hidden">
                <input type="checkbox" checked={selectedNames.has(acc.name)} on:change={(e) => handleSelect(acc.name, e.target.checked)} class="mt-1 w-4 h-4 border-2 border-[var(--border-color)] rounded-none bg-[var(--bg-main)] text-[var(--border-color)] focus:ring-0 cursor-pointer" />
                <div class="overflow-hidden">
                  <h3 class="font-black text-sm break-all uppercase leading-tight text-[var(--text-primary)]">{acc.name}</h3>
                  <div class="text-[9px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-tighter bg-[var(--bg-surface)] px-1.5 py-0.5 inline-block border border-[var(--border-color)]">
                    {acc.type || 'unknown'}
                  </div>
                </div>
              </div>
            </div>

            <div class="my-4 space-y-1 text-[9px] font-bold uppercase italic border-t-2 border-[var(--border-color)] border-dashed pt-4">
              <div class="flex justify-between"><span class="text-[var(--text-muted)]">Provider</span><span class="text-[var(--text-primary)] truncate ml-4">{acc.provider || '—'}</span></div>
              <div class="flex justify-between"><span class="text-[var(--text-muted)]">Status</span><span class={acc.disabled ? 'text-zinc-500' : 'text-green-600'}>{acc.disabled ? 'DISABLED' : 'ACTIVE'}</span></div>
            </div>

            <!-- 常驻操作按钮，移除 Hover Overlay -->
            <div class="grid grid-cols-2 gap-2 mt-auto">
              <button on:click={() => toggleStatus(acc.name, acc.disabled)} class="btn-swiss !py-1 !text-[9px] !shadow-hard-sm">
                {acc.disabled ? 'ENABLE' : 'DISABLE'}
              </button>
              <button on:click={() => selectedAccount = acc} class="btn-swiss !py-1 !text-[9px] !shadow-hard-sm">
                DETAILS
              </button>
              <button on:click={() => deleteAccount(acc.name)} class="btn-swiss !py-1 !text-[9px] !shadow-hard-sm !text-red-500 col-span-2">
                DELETE_RECORD
              </button>
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
