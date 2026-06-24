import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { Download, ExternalLink } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AppPage, ClaudeWorkspace, CodexWorkspace, ReleaseInfo } from '../../types';
import { formatSidebarVersion } from '../../utils/version';
import { getSidebarNavItems } from './sidebarNav';
import { resolveSidebarUpdatePrompt } from './sidebarUpdatePrompt';
import { getSidebarToggleTranslationKey } from './sidebarState';

type OpenSection = 'codex' | 'claude' | null;

interface SidebarProps {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  activeCodexWorkspace: CodexWorkspace;
  setActiveCodexWorkspace: (workspace: CodexWorkspace) => void;
  activeClaudeWorkspace: ClaudeWorkspace;
  setActiveClaudeWorkspace: (workspace: ClaudeWorkspace) => void;
  releaseLabel: string;
  availableRelease: ReleaseInfo | null;
  canApplyUpdate: boolean;
  usesNativeUpdaterUI: boolean;
  isUpdateActionPending?: boolean;
  updateActionError?: string;
  onUpdateAction?: () => void;
  showDeveloperTools?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
}

const codexWorkspaceItems = [
  { id: 'feature-config', label: 'nav.codex_feature_config' },
  { id: 'binary-management', label: 'nav.codex_binary_management' },
  { id: 'doctor-workbench', label: 'nav.codex_doctor_workbench' },
  { id: 'extension-registry', label: 'nav.codex_extension_registry' },
  { id: 'skills', label: 'nav.codex_skills' },
  { id: 'mcp-servers', label: 'nav.codex_mcp_servers' },
  { id: 'account-list', label: 'nav.codex_account_list' },
  { id: 'live-sessions', label: 'nav.codex_live_sessions' },
  { id: 'session-management', label: 'nav.session_management' },
  { id: 'vendor-status', label: 'nav.openai_status' },
  { id: 'usage-codex', label: 'nav.usage_desk_codex' },
] as const satisfies ReadonlyArray<{ id: CodexWorkspace; label: string }>;

const claudeWorkspaceItems = [
  { id: 'account-list', label: 'nav.claude_account_list' },
  { id: 'skills', label: 'nav.claude_skills' },
  { id: 'mcp-servers', label: 'nav.claude_mcp_servers' },
  { id: 'session-management', label: 'nav.session_management' },
  { id: 'usage', label: 'nav.usage_desk_claude' },
  { id: 'settings', label: 'nav.claude_settings' },
  { id: 'claude-md', label: 'nav.claude_claude_md' },
  { id: 'subagents', label: 'nav.claude_subagents' },
] as const satisfies ReadonlyArray<{ id: ClaudeWorkspace; label: string }>;

const SECTION_IDS = ['codex', 'claude'] as const;

function isSectionId(id: string): id is 'codex' | 'claude' {
  return SECTION_IDS.includes(id as any);
}

function getSelectedSection(activePage: AppPage): OpenSection {
  return activePage === 'codex' || activePage === 'claude' ? activePage : null;
}

