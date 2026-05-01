import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { CanApplyUpdate, GetReleaseLabel, GetSidecarStatus, GetVersion, UsesNativeUpdaterUI } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import Sidebar from './components/biz/Sidebar';
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
import { hasPreviewMode, hasWailsAppBindings } from './utils/previewMode';
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

const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const DebugPage = lazy(() => import('./pages/DebugPage'));
const ProxyPoolPage = lazy(() => import('./pages/ProxyPoolPage'));
const SessionManagementPage = lazy(() => import('./pages/SessionManagementPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const VendorStatusPage = lazy(() => import('./pages/VendorStatusPage'));
const UsageDeskWorkspace = lazy(() => import('./features/accounts/components/UsageDeskWorkspace'));

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
  startedAtUnix: 0,
};

function PageLoadingFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[var(--bg-surface)]">
      <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3 text-[0.625rem] font-black uppercase tracking-[0.24em] text-[var(--text-primary)] shadow-[6px_6px_0_var(--shadow-color)]">
        Loading
      </div>
    </div>
  );
}

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
      return hashState.sessionManagementWorkspace ?? 'codex';
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
        setActiveSessionManagementWorkspace(hashState.sessionManagementWorkspace ?? 'codex');
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
    const previewMode = hasPreviewMode();
    const wailsRuntime = hasWailsAppBindings();

    async function loadInitialState() {
      if (previewMode || !wailsRuntime) {
        if (!mounted) return;
        setVersion(previewMode ? 'preview' : 'browser');
        setReleaseLabel(previewMode ? 'preview' : 'browser');
        setCanApplyUpdate(false);
        setUsesNativeUpdaterUI(false);
        setSidecarStatus({
          code: 'running',
          port: 18317,
          message: previewMode ? 'preview runtime' : 'browser runtime',
          version: previewMode ? 'preview' : 'browser',
          startedAtUnix: Math.floor(Date.now() / 1000),
        });
        return;
      }

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

    if (previewMode || !wailsRuntime) {
      return () => {
        mounted = false;
      };
    }

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
    if (activePage === 'session-management') {
      return <SessionManagementPage workspace={activeSessionManagementWorkspace} />;
    }
    if (activePage === 'vendor-status') {
      return <VendorStatusPage />;
    }
    if (activePage === 'proxy-pool') {
      return <ProxyPoolPage />;
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
      <main className="flex-1 overflow-hidden bg-[var(--bg-surface)]">
        <Suspense fallback={<PageLoadingFallback />}>{page}</Suspense>
      </main>
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
