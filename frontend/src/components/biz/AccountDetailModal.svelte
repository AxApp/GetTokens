<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { GetAuthFileModels, DownloadAuthFile } from '../../../wailsjs/go/main/App';

  export let account;
  const dispatch = createEventDispatcher();

  let models = [];
  let loadingModels = false;
  let rawContent = '';
  let loadingRaw = false;
  let verifyResult = '';
  let verifying = false;

  const DETAIL_FIELDS = [
    ['类型', account.type || '—'],
    ['Provider', account.provider || '—'],
    ['大小', account.size ? `${account.size} bytes` : '—'],
    ['状态', account.status || '—'],
    ['已禁用', account.disabled ? '是' : '否'],
    ['刷新时间', account.lastRefresh ? new Date(account.lastRefresh).toLocaleTimeString() : '—'],
  ];

  async function loadData() {
    loadingModels = true;
    try {
      const res = await GetAuthFileModels(account.name);
      models = res || [];
    } catch (e) {
      console.error(e);
    } finally {
      loadingModels = false;
    }

    loadingRaw = true;
    try {
      const res = await DownloadAuthFile(account.name);
      const binary = atob(res.contentBase64);
      rawContent = new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
      try {
        rawContent = JSON.stringify(JSON.parse(rawContent), null, 2);
      } catch {}
    } catch (e) {
      rawContent = '读取失败: ' + e.message;
    } finally {
      loadingRaw = false;
    }
  }

  async function verify() {
    verifying = true;
    verifyResult = '验证中...';
    try {
      await GetAuthFileModels(account.name);
      verifyResult = '✓ 账号可用';
    } catch (e) {
      verifyResult = '✗ 验证失败';
    } finally {
      verifying = false;
    }
  }

  onMount(loadData);
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" on:click={() => dispatch('close')}>
  <div class="bg-[#111114] border border-[#27272a] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" on:click|stopPropagation>
    <!-- Header -->
    <header class="px-6 py-3 border-b border-[#27272a] flex items-center justify-between bg-[#16161a]">
      <div>
        <div class="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-0.5">账号详情</div>
        <h3 class="text-sm font-semibold text-zinc-200 truncate max-w-[400px]">{account.name}</h3>
      </div>
      <button on:click={() => dispatch('close')} class="text-zinc-500 hover:text-zinc-200 transition-colors p-1">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </header>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-5 space-y-5">
      <!-- Compact Grid Info -->
      <div class="grid grid-cols-3 gap-x-6 gap-y-3 bg-[#16161a] p-3 rounded-xl border border-[#27272a]">
        {#each DETAIL_FIELDS as [label, value]}
          <div class="space-y-0.5">
            <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">{label}</div>
            <div class="text-xs text-zinc-300 font-medium truncate">{value}</div>
          </div>
        {/each}
      </div>

      <!-- Models & Raw Content Row -->
      <div class="grid grid-cols-1 gap-5">
        <!-- Models -->
        <section>
          <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>支持模型</span>
            {#if loadingModels}
              <span class="animate-pulse text-zinc-600">加载中...</span>
            {/if}
          </div>
          <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
            {#if models.length > 0}
              {#each models as model}
                <span class="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium">
                  {model.display_name || model.id || model.name}
                </span>
              {/each}
            {:else if !loadingModels}
              <div class="text-xs text-zinc-600 italic">暂无模型信息</div>
            {/if}
          </div>
        </section>

        <!-- Raw Content - Increased priority/visibility -->
        <section class="flex flex-col flex-1">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">原始文件内容</div>
            {#if loadingRaw}
              <div class="text-[9px] text-zinc-600 italic animate-pulse">读取中...</div>
            {/if}
          </div>
          <div class="bg-[#0d0d0f] border border-[#27272a] rounded-lg p-3 font-mono text-[10px] leading-snug text-zinc-400 overflow-auto max-h-[300px] whitespace-pre">
            {rawContent}
          </div>
        </section>
      </div>
    </div>

    <!-- Footer -->
    <footer class="px-6 py-3 border-t border-[#27272a] flex items-center justify-between bg-[#16161a]">
      <div class="flex items-center gap-3">
        <button 
          on:click={verify}
          disabled={verifying}
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
        >
          验证账号
        </button>
        {#if verifyResult}
          <span class="text-xs {verifyResult.startsWith('✓') ? 'text-green-500' : 'text-red-500'} font-medium">
            {verifyResult}
          </span>
        {/if}
      </div>
      <button on:click={() => dispatch('close')} class="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition-colors">
        关闭
      </button>
    </footer>
  </div>
</div>
