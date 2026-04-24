<script>
  import { themeMode } from '../lib/stores';
  import { locale, t } from '../lib/i18n';
  import SegmentedControl from '../components/ui/SegmentedControl.svelte';

  const themes = [
    { id: 'system', label: 'SYSTEM' },
    { id: 'light', label: 'LIGHT' },
    { id: 'dark', label: 'DARK' }
  ];

  const languages = [
    { id: 'zh', label: '简体中文' },
    { id: 'en', label: 'ENGLISH' }
  ];
</script>

<div class="space-y-6 pb-10" data-collaboration-id="PAGE_SETTINGS">
  <header class="border-b-2 border-[var(--border-color)] pb-3">
    <h2 class="text-xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">{$t('settings.title')}</h2>
    <p class="text-[9px] font-bold text-[var(--text-muted)] mt-0.5 uppercase tracking-widest">{$t('settings.subtitle')}</p>
  </header>

  <div class="space-y-6">
    <!-- Configuration Section -->
    <section class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="text-[8px] font-black uppercase bg-[var(--border-color)] text-[var(--bg-main)] px-1.5 py-0.5 font-mono">01</span>
        <h3 class="font-black text-xs uppercase tracking-tighter italic text-[var(--text-primary)]">{$t('settings.appearance')}</h3>
      </div>

      <div class="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
        <!-- Theme Option -->
        <div class="p-5 space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-[9px] font-black uppercase text-[var(--text-muted)] italic tracking-widest">
              {$t('settings.theme_mode')}
            </label>
            <span class="text-[8px] font-bold text-[var(--text-muted)] opacity-30 font-mono italic">CONFIG_X_THEME</span>
          </div>
          <SegmentedControl options={themes} bind:value={$themeMode} />
        </div>

        <!-- Language Option -->
        <div class="p-5 space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-[9px] font-black uppercase text-[var(--text-muted)] italic tracking-widest">
              {$t('settings.language')}
            </label>
            <span class="text-[8px] font-bold text-[var(--text-muted)] opacity-30 font-mono italic">CONFIG_X_LANG</span>
          </div>
          <SegmentedControl options={languages} bind:value={$locale} />
        </div>
      </div>
    </section>

    <!-- System Info Section -->
    <section class="space-y-3 opacity-80">
      <div class="flex items-center gap-2">
        <span class="text-[8px] font-black uppercase bg-[var(--border-color)] text-[var(--bg-main)] px-1.5 py-0.5 font-mono">INFO</span>
        <h3 class="font-black text-xs uppercase tracking-tighter italic text-[var(--text-primary)]">{$t('settings.system_info')}</h3>
      </div>
      
      <div class="card-swiss bg-[var(--bg-surface)] !p-5">
        <div class="grid grid-cols-2 gap-8">
          <div class="space-y-1">
            <div class="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{$t('settings.architecture')}</div>
            <div class="text-[10px] font-black italic text-[var(--text-primary)] uppercase">WAILS_V2 / SVELTE_CORE</div>
          </div>
          <div class="space-y-1 text-right border-l border-[var(--border-color)]/20 pl-8">
            <div class="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{$t('settings.status')}</div>
            <div class="text-[10px] font-black italic text-green-600 uppercase">STABLE_READY</div>
          </div>
        </div>

        <!-- Source Mapping -->
        <div class="mt-5 pt-5 border-t border-[var(--border-color)] border-dashed space-y-3">
          <div class="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Dev_Helper / Source Mapping</div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[8px]">
            {#each [
              ['MAIN_FRAME', 'src/App.svelte'],
              ['PAGE_ACCOUNTS', 'src/pages/AccountsPage.svelte'],
              ['PAGE_STATUS', 'src/pages/StatusPage.svelte'],
              ['UI_SEGMENT', 'src/components/ui/SegmentedControl.svelte']
            ] as [id, path]}
              <div class="flex justify-between border-b border-[var(--border-color)]/10 pb-0.5">
                <span class="text-[var(--text-muted)]">{id}</span>
                <span class="font-bold text-[var(--text-primary)]">{path}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
