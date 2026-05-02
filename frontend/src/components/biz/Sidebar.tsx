import { useEffect, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import type { AccountWorkspace, AppPage, CodexWorkspace } from '../../types';
import { formatSidebarVersion } from '../../utils/version';

const navItems = [
  { id: 'status', label: 'nav.status', icon: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 8v4l3 3' },
  { id: 'accounts', label: 'nav.accounts', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
  { id: 'proxy-pool', label: 'nav.proxy_pool', icon: 'M3 4h18v6H3z M3 14h8v6H3z M13 14h8v6h-8z' },
  { id: 'codex', label: 'nav.codex', icon: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5' },
  { id: 'settings', label: 'nav.settings', icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2' },
  { id: 'debug', label: 'nav.debug', icon: 'M9.75 3.25h4.5 M12 3.25v3.5 M5.5 9.5l-2 2 2 2 M18.5 9.5l2 2-2 2 M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M7.5 20.75h9' },
] as const satisfies ReadonlyArray<{ id: AppPage; label: string; icon: string }>;

interface SidebarProps {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  activeAccountWorkspace: AccountWorkspace;
  setActiveAccountWorkspace: (workspace: AccountWorkspace) => void;
  activeCodexWorkspace: CodexWorkspace;
  setActiveCodexWorkspace: (workspace: CodexWorkspace) => void;
  releaseLabel: string;
}

const accountWorkspaceItems = [
  { id: 'codex', label: 'nav.accounts_codex' },
  { id: 'openai-compatible', label: 'nav.accounts_openai_compatible' },
] as const satisfies ReadonlyArray<{ id: AccountWorkspace; label: string }>;

const codexWorkspaceItems = [
  { id: 'feature-config', label: 'nav.codex_feature_config' },
  { id: 'session-management', label: 'nav.session_management' },
  { id: 'vendor-status', label: 'nav.openai_status' },
  { id: 'usage-codex', label: 'nav.usage_desk_codex' },
] as const satisfies ReadonlyArray<{ id: CodexWorkspace; label: string }>;

export default function Sidebar({
  activePage,
  setActivePage,
  activeAccountWorkspace,
  setActiveAccountWorkspace,
  activeCodexWorkspace,
  setActiveCodexWorkspace,
  releaseLabel,
}: SidebarProps) {
  const { t } = useI18n();
  const sidebarVersion = formatSidebarVersion(releaseLabel);
  const [expandedSection, setExpandedSection] = useState<'accounts' | 'codex' | null>(
    activePage === 'accounts' ||
      activePage === 'codex'
      ? activePage
      : null
  );

  useEffect(() => {
    if (
      activePage !== 'accounts' &&
      activePage !== 'codex'
    ) {
      setExpandedSection(null);
    }
  }, [activePage]);

  const accountsExpanded = expandedSection === 'accounts';
  const codexExpanded = expandedSection === 'codex';

  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col border-r-2 border-[var(--border-color)] bg-[var(--bg-main)]"
      data-collaboration-id="NAV_SIDEBAR"
    >
      <div className="border-b-2 border-[var(--border-color)] p-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 text-[var(--accent-red)]">
            <svg viewBox="0 0 100 100" className="h-full w-full" fill="currentColor">
              <rect x="10" y="14" width="80" height="32" />
              <rect x="58" y="46" width="32" height="24" />
              <rect x="74" y="70" width="16" height="16" />
              <circle cx="26" cy="30" r="6.4" fill="var(--bg-main)" />
            </svg>
          </div>
          <div className="flex flex-col text-2xl font-black italic tracking-tighter uppercase leading-none">
            <span>GET</span>
            <span className="mt-[-4px] text-[var(--text-muted)]">TOKENS</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 p-4">
        {navItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => {
                if (item.id === 'accounts') {
                  setActivePage('accounts');
                  setExpandedSection((prev) => (activePage === 'accounts' && prev === 'accounts' ? null : 'accounts'));
                  return;
                }
                if (item.id === 'codex') {
                  setActivePage('codex');
                  setExpandedSection((prev) => (activePage === 'codex' && prev === 'codex' ? null : 'codex'));
                  return;
                }
                setActivePage(item.id);
                setExpandedSection(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 font-bold text-xs uppercase tracking-widest border-2 transition-all active:scale-95 ${
                activePage === item.id
                  ? 'bg-[var(--border-color)] text-[var(--bg-main)] border-[var(--border-color)] shadow-[4px_4px_0_var(--shadow-color)]'
                  : 'border-transparent text-[var(--text-primary)] hover:border-[var(--border-color)]'
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d={item.icon} />
              </svg>
              <span className="flex-1 text-left">{t(item.label)}</span>
              {item.id === 'accounts' || item.id === 'codex' ? (
                <svg
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${
                    (item.id === 'accounts' && accountsExpanded) || (item.id === 'codex' && codexExpanded)
                      ? 'rotate-90'
                      : 'rotate-0'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              ) : null}
            </button>
            {item.id === 'accounts' ? (
              <div
                className={`grid transition-all duration-300 ease-out ${
                  accountsExpanded ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                }`}
                aria-hidden={!accountsExpanded}
              >
                <div className="overflow-hidden">
                  <div
                    className={`space-y-2 pl-6 transition-all duration-300 ease-out ${
                      accountsExpanded ? 'translate-y-0' : '-translate-y-2'
                    }`}
                  >
                    {accountWorkspaceItems.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => {
                          setActivePage('accounts');
                          setExpandedSection('accounts');
                          setActiveAccountWorkspace(workspace.id);
                        }}
                        className={`w-full border px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.2em] transition-all ${
                          activeAccountWorkspace === workspace.id
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
            ) : null}
            {item.id === 'codex' ? (
              <div
                className={`grid transition-all duration-300 ease-out ${
                  codexExpanded ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                }`}
                aria-hidden={!codexExpanded}
              >
                <div className="overflow-hidden">
                  <div
                    className={`space-y-2 pl-6 transition-all duration-300 ease-out ${
                      codexExpanded ? 'translate-y-0' : '-translate-y-2'
                    }`}
                  >
                    {codexWorkspaceItems.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => {
                          setActivePage('codex');
                          setExpandedSection('codex');
                          setActiveCodexWorkspace(workspace.id);
                        }}
                        className={`w-full border px-3 py-2 text-left text-[0.6875rem] font-black tracking-[0.08em] transition-all ${
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
            ) : null}
          </div>
        ))}
      </nav>

      <div className="border-t-2 border-[var(--border-color)] p-6">
        <div className="text-[0.5625rem] font-bold uppercase tracking-tighter text-[var(--text-muted)]">
          VERSION {sidebarVersion}
        </div>
      </div>
    </aside>
  );
}
