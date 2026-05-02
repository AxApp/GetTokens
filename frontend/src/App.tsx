import { Suspense, lazy, useEffect, useMemo } from 'react';
import Sidebar from './components/biz/Sidebar';
import PageLoadingFallback from './components/ui/PageLoadingFallback';
import { DebugProvider } from './context/DebugContext';
import { I18nProvider } from './context/I18nContext';
import { TextScaleProvider, useTextScale } from './context/TextScaleContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { getTextScaleAttributeValue } from './context/textScale';
import { applyTextScaleVariables } from './features/settings/settingsTextScale';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppNavigation } from './hooks/useAppNavigation';

const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const DebugPage = lazy(() => import('./pages/DebugPage'));
const ProxyPoolPage = lazy(() => import('./pages/ProxyPoolPage'));
const SessionManagementPage = lazy(() => import('./pages/SessionManagementPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const VendorStatusPage = lazy(() => import('./pages/VendorStatusPage'));
const UsageDeskWorkspace = lazy(() => import('./features/accounts/UsageDeskFeature'));

function AppShell() {
  const { themeMode } = useTheme();
  const { textScale } = useTextScale();
  const {
    activePage,
    setActivePage,
    activeAccountWorkspace,
    setActiveAccountWorkspace,
    activeSessionManagementWorkspace,
    setActiveSessionManagementWorkspace,
    activeUsageDeskWorkspace,
    setActiveUsageDeskWorkspace,
  } = useAppNavigation();

  const {
    sidecarStatus,
    version,
    releaseLabel,
    availableRelease,
    setAvailableRelease,
    canApplyUpdate,
    usesNativeUpdaterUI,
  } = useAppBootstrap();

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
