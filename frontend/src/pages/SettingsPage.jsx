import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const themes = [
  { id: 'system', label: 'SYSTEM' },
  { id: 'light', label: 'LIGHT' },
  { id: 'dark', label: 'DARK' },
];

const languages = [
  { id: 'zh', label: '简体中文' },
  { id: 'en', label: 'ENGLISH' },
];

export default function SettingsPage() {
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_SETTINGS">
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <header className="border-b-2 border-[var(--border-color)] pb-3">
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
            {t('settings.title')}
          </h2>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {t('settings.subtitle')}
          </p>
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-[var(--bg-main)]">
                01
              </span>
              <h3 className="text-xs font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('settings.appearance')}
              </h3>
            </div>

            <div className="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase italic tracking-widest text-[var(--text-muted)]">
                    {t('settings.theme_mode')}
                  </label>
                  <span className="font-mono text-[8px] font-bold italic opacity-30 text-[var(--text-muted)]">
                    CONFIG_X_THEME
                  </span>
                </div>
                <SegmentedControl options={themes} value={themeMode} onChange={setThemeMode} />
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase italic tracking-widest text-[var(--text-muted)]">
                    {t('settings.language')}
                  </label>
                  <span className="font-mono text-[8px] font-bold italic opacity-30 text-[var(--text-muted)]">
                    CONFIG_X_LANG
                  </span>
                </div>
                <SegmentedControl options={languages} value={locale} onChange={setLocale} />
              </div>
            </div>
          </section>

          <section className="space-y-3 opacity-80">
            <div className="flex items-center gap-2">
              <span className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-[var(--bg-main)]">
                INFO
              </span>
              <h3 className="text-xs font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('settings.system_info')}
              </h3>
            </div>

            <div className="card-swiss bg-[var(--bg-surface)] !p-5">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {t('settings.architecture')}
                  </div>
                  <div className="text-[10px] font-black uppercase italic text-[var(--text-primary)]">
                    WAILS_V2 / REACT_CORE
                  </div>
                </div>
                <div className="space-y-1 border-l border-[var(--border-color)]/20 pl-8 text-right">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {t('settings.status')}
                  </div>
                  <div className="text-[10px] font-black uppercase italic text-green-600">STABLE_READY</div>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t border-dashed border-[var(--border-color)] pt-5">
                <div className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Dev_Helper / {t('settings.source_mapping')}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[8px]">
                  {[
                    ['MAIN_FRAME', 'src/App.jsx'],
                    ['PAGE_ACCOUNTS', 'src/pages/AccountsPage.jsx'],
                    ['PAGE_STATUS', 'src/pages/StatusPage.jsx'],
                    ['UI_SEGMENT', 'src/components/ui/SegmentedControl.jsx'],
                  ].map(([id, path]) => (
                    <div
                      key={id}
                      className="flex justify-between border-b border-[var(--border-color)]/10 pb-0.5"
                    >
                      <span className="text-[var(--text-muted)]">{id}</span>
                      <span className="font-bold text-[var(--text-primary)]">{path}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
