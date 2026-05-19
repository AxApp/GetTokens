import { Suspense, lazy, useEffect, useMemo } from 'react';
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
    if (activePage === 'status') {
      return <StatusPage sidecarStatus={sidecarStatus} version={version} />;
    }
    if (activePage === 'debug') {
      return <DebugPage />;
    }
    if (activePage === 'design-system') {
      return <DesignSystemPage />;
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
      >
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          activeCodexWorkspace={activeCodexWorkspace}
          setActiveCodexWorkspace={setActiveCodexWorkspace}
          activeClaudeWorkspace={activeClaudeWorkspace}
          setActiveClaudeWorkspace={setActiveClaudeWorkspace}
          releaseLabel={releaseLabel}
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
