<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { t } from '../../lib/i18n';
  import { GetAuthFileModels, DownloadAuthFile } from '../../../wailsjs/go/main/App';

  export let account;
  const dispatch = createEventDispatcher();

  let models = [];
  let loadingModels = false;
  let rawContent = '';
  let loadingRaw = false;
  let verifyResult = '';
  let verifying = false;

  $: DETAIL_FIELDS = [
    [$t('common.type'), account.type || '—'],
    [$t('accounts.provider'), account.provider || '—'],
    [$t('accounts.size'), account.size ? `${account.size} B` : '—'],
    [$t('common.status'), account.status || '—'],
    [$t('common.enable'), account.disabled ? 'NO' : 'YES'],
    ['REFRESH', account.lastRefresh ? new Date(account.lastRefresh).toLocaleTimeString() : '—'],
  ];

  async function loadData() {
    loadingModels = true;
    try {
      const res = await GetAuthFileModels(account.name);
      models = res || [];
    } catch (e) { console.error(e); } finally { loadingModels = false; }

    loadingRaw = true;
    try {
      const res = await DownloadAuthFile(account.name);
      const binary = atob(res.contentBase64);
      rawContent = new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
      try { rawContent = JSON.stringify(JSON.parse(rawContent), null, 2); } catch {}
    } catch (e) { rawContent = 'READ_ERROR: ' + e.message; } finally { loadingRaw = false; }
  }

  async function verify() {
    verifying = true;
    verifyResult = 'VERIFYING...';
    try {
      await GetAuthFileModels(account.name);
      verifyResult = '✓ VALID';
    } catch (e) { verifyResult = '✗ FAILED'; } finally { verifying = false; }
  }

  onMount(loadData);
</script>

<!-- Backdrop with Industrial Blur -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm" on:click={() => dispatch('close')}>
  <div 
    class="bg-[var(--bg-main)] border-2 border-[var(--border-color)] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-hard shadow-[var(--shadow-color)]" 
    on:click|stopPropagation
  >
    <!-- Header: Rigid & Bold -->
    <header class="px-6 py-4 border-b-2 border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-main)]">
      <div class="flex flex-col">
        <div class="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Object_Inspection</div>
        <h3 class="text-sm font-black italic uppercase tracking-tighter text-[var(--text-primary)] truncate max-w-[450px]">
          {account.name}
        </h3>
      </div>
      <button on:click={() => dispatch('close')} class="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </header>

    <!-- Body: Data Intensive Grid -->
    <div class="flex-1 overflow-y-auto p-6 space-y-8 selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]">
      
      <!-- Metrics Grid -->
      <div class="grid grid-cols-3 gap-y-6 border-b-2 border-[var(--border-color)] border-dashed pb-8">
        {#each DETAIL_FIELDS as [label, value]}
          <div class="space-y-1">
            <div class="text-[9px] font-black text-[var(--text-muted)] uppercase italic">{label}</div>
            <div class="text-[11px] font-black text-[var(--text-primary)] uppercase truncate">{value}</div>
          </div>
        {/each}
      </div>

      <!-- Models Section -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
            <span class="w-2 h-2 bg-[var(--border-color)]"></span>
            COMPATIBLE_MODELS
          </div>
          {#if loadingModels}
            <span class="text-[9px] font-black animate-pulse">LOADING...</span>
          {/if}
        </div>
        <div class="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-2">
          {#if models.length > 0}
            {#each models as model}
              <span class="px-2 py-0.5 border border-[var(--border-color)] text-[10px] font-black italic uppercase bg-[var(--bg-surface)]">
                {model.display_name || model.id || model.name}
              </span>
            {/each}
          {:else if !loadingModels}
            <div class="text-[10px] font-bold text-[var(--text-muted)] italic">NO_DATA_AVAILABLE</div>
          {/if}
        </div>
      </section>

      <!-- Source Content -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
            <span class="w-2 h-2 bg-[var(--border-color)]"></span>
            RAW_SOURCE_DAT
          </div>
          {#if loadingRaw}
            <span class="text-[9px] font-black animate-pulse text-[var(--text-muted)]">FETCHING_FS...</span>
          {/if}
        </div>
        <div class="bg-[var(--bg-main)] border-2 border-[var(--border-color)] p-4 font-mono text-[10px] leading-relaxed text-[var(--text-primary)] overflow-auto max-h-[300px] whitespace-pre shadow-inner">
          {rawContent}
        </div>
      </section>
    </div>

    <!-- Footer: Controlled Action Area -->
    <footer class="px-6 py-4 border-t-2 border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]">
      <div class="flex items-center gap-4">
        <button 
          on:click={verify}
          disabled={verifying}
          class="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]"
        >
          {verifying ? 'VERIFYING...' : 'VERIFY_ACCOUNT'}
        </button>
        {#if verifyResult}
          <span class="text-[10px] font-black italic {verifyResult.includes('✓') ? 'text-green-600' : 'text-red-600'}">
            {verifyResult}
          </span>
        {/if}
      </div>
      <button on:click={() => dispatch('close')} class="btn-swiss">
        {$t('common.close')}
      </button>
    </footer>
  </div>
</div>
