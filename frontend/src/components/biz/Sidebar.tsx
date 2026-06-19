import { useState, useCallback } from 'react';
import { Download, ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AppPage, ClaudeWorkspace, CodexWorkspace, ReleaseInfo } from '../../types';
import { formatSidebarVersion } from '../../utils/version';
import { getSidebarNavItems } from './sidebarNav';
import { resolveSidebarUpdatePrompt } from './sidebarUpdatePrompt';
import { getSidebarToggleTranslationKey } from './sidebarState';

type OpenSection = 'accounts' | 'codex' | 'claude' | null;

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

const SECTION_IDS = ['accounts', 'codex', 'claude'] as const;

function isSectionId(id: string): id is 'accounts' | 'codex' | 'claude' {
  return SECTION_IDS.includes(id as any);
}

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
  const updatePromptLabel = updatePrompt ? `${t('nav.update_available')}: ${updatePrompt.releaseVersion}` : '';
  const updatePromptTitle = updatePrompt && updateActionError ? `${updatePromptLabel} / ${t('nav.update_failed')}: ${updateActionError}` : updatePromptLabel;
  const updateButtonLabel = updateActionError
    ? t('nav.update_failed')
    : isUpdateActionPending
      ? `${t('nav.updating')} ${updatePrompt?.releaseVersion ?? ''}`.trim()
      : updatePrompt
        ? `${t('nav.update_now')} ${updatePrompt.releaseVersion}`
        : t('nav.update_now');
  const UpdateActionIcon = updatePrompt?.action === 'open-release-page' ? ExternalLink : Download;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const isExpanded = !isCollapsed;

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      onCollapsedChange?.(next);
      if (next) setOpenSection(null);
      return next;
    });
  }, [onCollapsedChange]);

  function handleNavItemClick(item: { id: string; label: string }) {
    if (isSectionId(item.id)) {
      if (isExpanded) {
        // 展开时：只 toggle 子菜单，不切换页面
        setOpenSection((prev) => prev === item.id ? null : (item.id as OpenSection));
      } else {
        // 折叠时：点击直接导航到该 section（accounts/codex/claude）
        setActivePage(item.id as AppPage);
        setOpenSection(null);
      }
    } else {
      // 普通页面：直接导航
      setActivePage(item.id as AppPage);
      setOpenSection(null);
    }
  }

  function handleSubmenuItemClick(section: 'codex' | 'claude', workspaceId: string) {
    setActivePage(section);
    if (section === 'codex') setActiveCodexWorkspace(workspaceId as CodexWorkspace);
    if (section === 'claude') setActiveClaudeWorkspace(workspaceId as ClaudeWorkspace);
    if (isExpanded) setOpenSection(null);
  }

  function handleSectionMouseEnter(sectionId: string) {
    // 折叠时 hover 打开飞出菜单
    if (!isExpanded && isSectionId(sectionId)) {
      setOpenSection(sectionId as OpenSection);
    }
  }

  function handleSectionMouseLeave() {
    // 折叠时 mouseLeave 关闭飞出菜单
    if (!isExpanded) setOpenSection(null);
  }

  return (
    <aside
      className={`relative z-20 flex h-full shrink-0 flex-col overflow-x-hidden border-r transition-[width] duration-200 ease-out ${
        isCollapsed ? 'w-[4.75rem]' : 'w-60'
      }`}
      style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-panel)' }}
      data-collaboration-id="NAV_SIDEBAR"
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      {/* Brand */}
      <div className={`border-b transition-[padding] duration-200 ease-out ${isCollapsed ? 'p-3' : 'p-5'}`} style={{ borderColor: 'var(--gt-border-subtle)' }}>
        <div className={`flex transition-[gap] duration-200 ease-out ${isCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-4'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="h-8 w-8 shrink-0" style={{ color: 'var(--gt-accent-primary)' }}>
              <svg viewBox="0 0 100 100" className="h-full w-full" fill="currentColor" aria-hidden="true">
                <rect x="10" y="14" width="80" height="32" rx="4" />
                <rect x="58" y="46" width="32" height="24" rx="4" />
                <rect x="74" y="70" width="16" height="16" rx="3" />
                <circle cx="26" cy="30" r="6.4" fill="var(--gt-surface-panel)" />
              </svg>
            </div>
            {isExpanded && (
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--gt-font-family-sans)', color: 'var(--gt-ink-primary)' }}>
                GetTokens
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t(getSidebarToggleTranslationKey(isCollapsed))}
            title={t(getSidebarToggleTranslationKey(isCollapsed))}
            aria-expanded={isExpanded}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition duration-150 hover:bg-[var(--gt-surface-muted)] active:scale-95"
            style={{ color: 'var(--gt-ink-secondary)' }}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto transition-[padding] duration-200 ease-out ${isCollapsed ? 'space-y-1 p-2' : 'space-y-1 p-3'}`}>
        {navItems.map((item) => {
          const hasSubmenu = isSectionId(item.id);
          const isActive = activePage === item.id;
          const isOpen = hasSubmenu && openSection === item.id;

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => handleSectionMouseEnter(item.id)}
              onMouseLeave={() => handleSectionMouseLeave()}
            >
              <button
                type="button"
                aria-label={isCollapsed ? t(item.label) : undefined}
                aria-expanded={hasSubmenu ? isOpen : undefined}
                title={isCollapsed ? t(item.label) : undefined}
                onClick={() => handleNavItemClick(item)}
                className={`flex w-full items-center rounded-lg py-2 text-sm font-medium transition duration-150 active:scale-[0.98] ${
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                }`}
                style={{
                  color: isActive ? 'var(--gt-accent-primary)' : 'var(--gt-ink-secondary)',
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--gt-accent-primary) 8%, transparent)' : 'transparent',
                  fontFamily: 'var(--gt-font-family-sans)',
                }}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {isExpanded && (
                  <span className="flex-1 text-left">{t(item.label)}</span>
                )}
                {hasSubmenu && isExpanded && (
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                )}
              </button>

              {/* Submenu */}
              {hasSubmenu && (
                <Submenu
                  isOpen={isOpen}
                  isCollapsed={isCollapsed}
                >
                  {item.id === 'codex' && codexWorkspaceItems.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSubmenuItemClick('codex', ws.id)}
                      className="w-full rounded-md px-3 py-1.5 text-left text-sm font-medium transition duration-150 active:scale-[0.98]"
                      style={{
                        color: activePage === 'codex' && activeCodexWorkspace === ws.id ? 'var(--gt-accent-primary)' : 'var(--gt-ink-secondary)',
                        backgroundColor: activePage === 'codex' && activeCodexWorkspace === ws.id ? 'color-mix(in srgb, var(--gt-accent-primary) 8%, transparent)' : 'transparent',
                        fontFamily: 'var(--gt-font-family-sans)',
                      }}
                    >
                      {t(ws.label)}
                    </button>
                  ))}
                  {item.id === 'claude' && claudeWorkspaceItems.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSubmenuItemClick('claude', ws.id)}
                      className="w-full rounded-md px-3 py-1.5 text-left text-sm font-medium transition duration-150 active:scale-[0.98]"
                      style={{
                        color: activePage === 'claude' && activeClaudeWorkspace === ws.id ? 'var(--gt-accent-primary)' : 'var(--gt-ink-secondary)',
                        backgroundColor: activePage === 'claude' && activeClaudeWorkspace === ws.id ? 'color-mix(in srgb, var(--gt-accent-primary) 8%, transparent)' : 'transparent',
                        fontFamily: 'var(--gt-font-family-sans)',
                      }}
                    >
                      {t(ws.label)}
                    </button>
                  ))}
                  {item.id === 'accounts' && (
                    <div className="px-3 py-1.5 text-xs" style={{ color: 'var(--gt-ink-muted)' }}>
                      {t('nav.accounts_all')}
                    </div>
                  )}
                </Submenu>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: version + update */}
      <div className={`border-t transition-[padding] duration-200 ease-out ${isCollapsed ? 'p-3' : 'p-4'}`} style={{ borderColor: 'var(--gt-border-subtle)' }}>
        <div className="grid place-items-center">
          {isExpanded && (
            <div
              className="col-start-1 row-start-1 flex w-full flex-col items-center justify-center text-xs"
              style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}
            >
              <div className="max-w-full truncate text-center">v{sidebarVersion}</div>
              {updatePrompt && (
                <>
                  <div className="mt-2 max-w-full truncate text-center text-[10px] font-medium" style={{ color: 'var(--gt-status-success)' }}>
                    {t('nav.update_available')}
                  </div>
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-7 w-full min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                    style={{ backgroundColor: 'var(--gt-status-success)', color: '#ffffff' }}
                    aria-label={updatePromptLabel}
                    title={updatePromptTitle}
                    onClick={onUpdateAction}
                    disabled={!onUpdateAction || isUpdateActionPending}
                  >
                    <UpdateActionIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{updateButtonLabel}</span>
                  </button>
                </>
              )}
            </div>
          )}
          {isCollapsed && updatePrompt ? (
            <button
              type="button"
              className="col-start-1 row-start-1 flex h-7 w-7 items-center justify-center rounded-full transition duration-200 hover:opacity-90 active:scale-95 disabled:cursor-wait disabled:opacity-70"
              style={{ backgroundColor: 'var(--gt-status-success)', color: '#ffffff' }}
              aria-label={updatePromptLabel}
              title={updatePromptTitle}
              onClick={onUpdateAction}
              disabled={!onUpdateAction || isUpdateActionPending}
            >
              <UpdateActionIcon className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : isCollapsed ? (
            <div
              className="col-start-1 row-start-1 h-2 w-2 rounded-full"
              style={{ backgroundColor: 'var(--gt-accent-primary)' }}
              role="img"
              aria-label={`v${sidebarVersion}`}
              title={`v${sidebarVersion}`}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/* ─── Submenu ─── */

function Submenu({
  isOpen,
  isCollapsed,
  children,
}: {
  isOpen: boolean;
  isCollapsed: boolean;
  children: React.ReactNode;
}) {
  if (isCollapsed) {
    // Flyout to the right
    return (
      <div
        className={`absolute left-full top-0 z-30 w-56 pl-3 transition duration-200 ease-out ${
          isOpen ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none -translate-x-2 opacity-0'
        }`}
      >
        <div className="rounded-lg border p-2" style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}>
          <div className="space-y-0.5">{children}</div>
        </div>
      </div>
    );
  }

  // Expand below
  return (
    <div
      className={`grid w-full overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="pt-1">
          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}>
            <div className="space-y-0.5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
