import { useI18n } from '../../../context/I18nContext';

interface DebugEntryCardProps {
  entry: {
    id: string;
    name: string;
    transport: string;
    status: string;
    startedAt: string;
    durationMs?: number;
    isExpanded: boolean;
    requestText: string | null;
    responseText: string | null;
  };
  isSelected: boolean;
  onToggleEntry: (id: string) => void;
  onToggleExpanded: (id: string) => void;
}

export default function DebugEntryCard({
  entry,
  isSelected,
  onToggleEntry,
  onToggleExpanded,
}: DebugEntryCardProps) {
  const { t } = useI18n();

  return (
    <section
      className={`card-swiss flex max-h-[600px] flex-col !p-0 overflow-hidden ${
        isSelected ? 'ring-2 ring-[var(--accent-red)]' : ''
      }`}
    >
      <div className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
        <div className="flex items-start gap-4">
          <label className="mt-1 flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleEntry(entry.id)}
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
        <div className="flex items-center gap-4">
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
          <button onClick={() => onToggleExpanded(entry.id)} className="btn-swiss">
            {entry.isExpanded ? t('debug.collapse') : t('debug.expand')}
          </button>
        </div>
      </div>

      {entry.isExpanded ? (
        <div className="grid flex-grow grid-cols-1 overflow-y-auto gap-0 md:grid-cols-2">
          <div className="border-b-2 border-[var(--border-color)] p-5 md:border-b-0 md:border-r-2">
            <div className="mb-3 text-[0.5625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {t('debug.request')}
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[0.625rem] leading-relaxed text-[var(--text-primary)]">
              {entry.requestText}
            </pre>
          </div>
          <div className="p-5">
            <div className="mb-3 text-[0.5625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {entry.status === 'error' ? t('debug.response_error') : t('debug.response')}
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[0.625rem] leading-relaxed text-[var(--text-primary)]">
              {entry.responseText}
            </pre>
          </div>
        </div>
      ) : (
        <div className="px-6 py-4 text-[0.5625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
          {t('debug.collapsed_hint')}
        </div>
      )}
    </section>
  );
}
