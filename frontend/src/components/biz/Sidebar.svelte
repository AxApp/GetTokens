<script>
  import { t } from '../../lib/i18n';
  export let activePage;
  export let version;

  const navItems = [
    { id: 'status', label: 'nav.status', icon: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 8v4l3 3' },
    { id: 'accounts', label: 'nav.accounts', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
    { id: 'settings', label: 'nav.settings', icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2' }
  ];
</script>

<aside class="w-60 bg-[var(--bg-main)] border-r-2 border-[var(--border-color)] flex flex-col shrink-0 h-full">
  <div class="p-8 border-b-2 border-[var(--border-color)]">
    <div class="text-2xl font-black italic tracking-tighter flex flex-col uppercase">
      <span>GET</span>
      <span class="text-[var(--text-muted)] mt-[-8px]">TOKENS</span>
    </div>
  </div>

  <nav class="flex-1 p-4 space-y-4">
    {#each navItems as item}
      <button 
        on:click={() => activePage = item.id}
        class="w-full flex items-center gap-3 px-3 py-3 font-bold text-xs uppercase tracking-widest border-2 transition-all active:scale-95
               {activePage === item.id 
                 ? 'bg-[var(--border-color)] text-[var(--bg-main)] border-[var(--border-color)] shadow-hard shadow-[var(--shadow-color)]' 
                 : 'border-transparent text-[var(--text-primary)] hover:border-[var(--border-color)]'}"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d={item.icon} />
        </svg>
        <span>{$t(item.label)}</span>
      </button>
    {/each}
  </nav>

  <div class="p-6 border-t-2 border-[var(--border-color)]">
    <div class="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
      BUILD {version}
    </div>
  </div>
</aside>
