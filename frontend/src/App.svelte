<script>
  import { onMount } from 'svelte';
  import { themeMode } from './lib/stores';
  import Sidebar from './components/biz/Sidebar.svelte';
  import StatusPage from './pages/StatusPage.svelte';
  import AccountsPage from './pages/AccountsPage.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import { GetSidecarStatus, GetVersion } from '../wailsjs/go/main/App';

  let activePage = 'accounts';
  let sidecarStatus = { code: 'stopped', port: 0 };
  let version = 'dev';

  function updateTheme(mode) {
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }

  $: updateTheme($themeMode);

  onMount(async () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => updateTheme($themeMode);
    mediaQuery.addEventListener('change', listener);
    
    try {
      version = await GetVersion();
      sidecarStatus = await GetSidecarStatus();
    } catch {}

    if (window.runtime?.EventsOn) {
      window.runtime.EventsOn('sidecar:status', (s) => sidecarStatus = s);
    }

    return () => mediaQuery.removeEventListener('change', listener);
  });
</script>

<div class="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]" data-collaboration-id="MAIN_FRAME">
  <Sidebar bind:activePage {version} />

  <main class="flex-1 bg-[var(--bg-surface)] overflow-auto p-12">
    <div class="max-w-6xl mx-auto h-full">
      {#if activePage === 'status'}
        <StatusPage {sidecarStatus} {version} />
      {:else if activePage === 'accounts'}
        <AccountsPage {sidecarStatus} />
      {:else if activePage === 'settings'}
        <SettingsPage />
      {/if}
    </div>
  </main>
</div>
