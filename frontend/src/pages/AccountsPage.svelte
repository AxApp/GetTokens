<script>
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n';
  import { ListAuthFiles, SetAuthFileStatus, DeleteAuthFiles } from '../../wailsjs/go/main/App';
  import AccountDetailModal from '../components/biz/AccountDetailModal.svelte';

  export let sidecarStatus;

  let accounts = [];
  let loading = false;
  let searchTerm = '';
  let selectedAccount = null;

  async function loadAccounts() {
    // 只有在 Sidecar 就绪时才尝试加载，否则显示加载中状态
    if (!sidecarStatus || sidecarStatus.code !== 'ready') return;
    
    loading = true;
    try {
      const res = await ListAuthFiles();
      accounts = res.files || [];
    } catch (e) { 
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $: filteredAccounts = accounts.filter(acc => {
    const q = searchTerm.toLowerCase();
    return !searchTerm || (acc.name || '').toLowerCase().includes(q) || (acc.provider || '').toLowerCase().includes(q);
  });

  async function toggleStatus(name, disabled) {
    try {
      await SetAuthFileStatus(name, !disabled);
      await loadAccounts();
    } catch (e) { alert('ERROR: ' + e); }
  }

  async function deleteAccount(name) {
    if (!confirm($t('common.confirm_delete'))) return;
    try {
      await DeleteAuthFiles([name]);
      await loadAccounts();
    } catch (e) { alert('DELETE ERROR: ' + e); }
  }

  onMount(loadAccounts);

  // 响应式监听 Sidecar 状态变化
  $: if (sidecarStatus && sidecarStatus.code === 'ready') loadAccounts();
</script>

<div class="h-full w-full p-12 overflow-auto bg-[var(--bg-surface)]" data-collaboration-id="PAGE_ACCOUNTS">
  <div class="max-w-6xl mx-auto space-y-8 pb-32">
    <header class="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
      <div>
        <h2 class="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">{$t('accounts.title')}</h2>
        <p class="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">{$t('accounts.subtitle')} / {accounts.length} TOTAL</p>
      </div>
      <button on:click={loadAccounts} class="btn-swiss">{$t('common.refresh')}</button>
    </header>

    <div class="flex flex-wrap gap-6 items-center bg-[var(--bg-main)] border-2 border-[var(--border-color)] p-4 shadow-hard shadow-[var(--shadow-color)]">
      <div class="flex-1 min-w-[300px] flex items-center gap-3">
        <span class="text-[10px] font-black uppercase">{$t('common.search')}:</span>
        <input bind:value={searchTerm} type="text" class="input-swiss flex-1 uppercase" placeholder="NAME / PROVIDER..." />
      </div>
    </div>

    {#if sidecarStatus.code !== 'ready'}
      <div class="border-2 border-dashed border-[var(--border-color)] p-20 text-center uppercase font-black italic text-[var(--text-muted)] animate-pulse">
        Waiting_for_backend_core...
      </div>
    {:else if filteredAccounts.length === 0}
      <div class="border-2 border-dashed border-[var(--border-color)] p-20 text-center uppercase font-black italic text-[var(--text-muted)]">
        {$t('accounts.empty')}
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
        {#each filteredAccounts as acc (acc.name)}
          <div class="card-swiss bg-[var(--bg-main)] flex flex-col p-6 min-h-[200px] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform">
            <h3 class="font-black text-sm uppercase break-all mb-4 text-[var(--text-primary)]">{acc.name}</h3>
            
            <div class="mt-auto space-y-3">
              <div class="flex justify-between text-[10px] font-bold uppercase border-t border-[var(--border-color)] border-dashed pt-3 text-[var(--text-primary)]">
                <span class="text-[var(--text-muted)]">{$t('common.status')}</span>
                <span class={acc.disabled ? 'text-zinc-500' : 'text-green-600'}>{acc.disabled ? 'DIS' : 'ACT'}</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button 
                  on:click={() => selectedAccount = acc}
                  class="btn-swiss !py-1 !text-[9px]"
                >{$t('common.details')}</button>
                <button 
                  on:click={() => deleteAccount(acc.name)}
                  class="btn-swiss !py-1 !text-[9px] !text-red-500"
                >{$t('common.delete')}</button>
              </div>
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
