import { useI18n } from '../../context/I18nContext.jsx';

const navItems = [
  { id: 'status', label: 'nav.status', icon: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 8v4l3 3' },
  { id: 'accounts', label: 'nav.accounts', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
  { id: 'settings', label: 'nav.settings', icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2' },
];

export default function Sidebar({ activePage, setActivePage, version }) {
  const { t } = useI18n();

  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col border-r-2 border-[var(--border-color)] bg-[var(--bg-main)]"
      data-collaboration-id="NAV_SIDEBAR"
    >
      <div className="border-b-2 border-[var(--border-color)] p-8">
        <div className="flex flex-col text-2xl font-black italic tracking-tighter uppercase">
          <span>GET</span>
          <span className="mt-[-8px] text-[var(--text-muted)]">TOKENS</span>
        </div>
      </div>

      <nav className="flex-1 space-y-4 p-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 font-bold text-xs uppercase tracking-widest border-2 transition-all active:scale-95 ${
              activePage === item.id
                ? 'bg-[var(--border-color)] text-[var(--bg-main)] border-[var(--border-color)] shadow-hard shadow-[var(--shadow-color)]'
                : 'border-transparent text-[var(--text-primary)] hover:border-[var(--border-color)]'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d={item.icon} />
            </svg>
            <span>{t(item.label)}</span>
          </button>
        ))}
      </nav>

      <div className="border-t-2 border-[var(--border-color)] p-6">
        <div className="text-[9px] font-bold uppercase tracking-tighter text-[var(--text-muted)]">
          BUILD {version}
        </div>
      </div>
    </aside>
  );
}
