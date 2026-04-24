import { useEffect, useMemo, useState } from 'react';
import { GetSidecarStatus, GetVersion } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import Sidebar from './components/biz/Sidebar';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import StatusPage from './pages/StatusPage';
import { I18nProvider } from './context/I18nContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import type { AppPage, SidecarStatus } from './types';

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
};

function AppShell() {
  const { themeMode } = useTheme();
  const [activePage, setActivePage] = useState<AppPage>('accounts');
  const [sidecarStatus, setSidecarStatus] = useState<SidecarStatus>(defaultSidecarStatus);
  const [version, setVersion] = useState('dev');

  useEffect(() => {
    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [themeMode]);

  useEffect(() => {
    let mounted = true;

    async function loadInitialState() {
      try {
        const [currentVersion, currentStatus] = await Promise.all([
          GetVersion(),
          GetSidecarStatus(),
        ]);
        if (!mounted) return;
        setVersion(currentVersion || 'dev');
        if (currentStatus) {
          setSidecarStatus(currentStatus);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadInitialState();

    const offStatus = EventsOn('sidecar:status', (status: SidecarStatus) => {
      setSidecarStatus(status);
    });

    return () => {
      mounted = false;
      offStatus?.();
    };
  }, []);

  const page = useMemo(() => {
    if (activePage === 'status') {
      return <StatusPage sidecarStatus={sidecarStatus} version={version} />;
    }
    if (activePage === 'settings') {
      return <SettingsPage />;
    }
    return <AccountsPage sidecarStatus={sidecarStatus} />;
  }, [activePage, sidecarStatus, version]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]"
      data-collaboration-id="MAIN_FRAME"
    >
      <Sidebar activePage={activePage} setActivePage={setActivePage} version={version} />
      <main className="flex-1 overflow-hidden bg-[var(--bg-surface)]">{page}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppShell />
      </I18nProvider>
    </ThemeProvider>
  );
}
