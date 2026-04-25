import { useMemo } from 'react';
import { useDebug } from '../context/DebugContext';
import { useI18n } from '../context/I18nContext';

function formatPayload(value: unknown) {
  if (value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function DebugPage() {
  const { t } = useI18n();
  const { entries, clearEntries } = useDebug();

  const sortedEntries = useMemo(() => entries, [entries]);

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_DEBUG">
      <div className="mx-auto max-w-6xl space-y-8 pb-24">
        <header className="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {t('debug.title')}
            </h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {t('debug.subtitle')} / {sortedEntries.length} TOTAL
            </p>
          </div>
          <button onClick={clearEntries} className="btn-swiss" disabled={sortedEntries.length === 0}>
            {t('debug.clear')}
          </button>
        </header>

        {sortedEntries.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
            {t('debug.empty')}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedEntries.map((entry) => (
              <section key={entry.id} className="card-swiss !p-0 overflow-hidden">
                <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
                  <div className="space-y-1">
                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      {entry.transport} / {entry.startedAt}
                    </div>
                    <div className="text-sm font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                      {entry.name}
                    </div>
                  </div>
                  <div className="text-right text-[9px] font-black uppercase tracking-widest">
                    <div
                      className={
                        entry.status === 'success'
                          ? 'text-green-600'
                          : entry.status === 'error'
                            ? 'text-red-500'
                            : 'text-[var(--text-muted)]'
                      }
                    >
                      {entry.status}
                    </div>
                    <div className="mt-1 text-[var(--text-muted)]">{entry.durationMs ?? 0} MS</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                  <div className="border-b-2 border-[var(--border-color)] p-5 md:border-b-0 md:border-r-2">
                    <div className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      {t('debug.request')}
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-[var(--text-primary)]">
                      {formatPayload(entry.request)}
                    </pre>
                  </div>
                  <div className="p-5">
                    <div className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      {entry.status === 'error' ? t('debug.response_error') : t('debug.response')}
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-[var(--text-primary)]">
                      {entry.status === 'error' ? formatPayload(entry.error) : formatPayload(entry.response)}
                    </pre>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
