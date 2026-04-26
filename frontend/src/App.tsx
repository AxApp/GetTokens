import { useEffect, useMemo, useState } from 'react';
import { CanApplyUpdate, GetReleaseLabel, GetSidecarStatus, GetVersion } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import Sidebar from './components/biz/Sidebar';
import AccountsPage from './pages/AccountsPage';
import DebugPage from './pages/DebugPage';
import SettingsPage from './pages/SettingsPage';
import StatusPage from './pages/StatusPage';
import { DebugProvider, useDebug } from './context/DebugContext';
import { I18nProvider } from './context/I18nContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import type { AppPage, ReleaseInfo, SidecarStatus } from './types';
import { persistActivePage, readStoredActivePage } from './utils/pagePersistence';

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
  startedAtUnix: 0,
};

function AppShell() {
  const { themeMode } = useTheme();
  const { trackRequest } = useDebug();
  const [activePage, setActivePage] = useState<AppPage>(() =>
    readStoredActivePage(typeof window === 'undefined' ? null : window.localStorage),
  );
  const [sidecarStatus, setSidecarStatus] = useState<SidecarStatus>(defaultSidecarStatus);
  const [version, setVersion] = useState('dev');
  const [releaseLabel, setReleaseLabel] = useState('');
  const [availableRelease, setAvailableRelease] = useState<ReleaseInfo | null>(null);
  const [canApplyUpdate, setCanApplyUpdate] = useState(true);

  useEffect(() => {
    persistActivePage(typeof window === 'undefined' ? null : window.localStorage, activePage);
  }, [activePage]);

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
        const [currentVersion, currentReleaseLabel, currentStatus, currentCanApplyUpdate] = await Promise.all([
          trackRequest('GetVersion', { args: [] }, () => GetVersion()),
          trackRequest('GetReleaseLabel', { args: [] }, () => GetReleaseLabel()),
          trackRequest('GetSidecarStatus', { args: [] }, () => GetSidecarStatus()),
          trackRequest('CanApplyUpdate', { args: [] }, () => CanApplyUpdate()),
        ]);
        if (!mounted) return;
        setVersion(currentVersion || 'dev');
        setReleaseLabel(currentReleaseLabel || '');
        setCanApplyUpdate(Boolean(currentCanApplyUpdate));
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
    const offRelease = EventsOn('updater:available', (release: ReleaseInfo) => {
      setAvailableRelease(release);
    });

    return () => {
      mounted = false;
      offStatus?.();
      offRelease?.();
    };
  }, []);

  const page = useMemo(() => {
    if (activePage === 'status') {
      return <StatusPage sidecarStatus={sidecarStatus} version={version} />;
    }
    if (activePage === 'debug') {
      return <DebugPage />;
    }
    if (activePage === 'settings') {
      return (
        <SettingsPage
          version={version}
          releaseLabel={releaseLabel}
          canApplyUpdate={canApplyUpdate}
          availableRelease={availableRelease}
          setAvailableRelease={setAvailableRelease}
        />
      );
    }
    return <AccountsPage sidecarStatus={sidecarStatus} />;
  }, [activePage, availableRelease, canApplyUpdate, releaseLabel, sidecarStatus, version]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]"
      data-collaboration-id="MAIN_FRAME"
    >
      <Sidebar activePage={activePage} setActivePage={setActivePage} releaseLabel={releaseLabel} />
      <main className="flex-1 overflow-hidden bg-[var(--bg-surface)]">{page}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <DebugProvider>
          <AppShell />
        </DebugProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
