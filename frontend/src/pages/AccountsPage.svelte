<script>
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n';
  import { ListAuthFiles, SetAuthFileStatus, DeleteAuthFiles } from '../../wailsjs/go/main/App';
  import AccountDetailModal from '../components/biz/AccountDetailModal.svelte';

  export let sidecarStatus;

  let accounts = [];
  let loading = false;
  let selectedAccount = null;

  async function loadAccounts() {
    if (window.runtime) window.runtime.LogInfo('!!! FETCH_ACCOUNTS_TRIGGERED');
    try {
      const res = await ListAuthFiles();
      accounts = res.files || [];
      if (window.runtime) window.runtime.LogInfo('!!! FETCH_SUCCESS count=' + accounts.length);
    } catch (e) { 
      if (window.runtime) window.runtime.LogError('!!! FETCH_FAILED: ' + e);
    }
  }

  async function deleteAccount(name) {
    if (window.runtime) window.runtime.LogInfo('!!! USER_CLICKED_DELETE: ' + name);
    try {
      if (window.runtime) window.runtime.LogInfo('!!! SENDING_DELETE_REQUEST_TO_BACKEND');
      await DeleteAuthFiles([name]);
      if (window.runtime) window.runtime.LogInfo('!!! BACKEND_DELETE_SUCCESS');
      await loadAccounts();
    } catch (e) { 
      if (window.runtime) window.runtime.LogError('!!! BACKEND_DELETE_FAILED: ' + e);
      alert('DELETE ERROR: ' + e);
    }
  }

  onMount(() => {
    if (window.runtime) window.runtime.LogInfo('!!! ACCOUNTS_PAGE_MOUNTED');
    loadAccounts();
  });
</script>

<div class="h-full w-full p-12 overflow-auto bg-[var(--bg-surface)]" data-collaboration-id="PAGE_ACCOUNTS">
  <div class="max-w-6xl mx-auto space-y-8 pb-32">
    <header class="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
      <h2 class="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">Inventory</h2>
      <button on:click={loadAccounts} class="btn-swiss">FORCE_REFRESH</button>
    </header>

    {#if accounts.length === 0}
      <div class="border-2 border-dashed border-[var(--border-color)] p-20 text-center uppercase font-black italic text-[var(--text-muted)]">
        EMPTY_STORAGE
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
        {#each accounts as acc (acc.name)}
          <div class="card-swiss bg-[var(--bg-main)] flex flex-col p-6 min-h-[200px]">
            <h3 class="font-black text-sm uppercase break-all mb-4">{acc.name}</h3>
            <div class="mt-auto space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <button on:click={() => selectedAccount = acc} class="btn-swiss !py-1 !text-[9px]">DETAILS</button>
                <button on:click={() => deleteAccount(acc.name)} class="btn-swiss !py-1 !text-[9px] !text-red-500">DELETE</button>
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
