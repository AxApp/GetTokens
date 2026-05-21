import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AppPage, ClaudeWorkspace, CodexWorkspace } from '../../types';
import { formatSidebarVersion } from '../../utils/version';
import { getSidebarNavItems } from './sidebarNav';
import {
  getSidebarContentMotionState,
  getOpenSidebarSection,
  getSidebarSubmenuMotionState,
  getSidebarSubmenuPlacement,
  getSidebarToggleTranslationKey,
  resolveHoveredSidebarSection,
  type SidebarSection,
} from './sidebarState';

interface SidebarProps {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  activeCodexWorkspace: CodexWorkspace;
  setActiveCodexWorkspace: (workspace: CodexWorkspace) => void;
  activeClaudeWorkspace: ClaudeWorkspace;
  setActiveClaudeWorkspace: (workspace: ClaudeWorkspace) => void;
  releaseLabel: string;
  showDeveloperTools?: boolean;
}

const codexWorkspaceItems = [
  { id: 'feature-config', label: 'nav.codex_feature_config' },
  { id: 'binary-management', label: 'nav.codex_binary_management' },
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
] as const satisfies ReadonlyArray<{ id: ClaudeWorkspace; label: string }>;

export default function Sidebar({
  activePage,
  setActivePage,
  activeCodexWorkspace,
  setActiveCodexWorkspace,
  activeClaudeWorkspace,
  setActiveClaudeWorkspace,
  releaseLabel,
  showDeveloperTools = import.meta.env.DEV,
}: SidebarProps) {
  const { t } = useI18n();
  const navItems = getSidebarNavItems(showDeveloperTools);
  const sidebarVersion = formatSidebarVersion(releaseLabel);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<SidebarSection | null>(null);
  const [pinnedSection, setPinnedSection] = useState<SidebarSection | null>(null);
  const contentMotionState = getSidebarContentMotionState(isCollapsed);
  const openSection = getOpenSidebarSection(pinnedSection, hoveredSection);
  const submenuPlacement = getSidebarSubmenuPlacement(isCollapsed);
  const accountsOpen = openSection === 'accounts';
  const codexOpen = openSection === 'codex';
  const claudeOpen = openSection === 'claude';
  const accountsMotionState = getSidebarSubmenuMotionState(submenuPlacement, accountsOpen);
  const codexMotionState = getSidebarSubmenuMotionState(submenuPlacement, codexOpen);
  const claudeMotionState = getSidebarSubmenuMotionState(submenuPlacement, claudeOpen);
  const sidebarToggleLabel = t(getSidebarToggleTranslationKey(isCollapsed));
  const brandTextClassName =
    contentMotionState === 'expanded'
      ? 'max-w-[8rem] translate-x-0 opacity-100'
      : 'max-w-0 -translate-x-2 opacity-0';
  const navLabelClassName =
    contentMotionState === 'expanded'
      ? 'max-w-[9rem] flex-1 translate-x-0 opacity-100'
      : 'max-w-0 -translate-x-1 opacity-0';
  const navChevronClassName =
    contentMotionState === 'expanded'
      ? 'max-w-4 translate-x-0 opacity-100'
      : 'max-w-0 translate-x-1 opacity-0';
  const versionTextClassName =
    contentMotionState === 'expanded'
      ? 'scale-100 opacity-100'
      : 'pointer-events-none scale-95 opacity-0';
  const versionDotClassName =
    contentMotionState === 'collapsed'
      ? 'scale-100 opacity-100'
      : 'pointer-events-none scale-75 opacity-0';
  const submenuWrapperBaseClassName =
    submenuPlacement === 'right'
      ? 'absolute left-full top-0 z-30 w-56 pl-3 transition-[opacity,transform] duration-200 ease-out'
      : 'grid w-full overflow-hidden transition-[grid-template-rows,opacity,transform,padding-top] duration-200 ease-out';
  const submenuPanelClassName =
    submenuPlacement === 'right'
      ? 'border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[6px_6px_0_var(--shadow-color)]'
      : 'border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[4px_4px_0_var(--shadow-color)]';
  const submenuInnerClassName = submenuPlacement === 'right' ? '' : 'min-h-0 overflow-hidden';

  function getSubmenuWrapperClassName(motionState: 'open-right' | 'closed-right' | 'open-bottom' | 'closed-bottom'): string {
    if (motionState === 'open-right') {
      return `${submenuWrapperBaseClassName} pointer-events-auto translate-x-0 opacity-100`;
    }
    if (motionState === 'closed-right') {
      return `${submenuWrapperBaseClassName} pointer-events-none -translate-x-2 opacity-0`;
    }
    if (motionState === 'open-bottom') {
      return `${submenuWrapperBaseClassName} pointer-events-auto grid-rows-[1fr] translate-y-0 pt-2 opacity-100`;
    }
    return `${submenuWrapperBaseClassName} pointer-events-none grid-rows-[0fr] -translate-y-1 pt-0 opacity-0`;
  }

  return (
    <aside
      className={`relative z-20 flex h-full shrink-0 flex-col overflow-x-hidden border-r-2 border-[var(--border-color)] bg-[var(--bg-main)] transition-[width] duration-200 ease-out ${
        isCollapsed ? 'w-[4.75rem]' : 'w-60'
      }`}
      data-collaboration-id="NAV_SIDEBAR"
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <div className={`border-b-2 border-[var(--border-color)] transition-[padding] duration-200 ease-out ${isCollapsed ? 'p-3' : 'p-8'}`}>
        <div className={`flex transition-[gap] duration-200 ease-out ${isCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-4'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
            <div className="h-10 w-10 shrink-0 text-[var(--accent-red)]">
              <svg viewBox="0 0 100 100" className="h-full w-full" fill="currentColor" aria-hidden="true">
                <rect x="10" y="14" width="80" height="32" />
                <rect x="58" y="46" width="32" height="24" />
                <rect x="74" y="70" width="16" height="16" />
                <circle cx="26" cy="30" r="6.4" fill="var(--bg-main)" />
              </svg>
            </div>
            <div
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out ${brandTextClassName}`}
              aria-hidden={isCollapsed}
            >
              <div className="flex flex-col text-2xl font-black italic tracking-tighter uppercase leading-none">
                <span>GET</span>
                <span className="mt-[-4px] text-[var(--text-muted)]">TOKENS</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
            aria-expanded={!isCollapsed}
            className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[var(--border-color)] text-[var(--text-primary)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--border-color)] hover:text-[var(--bg-main)] active:scale-95"
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className={`flex-1 transition-[padding] duration-200 ease-out ${isCollapsed ? 'space-y-3 p-3' : 'space-y-4 p-4'}`}>
        {navItems.map((item) => (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => setHoveredSection(resolveHoveredSidebarSection(item.id))}
            onMouseLeave={() => setHoveredSection(null)}
            onFocus={() => setHoveredSection(resolveHoveredSidebarSection(item.id))}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setHoveredSection(null);
              }
            }}
          >
            <button
              type="button"
              aria-label={isCollapsed ? t(item.label) : undefined}
              aria-expanded={
                item.id === 'accounts' || item.id === 'codex' || item.id === 'claude'
                  ? (item.id === 'accounts' && accountsOpen) ||
                    (item.id === 'codex' && codexOpen) ||
                    (item.id === 'claude' && claudeOpen)
                  : undefined
              }
              title={isCollapsed ? t(item.label) : undefined}
              onClick={() => {
                if (item.id === 'accounts') {
                  setActivePage('accounts');
                  setPinnedSection('accounts');
                  return;
                }
                if (item.id === 'codex') {
                  setActivePage('codex');
                  setPinnedSection('codex');
                  return;
                }
                if (item.id === 'claude') {
                  setActivePage('claude');
                  setPinnedSection('claude');
                  return;
                }
                setActivePage(item.id);
                setHoveredSection(null);
                setPinnedSection(null);
              }}
              className={`flex w-full items-center border-2 py-3 text-xs font-bold uppercase tracking-widest transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-95 ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${
                activePage === item.id
                  ? 'bg-[var(--border-color)] text-[var(--bg-main)] border-[var(--border-color)] shadow-[4px_4px_0_var(--shadow-color)]'
                  : 'border-transparent text-[var(--text-primary)] hover:border-[var(--border-color)]'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              <span
                className={`overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,transform] duration-200 ease-out ${navLabelClassName}`}
                aria-hidden={isCollapsed}
              >
                <span className="block">{t(item.label)}</span>
              </span>
              {item.id === 'accounts' || item.id === 'codex' || item.id === 'claude' ? (
                <span
                  className={`overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out ${navChevronClassName}`}
                  aria-hidden={isCollapsed}
                >
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${
                      (item.id === 'accounts' && accountsOpen) ||
                      (item.id === 'codex' && codexOpen) ||
                      (item.id === 'claude' && claudeOpen)
                        ? 'rotate-90'
                        : 'rotate-0'
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              ) : null}
            </button>
            {item.id === 'codex' ? (
              <div
                className={getSubmenuWrapperClassName(codexMotionState)}
                data-sidebar-submenu-placement={submenuPlacement}
                data-sidebar-submenu-state={codexMotionState}
                aria-hidden={!codexOpen}
              >
                <div className={submenuInnerClassName}>
                  <div className={submenuPanelClassName}>
                    <div className="space-y-2 pl-0">
                      {codexWorkspaceItems.map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => {
                            setActivePage('codex');
                            setHoveredSection(null);
                            setPinnedSection('codex');
                            setActiveCodexWorkspace(workspace.id);
                          }}
                          className={`w-full border px-3 py-2 text-left text-[length:var(--font-size-ui-md-compact)] font-black tracking-[0.08em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-95 ${
                            activePage === 'codex' && activeCodexWorkspace === workspace.id
                              ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[4px_4px_0_var(--shadow-color)]'
                              : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-color)]'
                          }`}
                        >
                          {t(workspace.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {item.id === 'claude' ? (
              <div
                className={getSubmenuWrapperClassName(claudeMotionState)}
                data-sidebar-submenu-placement={submenuPlacement}
                data-sidebar-submenu-state={claudeMotionState}
                aria-hidden={!claudeOpen}
              >
                <div className={submenuInnerClassName}>
                  <div className={submenuPanelClassName}>
                    <div className="space-y-2 pl-0">
                      {claudeWorkspaceItems.map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => {
                            setActivePage('claude');
                            setHoveredSection(null);
                            setPinnedSection('claude');
                            setActiveClaudeWorkspace(workspace.id);
                          }}
                          className={`w-full border px-3 py-2 text-left text-[length:var(--font-size-ui-md-compact)] font-black tracking-[0.08em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-95 ${
                            activePage === 'claude' && activeClaudeWorkspace === workspace.id
                              ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[4px_4px_0_var(--shadow-color)]'
                              : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-color)]'
                          }`}
                        >
                          {t(workspace.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className={`border-t-2 border-[var(--border-color)] transition-[padding] duration-200 ease-out ${isCollapsed ? 'p-3' : 'p-6'}`}>
        <div className="grid place-items-center">
          <div
            className={`col-start-1 row-start-1 text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-tighter text-[var(--text-muted)] transition-[opacity,transform] duration-200 ease-out ${versionTextClassName}`}
            aria-hidden={isCollapsed}
          >
            VERSION {sidebarVersion}
          </div>
          <div
            className={`col-start-1 row-start-1 h-2.5 w-2.5 bg-[var(--accent-red)] transition-[opacity,transform] duration-200 ease-out ${versionDotClassName}`}
            role="img"
            aria-label={`VERSION ${sidebarVersion}`}
            title={`VERSION ${sidebarVersion}`}
          />
        </div>
      </div>
    </aside>
  );
}
