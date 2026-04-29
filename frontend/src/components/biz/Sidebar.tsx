import { useEffect, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import type { AccountWorkspace, AppPage, UsageDeskWorkspace } from '../../types';
import { formatSidebarVersion } from '../../utils/version';

const navItems = [
  { id: 'status', label: 'nav.status', icon: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 8v4l3 3' },
  { id: 'accounts', label: 'nav.accounts', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
  { id: 'usage-desk', label: 'nav.usage_desk', icon: 'M3 3h18v18H3z M7 15l3-3 2 2 5-5' },
  { id: 'settings', label: 'nav.settings', icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2' },
  { id: 'debug', label: 'nav.debug', icon: 'M9.75 3.25h4.5 M12 3.25v3.5 M5.5 9.5l-2 2 2 2 M18.5 9.5l2 2-2 2 M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M7.5 20.75h9' },
 ] as const satisfies ReadonlyArray<{ id: AppPage; label: string; icon: string }>;

interface SidebarProps {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  activeAccountWorkspace: AccountWorkspace;
  setActiveAccountWorkspace: (workspace: AccountWorkspace) => void;
  activeUsageDeskWorkspace: UsageDeskWorkspace;
  setActiveUsageDeskWorkspace: (workspace: UsageDeskWorkspace) => void;
  releaseLabel: string;
}

const accountWorkspaceItems = [
  { id: 'codex', label: 'nav.accounts_codex' },
  { id: 'openai-compatible', label: 'nav.accounts_openai_compatible' },
] as const satisfies ReadonlyArray<{ id: AccountWorkspace; label: string }>;

const usageDeskWorkspaceItems = [
  { id: 'codex', label: 'codex' },
  { id: 'gemini', label: 'gemini' },
] as const satisfies ReadonlyArray<{ id: UsageDeskWorkspace; label: string }>;

export default function Sidebar({
  activePage,
  setActivePage,
  activeAccountWorkspace,
  setActiveAccountWorkspace,
  activeUsageDeskWorkspace,
  setActiveUsageDeskWorkspace,
  releaseLabel,
}: SidebarProps) {
  const { t } = useI18n();
  const sidebarVersion = formatSidebarVersion(releaseLabel);
  const [expandedSection, setExpandedSection] = useState<'accounts' | 'usage-desk' | null>(
    activePage === 'accounts' || activePage === 'usage-desk' ? activePage : null
  );

  useEffect(() => {
    if (activePage !== 'accounts' && activePage !== 'usage-desk') {
      setExpandedSection(null);
    }
  }, [activePage]);

  const accountsExpanded = expandedSection === 'accounts';
  const usageDeskExpanded = expandedSection === 'usage-desk';

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
                  if (activePage !== 'accounts') {
                    setActiveAccountWorkspace('all');
                  }
                  return;
                }
                if (item.id === 'usage-desk') {
                  setActivePage('usage-desk');
                  setExpandedSection((prev) => (activePage === 'usage-desk' && prev === 'usage-desk' ? null : 'usage-desk'));
                  return;
                }
                setActivePage(item.id);
                setExpandedSection(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 font-bold text-xs uppercase tracking-widest border-2 transition-all active:scale-95 ${
                activePage === item.id
                  ? 'bg-[var(--border-color)] text-[var(--bg-main)] border-[var(--border-color)] shadow-hard shadow-[var(--shadow-color)]'
                  : 'border-transparent text-[var(--text-primary)] hover:border-[var(--border-color)]'
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d={item.icon} />
              </svg>
              <span className="flex-1 text-left">{t(item.label)}</span>
              {item.id === 'accounts' || item.id === 'usage-desk' ? (
                <svg
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${
                    (item.id === 'accounts' && accountsExpanded) || (item.id === 'usage-desk' && usageDeskExpanded)
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
            {item.id === 'usage-desk' ? (
              <div
                className={`grid transition-all duration-300 ease-out ${
                  usageDeskExpanded ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                }`}
                aria-hidden={!usageDeskExpanded}
              >
                <div className="overflow-hidden">
                  <div
                    className={`space-y-2 pl-6 transition-all duration-300 ease-out ${
                      usageDeskExpanded ? 'translate-y-0' : '-translate-y-2'
                    }`}
                  >
                    {usageDeskWorkspaceItems.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => {
                          setActivePage('usage-desk');
                          setExpandedSection('usage-desk');
                          setActiveUsageDeskWorkspace(workspace.id);
                        }}
                        className={`w-full border px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.2em] transition-all ${
                          activeUsageDeskWorkspace === workspace.id
                            ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[4px_4px_0_var(--shadow-color)]'
                            : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-color)]'
                        }`}
                      >
                        {workspace.label}
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
