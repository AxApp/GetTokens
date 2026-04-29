import { useEffect, useMemo, useState } from 'react';
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
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  const sortedEntries = useMemo(() => entries, [entries]);
  const selectedEntries = useMemo(
    () => sortedEntries.filter((entry) => selectedIDs.includes(entry.id)),
    [selectedIDs, sortedEntries]
  );
  const allSelected = sortedEntries.length > 0 && selectedIDs.length === sortedEntries.length;

  useEffect(() => {
    setSelectedIDs((prev) => prev.filter((id) => sortedEntries.some((entry) => entry.id === id)));
  }, [sortedEntries]);

  useEffect(() => {
    if (copyState === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => setCopyState('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  function toggleEntry(id: string) {
    setSelectedIDs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIDs(allSelected ? [] : sortedEntries.map((entry) => entry.id));
  }

  async function copySelectedEntries() {
    if (selectedEntries.length === 0) {
      return;
    }

    const payload = selectedEntries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      transport: entry.transport,
      status: entry.status,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationMs: entry.durationMs,
      request: entry.request,
      response: entry.response,
      error: entry.error,
    }));

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_DEBUG">
      <div className="mx-auto max-w-6xl space-y-8 pb-24">
        <header className="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {t('debug.title')}
            </h2>
            <p className="mt-1 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {t('debug.subtitle')} / {sortedEntries.length} UNITS
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="btn-swiss" disabled={sortedEntries.length === 0}>
              {allSelected ? t('debug.unselect_all') : t('debug.select_all')}
            </button>
            <button onClick={() => setSelectedIDs([])} className="btn-swiss" disabled={selectedIDs.length === 0}>
              {t('debug.clear_selection')}
            </button>
            <button onClick={copySelectedEntries} className="btn-swiss" disabled={selectedEntries.length === 0}>
              {copyState === 'success'
                ? t('debug.copy_success')
                : copyState === 'error'
                  ? t('debug.copy_error')
                  : `${t('debug.copy_selected')} (${selectedEntries.length})`}
            </button>
            <button onClick={clearEntries} className="btn-swiss" disabled={sortedEntries.length === 0}>
              {t('debug.clear')}
            </button>
          </div>
        </header>

        {sortedEntries.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
            {t('debug.empty')}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedEntries.map((entry) => (
              <section
                key={entry.id}
                className={`card-swiss flex max-h-[600px] flex-col !p-0 overflow-hidden ${selectedIDs.includes(entry.id) ? 'ring-2 ring-[var(--accent-red)]' : ''}`}
              >
                <div className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
                  <div className="flex items-start gap-4">
                    <label className="mt-1 flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={selectedIDs.includes(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                        className="h-4 w-4 accent-[var(--accent-red)]"
                      />
                    </label>
                    <div className="space-y-1">
                      <div className="text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        {entry.transport} / {entry.startedAt}
                      </div>
                      <div className="text-sm font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                        {entry.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[0.5625rem] font-black uppercase tracking-widest">
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

                <div className="grid flex-grow grid-cols-1 overflow-y-auto gap-0 md:grid-cols-2">
                  <div className="border-b-2 border-[var(--border-color)] p-5 md:border-b-0 md:border-r-2">
                    <div className="mb-3 text-[0.5625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      {t('debug.request')}
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[0.625rem] leading-relaxed text-[var(--text-primary)]">
                      {formatPayload(entry.request)}
                    </pre>
                  </div>
                  <div className="p-5">
                    <div className="mb-3 text-[0.5625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      {entry.status === 'error' ? t('debug.response_error') : t('debug.response')}
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[0.625rem] leading-relaxed text-[var(--text-primary)]">
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
