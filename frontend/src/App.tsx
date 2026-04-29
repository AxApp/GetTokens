import { useEffect, useMemo, useState } from 'react';
import { CanApplyUpdate, GetReleaseLabel, GetSidecarStatus, GetVersion, UsesNativeUpdaterUI } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import Sidebar from './components/biz/Sidebar';
import UsageDeskWorkspace from './features/accounts/components/UsageDeskWorkspace';
import AccountsPage from './pages/AccountsPage';
import DebugPage from './pages/DebugPage';
import SessionManagementPage from './pages/SessionManagementPage';
import SettingsPage from './pages/SettingsPage';
import StatusPage from './pages/StatusPage';
import { DebugProvider, useDebug } from './context/DebugContext';
import { I18nProvider } from './context/I18nContext';
import { TextScaleProvider, useTextScale } from './context/TextScaleContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { getTextScaleAttributeValue } from './context/textScale';
import { applyTextScaleVariables } from './features/settings/settingsTextScale';
import type {
  AccountWorkspace,
  AppPage,
  ReleaseInfo,
  SessionManagementWorkspace,
  SidecarStatus,
  UsageDeskWorkspace as UsageDeskWorkspaceID,
} from './types';
import {
  buildFrameHash,
  persistAccountWorkspace,
  persistActivePage,
  persistSessionManagementWorkspace,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredAccountWorkspace,
  readStoredActivePage,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskWorkspace,
} from './utils/pagePersistence';

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
  startedAtUnix: 0,
};

function AppShell() {
  const { themeMode } = useTheme();
  const { textScale } = useTextScale();
  const { trackRequest } = useDebug();
  const [activePage, setActivePage] = useState<AppPage>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    return hashState?.page ?? readStoredActivePage(storage);
  });
  const [activeAccountWorkspace, setActiveAccountWorkspace] = useState<AccountWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredAccountWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'accounts') {
      return hashState.workspace ?? 'all';
    }
    return storedWorkspace;
  });
  const [activeSessionManagementWorkspace, setActiveSessionManagementWorkspace] = useState<SessionManagementWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredSessionManagementWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'session-management') {
      return hashState.sessionManagementWorkspace ?? 'codex-sessions';
    }
    return storedWorkspace;
  });
  const [activeUsageDeskWorkspace, setActiveUsageDeskWorkspace] = useState<UsageDeskWorkspaceID>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredUsageDeskWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'usage-desk') {
      return hashState.usageDeskWorkspace ?? 'codex';
    }
    return storedWorkspace;
  });
  const [sidecarStatus, setSidecarStatus] = useState<SidecarStatus>(defaultSidecarStatus);
  const [version, setVersion] = useState('dev');
  const [releaseLabel, setReleaseLabel] = useState('');
  const [availableRelease, setAvailableRelease] = useState<ReleaseInfo | null>(null);
  const [canApplyUpdate, setCanApplyUpdate] = useState(true);
  const [usesNativeUpdaterUI, setUsesNativeUpdaterUI] = useState(false);

  useEffect(() => {
    persistActivePage(typeof window === 'undefined' ? null : window.localStorage, activePage);
  }, [activePage]);

  useEffect(() => {
    persistAccountWorkspace(typeof window === 'undefined' ? null : window.localStorage, activeAccountWorkspace);
  }, [activeAccountWorkspace]);

  useEffect(() => {
    persistSessionManagementWorkspace(
      typeof window === 'undefined' ? null : window.localStorage,
      activeSessionManagementWorkspace,
    );
  }, [activeSessionManagementWorkspace]);

  useEffect(() => {
    persistUsageDeskWorkspace(typeof window === 'undefined' ? null : window.localStorage, activeUsageDeskWorkspace);
  }, [activeUsageDeskWorkspace]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHash = buildFrameHash(
      activePage,
      activeAccountWorkspace,
      activeSessionManagementWorkspace,
      activeUsageDeskWorkspace,
    );
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [activeAccountWorkspace, activePage, activeSessionManagementWorkspace, activeUsageDeskWorkspace]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onHashChange = () => {
      const hashState = readFrameHashState(window.location.hash);
      if (!hashState) {
        return;
      }

      setActivePage(hashState.page);
      if (hashState.page === 'accounts') {
        setActiveAccountWorkspace(hashState.workspace ?? 'all');
      }
      if (hashState.page === 'session-management') {
        setActiveSessionManagementWorkspace(hashState.sessionManagementWorkspace ?? 'codex-sessions');
      }
      if (hashState.page === 'usage-desk') {
        setActiveUsageDeskWorkspace(hashState.usageDeskWorkspace ?? 'codex');
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.textScale = getTextScaleAttributeValue(textScale);
    applyTextScaleVariables(document.documentElement.style, textScale);
  }, [textScale]);

  useEffect(() => {
    let mounted = true;

    async function loadInitialState() {
      try {
        const [currentVersion, currentReleaseLabel, currentStatus, currentCanApplyUpdate, currentUsesNativeUpdaterUI] = await Promise.all([
          trackRequest('GetVersion', { args: [] }, () => GetVersion()),
          trackRequest('GetReleaseLabel', { args: [] }, () => GetReleaseLabel()),
          trackRequest('GetSidecarStatus', { args: [] }, () => GetSidecarStatus()),
          trackRequest('CanApplyUpdate', { args: [] }, () => CanApplyUpdate()),
          trackRequest('UsesNativeUpdaterUI', { args: [] }, () => UsesNativeUpdaterUI()),
        ]);
        if (!mounted) return;
        setVersion(currentVersion || 'dev');
        setReleaseLabel(currentReleaseLabel || '');
        setCanApplyUpdate(Boolean(currentCanApplyUpdate));
        setUsesNativeUpdaterUI(Boolean(currentUsesNativeUpdaterUI));
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
          usesNativeUpdaterUI={usesNativeUpdaterUI}
          availableRelease={availableRelease}
          setAvailableRelease={setAvailableRelease}
        />
      );
    }
    if (activePage === 'session-management') {
      return <SessionManagementPage workspace={activeSessionManagementWorkspace} />;
    }
    if (activePage === 'usage-desk') {
      return <UsageDeskWorkspace sidecarStatus={sidecarStatus} workspace={activeUsageDeskWorkspace} />;
    }
    return <AccountsPage sidecarStatus={sidecarStatus} workspace={activeAccountWorkspace} />;
  }, [
    activeAccountWorkspace,
    activePage,
    activeSessionManagementWorkspace,
    activeUsageDeskWorkspace,
    availableRelease,
    canApplyUpdate,
    releaseLabel,
    sidecarStatus,
    usesNativeUpdaterUI,
    version,
  ]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]"
      data-collaboration-id="MAIN_FRAME"
      data-text-scale={getTextScaleAttributeValue(textScale)}
    >
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        activeAccountWorkspace={activeAccountWorkspace}
        setActiveAccountWorkspace={setActiveAccountWorkspace}
        activeSessionManagementWorkspace={activeSessionManagementWorkspace}
        setActiveSessionManagementWorkspace={setActiveSessionManagementWorkspace}
        activeUsageDeskWorkspace={activeUsageDeskWorkspace}
        setActiveUsageDeskWorkspace={setActiveUsageDeskWorkspace}
        releaseLabel={releaseLabel}
      />
      <main className="flex-1 overflow-hidden bg-[var(--bg-surface)]">{page}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TextScaleProvider>
        <I18nProvider>
          <DebugProvider>
            <AppShell />
          </DebugProvider>
        </I18nProvider>
      </TextScaleProvider>
    </ThemeProvider>
  );
}
