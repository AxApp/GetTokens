import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ApplyUpdate, CheckUpdate } from '../wailsjs/go/main/App';
import { BrowserOpenURL, Quit } from '../wailsjs/runtime/runtime';
import Sidebar from './components/biz/Sidebar';
import PageLoadingFallback from './components/ui/PageLoadingFallback';
import { DebugProvider } from './context/DebugContext';
import { I18nProvider } from './context/I18nContext';
import { TextScaleProvider, useTextScale } from './context/TextScaleContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { getTextScaleAttributeValue } from './context/textScale';
import { applyTextScaleVariables } from './features/settings/settingsTextScale';
import { AccountsPageStateProvider } from './features/accounts/AccountsPageStateProvider';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppNavigation } from './hooks/useAppNavigation';
import { toErrorMessage } from './utils/error';
import { hasWailsRuntime } from './utils/previewMode';

const AccountImportPage = lazy(() => import('./pages/AccountImportPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const ClaudePage = lazy(() => import('./pages/ClaudePage'));
const CodexPage = lazy(() => import('./pages/CodexPage'));
const DebugPage = lazy(() => import('./pages/DebugPage'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
const ProxyPoolPage = lazy(() => import('./pages/ProxyPoolPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));

function AppShell() {
  const { themeMode } = useTheme();
  const { textScale } = useTextScale();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarUpdateError, setSidebarUpdateError] = useState('');
  const [isSidebarUpdateActionPending, setIsSidebarUpdateActionPending] = useState(false);
  const {
    activePage,
    setActivePage,
    activeCodexWorkspace,
    setActiveCodexWorkspace,
    activeClaudeWorkspace,
    setActiveClaudeWorkspace,
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
  const showDeveloperTools = import.meta.env.DEV;

  async function handleSidebarUpdateAction() {
    if (!availableRelease) {
      return;
    }

    setIsSidebarUpdateActionPending(true);
    setSidebarUpdateError('');
    try {
      if (usesNativeUpdaterUI) {
        await CheckUpdate();
        return;
      }
      if (canApplyUpdate) {
        await ApplyUpdate();
        Quit();
        return;
      }
      openExternalURL(availableRelease.releaseUrl);
    } catch (error) {
      setSidebarUpdateError(toErrorMessage(error));
    } finally {
      setIsSidebarUpdateActionPending(false);
    }
  }

  function openExternalURL(url: string) {
    if (!url) {
      return;
    }

    if (hasWailsRuntime()) {
      BrowserOpenURL(url);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

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
    if (!import.meta.env.DEV) {
      return;
    }

    function handleDesignSystemComponentLabelClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const component = target?.closest<HTMLElement>("[data-design-system-component='true']");
      if (!component) {
        return;
      }

      const componentName = component.dataset.designSystemComponentName?.trim();
      if (!componentName || !isDesignSystemComponentLabelHit(event, component)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void copyDesignSystemComponentName(component, componentName);
    }

    document.addEventListener('click', handleDesignSystemComponentLabelClick, true);
    return () => {
      document.removeEventListener('click', handleDesignSystemComponentLabelClick, true);
    };
  }, []);

  const page = useMemo(() => {
    if (!showDeveloperTools && (activePage === 'debug' || activePage === 'design-system')) {
      return <AccountsPage workspace="all" />;
    }
    if (activePage === 'status') {
      return <StatusPage sidecarStatus={sidecarStatus} version={version} />;
    }
    if (activePage === 'debug') {
      return <DebugPage />;
    }
    if (activePage === 'design-system') {
      return <DesignSystemPage />;
    }
    if (activePage === 'account-import') {
      return <AccountImportPage onDone={() => setActivePage('accounts')} />;
    }
    if (activePage === 'proxy-pool') {
      return <ProxyPoolPage />;
    }
    if (activePage === 'codex') {
      return <CodexPage workspace={activeCodexWorkspace} sidecarStatus={sidecarStatus} />;
    }
    if (activePage === 'claude') {
      return <ClaudePage workspace={activeClaudeWorkspace} sidecarStatus={sidecarStatus} />;
    }
    if (activePage === 'settings') {
      return (
        <SettingsPage
          version={version}
          releaseLabel={releaseLabel}
          sidecarStatus={sidecarStatus}
          canApplyUpdate={canApplyUpdate}
          usesNativeUpdaterUI={usesNativeUpdaterUI}
          availableRelease={availableRelease}
          setAvailableRelease={setAvailableRelease}
        />
      );
    }
    return <AccountsPage workspace="all" />;
  }, [
    activeCodexWorkspace,
    activeClaudeWorkspace,
    activePage,
    availableRelease,
    canApplyUpdate,
    releaseLabel,
    showDeveloperTools,
    sidecarStatus,
    usesNativeUpdaterUI,
    version,
  ]);

  return (
    <AccountsPageStateProvider sidecarStatus={sidecarStatus}>
      <div
        className="flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]"
        data-collaboration-id="MAIN_FRAME"
        data-design-system-highlight={import.meta.env.DEV ? 'project' : undefined}
        data-text-scale={getTextScaleAttributeValue(textScale)}
        style={{
          '--app-sidebar-width': isSidebarCollapsed ? '4.75rem' : '15rem',
        } as CSSProperties}
      >
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          activeCodexWorkspace={activeCodexWorkspace}
          setActiveCodexWorkspace={setActiveCodexWorkspace}
          activeClaudeWorkspace={activeClaudeWorkspace}
          setActiveClaudeWorkspace={setActiveClaudeWorkspace}
          releaseLabel={releaseLabel}
          availableRelease={availableRelease}
          canApplyUpdate={canApplyUpdate}
          usesNativeUpdaterUI={usesNativeUpdaterUI}
          isUpdateActionPending={isSidebarUpdateActionPending}
          updateActionError={sidebarUpdateError}
          onUpdateAction={handleSidebarUpdateAction}
          showDeveloperTools={showDeveloperTools}
          onCollapsedChange={setIsSidebarCollapsed}
        />
        <main className="flex-1 overflow-hidden bg-[var(--bg-surface)]">
          <Suspense fallback={<PageLoadingFallback />}>{page}</Suspense>
        </main>
      </div>
    </AccountsPageStateProvider>
  );
}

function isDesignSystemComponentLabelHit(event: MouseEvent, component: HTMLElement) {
  const rect = component.getBoundingClientRect();
  const labelTop = rect.top - 24;
  const labelBottom = rect.top + 2;
  const labelLeft = rect.left - 4;
  const labelRight = Math.min(rect.right + 4, rect.left + 220);

  return (
    event.clientX >= labelLeft &&
    event.clientX <= labelRight &&
    event.clientY >= labelTop &&
    event.clientY <= labelBottom
  );
}

async function copyDesignSystemComponentName(component: HTMLElement, componentName: string) {
  try {
    await navigator.clipboard.writeText(componentName);
    component.dataset.designSystemComponentCopied = 'true';
    window.setTimeout(() => {
      delete component.dataset.designSystemComponentCopied;
    }, 1100);
  } catch {
    component.dataset.designSystemComponentCopied = 'error';
    window.setTimeout(() => {
      delete component.dataset.designSystemComponentCopied;
    }, 1400);
  }
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
