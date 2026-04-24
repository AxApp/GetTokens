import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/biz/Sidebar.jsx';
import StatusPage from './pages/StatusPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { I18nProvider } from './context/I18nContext.jsx';
import { GetSidecarStatus, GetVersion } from '../wailsjs/go/main/App';

function AppShell() {
  const { themeMode } = useTheme();
  const [activePage, setActivePage] = useState('accounts');
  const [sidecarStatus, setSidecarStatus] = useState({ code: 'stopped', port: 0 });
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

    if (window.runtime?.EventsOn) {
      window.runtime.EventsOn('sidecar:status', (status) => {
        setSidecarStatus(status);
      });
    }

    return () => {
      mounted = false;
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
