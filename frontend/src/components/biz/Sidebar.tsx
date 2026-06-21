import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Download, ExternalLink } from 'lucide-react';
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
  const navItemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
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
      setActivePage(item.id as AppPage);
      if (isExpanded) {
        setOpenSection((prev) => prev === item.id ? null : (item.id as OpenSection));
      } else {
        setOpenSection(null);
      }
    } else {
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
    if (!isExpanded && isSectionId(sectionId)) {
      setOpenSection(sectionId as OpenSection);
    }
  }

  function handleSectionMouseLeave() {
    if (!isExpanded) setOpenSection(null);
  }

  return (
    <aside
      className={`relative z-20 flex h-full shrink-0 flex-col transition-[width] duration-150 ${
        isCollapsed ? 'w-[48px]' : 'w-[220px]'
      }`}
      style={{ borderRight: '1px solid var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-canvas)' }}
      data-collaboration-id="NAV_SIDEBAR"
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      {/* Header: traffic light zone + toggle */}
      <div
        className={`flex items-center ${isCollapsed ? 'justify-center px-2 pt-[22px] pb-1' : 'px-3 pt-[22px] pb-1'}`}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t(getSidebarToggleTranslationKey(isCollapsed))}
          title={t(getSidebarToggleTranslationKey(isCollapsed))}
          className={`flex items-center gap-1.5 rounded p-0.5 transition duration-75 hover:bg-[var(--gt-surface-muted)] active:scale-95 ${FOCUS_RING}`}
          style={{ color: 'var(--gt-ink-muted)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-1"
        style={{ overscrollBehavior: 'contain' }}
      >
        {navItems.map((item) => {
          const hasSubmenu = isSectionId(item.id);
          const isActive = activePage === item.id;
          const isOpen = hasSubmenu && openSection === item.id;

          return (
            <div
              key={item.id}
              ref={(el) => { navItemRefs.current.set(item.id, el); }}
              onMouseEnter={() => handleSectionMouseEnter(item.id)}
              onMouseLeave={() => handleSectionMouseLeave()}
            >
              <button
                type="button"
                aria-label={isCollapsed ? t(item.label) : undefined}
                aria-expanded={hasSubmenu ? isOpen : undefined}
                title={isCollapsed ? t(item.label) : undefined}
                onClick={() => handleNavItemClick(item)}
                className={`flex w-full items-center rounded-md transition duration-75 ${FOCUS_RING} ${
                  isCollapsed ? 'justify-center px-0 py-1.5' : 'px-2 py-1'
                }`}
                style={{
                  color: isActive ? 'var(--gt-ink-primary)' : 'var(--gt-ink-secondary)',
                  backgroundColor: isActive ? 'var(--gt-surface-muted)' : 'transparent',
                  fontFamily: 'var(--gt-font-family-sans)',
                  fontSize: '13px',
                  lineHeight: '20px',
                  fontWeight: isActive ? 500 : 400,
                  gap: isCollapsed ? 0 : '6px',
                }}
              >
                <svg className="shrink-0 opacity-60" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {isExpanded && (
                  <span className="min-w-0 flex-1 truncate text-left">{t(item.label)}</span>
                )}
                {hasSubmenu && isExpanded && (
                  <ChevronDown
                    className="shrink-0 transition-transform duration-100"
                    width="10" height="10"
                    style={{
                      color: 'var(--gt-ink-muted)',
                      opacity: 0.4,
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    }}
                    strokeWidth={2}
                  />
                )}
              </button>

              {/* Submenu */}
              {hasSubmenu && (
                <Submenu
                  isOpen={isOpen}
                  isCollapsed={isCollapsed}
                  parentRef={{ current: navItemRefs.current.get(item.id) ?? null }}
                >
                  {item.id === 'codex' && codexWorkspaceItems.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSubmenuItemClick('codex', ws.id)}
                      className={`w-full rounded-md px-2 py-1 text-left transition duration-75 ${FOCUS_RING}`}
                      style={{
                        color: activePage === 'codex' && activeCodexWorkspace === ws.id ? 'var(--gt-ink-primary)' : 'var(--gt-ink-secondary)',
                        backgroundColor: activePage === 'codex' && activeCodexWorkspace === ws.id ? 'var(--gt-surface-muted)' : 'transparent',
                        fontFamily: 'var(--gt-font-family-sans)',
                        fontSize: '13px',
                        lineHeight: '20px',
                        fontWeight: activePage === 'codex' && activeCodexWorkspace === ws.id ? 500 : 400,
                      }}
                    >
                      {t(ws.label)}
                    </button>
                  ))}
                  {item.id === 'claude' && claudeWorkspaceItems.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => handleSubmenuItemClick('claude', ws.id)}
                      className={`w-full rounded-md px-2 py-1 text-left transition duration-75 ${FOCUS_RING}`}
                      style={{
                        color: activePage === 'claude' && activeClaudeWorkspace === ws.id ? 'var(--gt-ink-primary)' : 'var(--gt-ink-secondary)',
                        backgroundColor: activePage === 'claude' && activeClaudeWorkspace === ws.id ? 'var(--gt-surface-muted)' : 'transparent',
                        fontFamily: 'var(--gt-font-family-sans)',
                        fontSize: '13px',
                        lineHeight: '20px',
                        fontWeight: activePage === 'claude' && activeClaudeWorkspace === ws.id ? 500 : 400,
                      }}
                    >
                      {t(ws.label)}
                    </button>
                  ))}
                </Submenu>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: version + update */}
      <div
        className="px-3 py-2"
        style={{ borderTop: '1px solid var(--gt-border-subtle)' }}
      >
        {isExpanded ? (
          <div className="flex flex-col items-center">
            <div
              style={{
                color: 'var(--gt-ink-muted)',
                fontFamily: 'var(--gt-font-family-mono)',
                fontSize: '10px',
                lineHeight: '14px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              v{sidebarVersion}
            </div>
            {updatePrompt && (
              <>
                <div className="mt-1 font-medium" style={{ color: 'var(--gt-status-success)', fontSize: '9px', lineHeight: '12px' }}>
                  {t('nav.update_available')}
                </div>
                <button
                  type="button"
                  className={`mt-1 flex h-5 w-full items-center justify-center gap-1 rounded transition duration-75 hover:opacity-90 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`}
                  style={{ backgroundColor: 'var(--gt-status-success)', color: '#ffffff', fontSize: '10px', fontWeight: 500, lineHeight: '14px' }}
                  aria-label={updatePromptLabel}
                  title={updatePromptTitle}
                  aria-live="polite"
                  onClick={onUpdateAction}
                  disabled={!onUpdateAction || isUpdateActionPending}
                >
                  <UpdateActionIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{updateButtonLabel}</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid place-items-center">
            {updatePrompt ? (
              <button
                type="button"
                className={`flex h-4 w-4 items-center justify-center rounded-full transition duration-75 hover:opacity-90 active:scale-95 disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`}
                style={{ backgroundColor: 'var(--gt-status-success)', color: '#ffffff' }}
                aria-label={updatePromptLabel}
                title={updatePromptTitle}
                aria-live="polite"
                onClick={onUpdateAction}
                disabled={!onUpdateAction || isUpdateActionPending}
              >
                <UpdateActionIcon className="h-2 w-2" aria-hidden="true" />
              </button>
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

/* ─── Submenu ─── */

function Submenu({
  isOpen,
  isCollapsed,
  parentRef,
  children,
}: {
  isOpen: boolean;
  isCollapsed: boolean;
  parentRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  if (isCollapsed) {
    if (!isOpen || !parentRef.current) return null;
    const rect = parentRef.current.getBoundingClientRect();
    return createPortal(
      <div
        className="pointer-events-auto fixed z-[9999] w-48 rounded-lg p-1"
        role="menu"
        style={{
          left: rect.right + 4,
          top: rect.top - 2,
          backgroundColor: 'var(--gt-surface-raised)',
          boxShadow: '0 4px 16px rgb(0 0 0 / 0.12), 0 0 0 1px var(--gt-border-subtle)',
        }}
      >
        {children}
      </div>,
      document.body,
    );
  }

  return (
    <div
      className={`grid w-full overflow-hidden transition-[grid-template-rows,opacity] duration-100 ease-out ${
        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="py-0.5 pl-5 pr-1" role="menu">
          {children}
        </div>
      </div>
    </div>
  );
}