function renderSidebarIcon(path: string) {
  return (
    <svg
      className="gt-sidebar-menu-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-focus-ring)] focus-visible:ring-offset-1';

export default function Sidebar({
  activePage,
  setActivePage,
  activeCodexWorkspace,
  setActiveCodexWorkspace,
  activeClaudeWorkspace,
  setActiveClaudeWorkspace,
  releaseLabel,
  availableRelease,
  canApplyUpdate,
  usesNativeUpdaterUI,
  isUpdateActionPending = false,
  updateActionError = '',
  onUpdateAction,
  showDeveloperTools = import.meta.env.DEV,
  onCollapsedChange,
}: SidebarProps) {
  const { t } = useI18n();
  const navItems = getSidebarNavItems(showDeveloperTools);
  const sidebarVersion = formatSidebarVersion(releaseLabel);
  const updatePrompt = resolveSidebarUpdatePrompt({ availableRelease, canApplyUpdate, usesNativeUpdaterUI });
  const updatePromptLabel = updatePrompt ? t('nav.update_available') + ': ' + updatePrompt.releaseVersion : '';
  const updatePromptTitle = updatePrompt && updateActionError ? updatePromptLabel + ' / ' + t('nav.update_failed') + ': ' + updateActionError : updatePromptLabel;
  const updateButtonLabel = updateActionError
    ? t('nav.update_failed')
    : isUpdateActionPending
      ? (t('nav.updating') + ' ' + (updatePrompt?.releaseVersion ?? '')).trim()
      : updatePrompt
        ? t('nav.update_now') + ' ' + updatePrompt.releaseVersion
        : t('nav.update_now');
  const UpdateActionIcon = updatePrompt?.action === 'open-release-page' ? ExternalLink : Download;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState<OpenSection>(() => getSelectedSection(activePage));
  const selectedSection = getSelectedSection(activePage);
  const isExpanded = !isCollapsed;

  useEffect(() => {
    if (isExpanded && selectedSection) {
      setOpenSection(selectedSection);
    }
  }, [isExpanded, selectedSection]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      onCollapsedChange?.(next);
      if (next) setOpenSection(null);
      if (!next) setOpenSection(getSelectedSection(activePage));
      return next;
    });
  }, [activePage, onCollapsedChange]);

  function handleSectionTitleClick(section: 'codex' | 'claude') {
    setActivePage(section);
    if (isExpanded) setOpenSection(section);
  }

  function handleMenuClick({ key }: { key: string }) {
    if (key.startsWith('codex:')) {
      setActivePage('codex');
      setActiveCodexWorkspace(key.slice('codex:'.length) as CodexWorkspace);
      setOpenSection('codex');
      return;
    }

    if (key.startsWith('claude:')) {
      setActivePage('claude');
      setActiveClaudeWorkspace(key.slice('claude:'.length) as ClaudeWorkspace);
      setOpenSection('claude');
      return;
    }

    setActivePage(key as AppPage);
    setOpenSection(null);
  }

  function handleOpenChange(keys: string[]) {
    const nextSection = [...keys].reverse().find(isSectionId) ?? null;
    setOpenSection(nextSection);
  }

  const selectedMenuKey =
    activePage === 'codex'
      ? 'codex:' + activeCodexWorkspace
      : activePage === 'claude'
        ? 'claude:' + activeClaudeWorkspace
        : activePage;
  const sidebarOpenKeys = isExpanded && openSection ? [openSection] : [];

  const sidebarMenuItems = useMemo<MenuProps['items']>(() => {
    return navItems.map((item) => {
      if (item.id === 'codex') {
        return {
          key: 'codex',
          icon: renderSidebarIcon(item.icon),
          label: t(item.label),
          title: t(item.label),
          onTitleClick: () => handleSectionTitleClick('codex'),
          children: codexWorkspaceItems.map((workspace) => ({
            key: 'codex:' + workspace.id,
            label: t(workspace.label),
            title: t(workspace.label),
          })),
        };
      }

      if (item.id === 'claude') {
        return {
          key: 'claude',
          icon: renderSidebarIcon(item.icon),
          label: t(item.label),
          title: t(item.label),
          onTitleClick: () => handleSectionTitleClick('claude'),
          children: claudeWorkspaceItems.map((workspace) => ({
            key: 'claude:' + workspace.id,
            label: t(workspace.label),
            title: t(workspace.label),
          })),
        };
      }

      return {
        key: item.id,
        icon: renderSidebarIcon(item.icon),
        label: t(item.label),
        title: t(item.label),
      };
    });
  }, [navItems, t]);

  return (
    <aside
      className={[
        'relative z-20 flex h-full shrink-0 flex-col transition-[width] duration-150',
        isCollapsed ? 'w-[4.75rem]' : 'w-[15rem]',
      ].join(' ')}
      style={{ borderRight: '1px solid var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-canvas)' }}
      data-collaboration-id="NAV_SIDEBAR"
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <div
        className={[
          'flex items-center',
          isCollapsed ? 'justify-center px-3 pb-2 pt-[22px]' : 'justify-between px-3 pb-2 pt-[22px]',
        ].join(' ')}
      >
        {isExpanded ? (
          <div
            className="min-w-0 truncate text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]"
            data-sidebar-context-label="true"
          >
            {t('nav.sidebar_navigation')}
          </div>
        ) : null}
        <Button
          size="small"
          onClick={toggleCollapsed}
          aria-label={t(getSidebarToggleTranslationKey(isCollapsed))}
          title={t(getSidebarToggleTranslationKey(isCollapsed))}
          className={'flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-75 hover:bg-[var(--gt-surface-muted)] ' + FOCUS_RING}
          style={{ color: 'var(--gt-ink-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </Button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
        style={{ overscrollBehavior: 'contain' }}
        aria-label={t('nav.sidebar_navigation')}
      >
        <Menu
          className="gt-sidebar-menu"
          data-sidebar-menu="antd"
          mode="inline"
          selectable
          items={sidebarMenuItems}
          selectedKeys={[selectedMenuKey]}
          openKeys={sidebarOpenKeys}
          inlineCollapsed={isCollapsed}
          onClick={({ key }) => handleMenuClick({ key: String(key) })}
          onOpenChange={handleOpenChange}
          triggerSubMenuAction="click"
          style={{
            borderInlineEnd: 0,
            background: 'transparent',
            fontFamily: 'var(--gt-font-family-sans)',
          }}
        />
      </nav>

      <div
        className="px-3 py-2"
        style={{ borderTop: '1px solid var(--gt-border-subtle)' }}
      >
        {isExpanded ? (
          <div className="flex flex-col items-center">
            <div className="font-mono text-[length:var(--gt-font-size-2xs)] leading-[var(--gt-line-height-tight)] text-[var(--gt-ink-muted)] tabular-nums">
              v{sidebarVersion}
            </div>
            {updatePrompt && (
              <>
                <div className="mt-1 text-[length:var(--gt-font-size-3xs)] font-normal leading-[var(--gt-line-height-tight)] text-[var(--gt-status-success)]">
                  {t('nav.update_available')}
                </div>
                <Button
                  size="small"
                  className={'mt-1 flex h-5 w-full items-center justify-center gap-1 rounded-md !bg-[var(--gt-status-success)] text-[length:var(--gt-font-size-2xs)] font-semibold leading-[var(--gt-line-height-tight)] !text-[var(--gt-ink-inverse)] disabled:cursor-wait disabled:opacity-60 ' + FOCUS_RING}
                  aria-label={updatePromptLabel}
                  title={updatePromptTitle}
                  aria-live="polite"
                  onClick={onUpdateAction}
                  disabled={!onUpdateAction || isUpdateActionPending}
                >
                  <UpdateActionIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{updateButtonLabel}</span>
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid place-items-center">
            {updatePrompt ? (
              <Button
                size="small"
                className={'flex h-6 w-6 items-center justify-center rounded-md disabled:cursor-wait disabled:opacity-60 ' + FOCUS_RING}
                style={{ backgroundColor: 'var(--gt-status-success)', color: 'var(--gt-ink-inverse)' }}
                aria-label={updatePromptLabel}
                title={updatePromptTitle}
                aria-live="polite"
                onClick={onUpdateAction}
                disabled={!onUpdateAction || isUpdateActionPending}
              >
                <UpdateActionIcon className="h-3 w-3" aria-hidden="true" />
              </Button>
            ) : (
              <div
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: 'var(--gt-ink-muted)', opacity: 0.4 }}
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
