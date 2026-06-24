import { Button, Card, Checkbox } from 'antd';
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

  const statusTextClass =
    entry.status === 'success' ? 'text-[var(--gt-status-success)]'
    : entry.status === 'error' ? 'text-[var(--gt-status-danger)]'
    : 'text-[var(--gt-ink-muted)]';

  return (
    <Card
      className="flex max-h-[600px] flex-col overflow-hidden"
      style={isSelected ? { boxShadow: '0 0 0 2px var(--gt-accent-primary)' } : undefined}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-5 py-3"
      >
        <div className="flex items-start gap-3">
          <label className="mt-0.5 flex cursor-pointer items-center">
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleEntry(entry.id)}
              className="h-4 w-4 rounded accent-[var(--gt-accent-primary)]"
            />
          </label>
          <div className="space-y-0.5">
            <div className="font-mono text-xs text-[var(--gt-ink-muted)]">
              {entry.transport} · {entry.startedAt}
            </div>
            <div className="text-sm font-semibold text-[var(--gt-ink-primary)]">
              {entry.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-xs">
            <div className={`font-semibold ${statusTextClass}`}>{entry.status}</div>
            <div className="mt-0.5 text-[var(--gt-ink-muted)]">{entry.durationMs ?? 0}ms</div>
          </div>
          <Button
            size="small"
            onClick={() => onToggleExpanded(entry.id)}
          >
            {entry.isExpanded ? t('debug.collapse') : t('debug.expand')}
          </Button>
        </div>
      </div>

      {/* Body */}
      {entry.isExpanded ? (
        <div className="grid flex-grow grid-cols-1 overflow-y-auto md:grid-cols-2">
          <div className="border-b border-[var(--gt-border-subtle)] p-4 md:border-b-0 md:border-r">
            <div className="mb-2 text-xs font-semibold text-[var(--gt-ink-muted)]">
              {t('debug.request')}
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-[var(--gt-ink-primary)]">
              {entry.requestText}
            </pre>
          </div>
          <div className="p-4">
            <div className="mb-2 text-xs font-semibold text-[var(--gt-ink-muted)]">
              {entry.status === 'error' ? t('debug.response_error') : t('debug.response')}
            </div>
            <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-[var(--gt-ink-primary)]">
              {entry.responseText}
            </pre>
          </div>
        </div>
      ) : (
        <div className="px-5 py-3 text-xs text-[var(--gt-ink-muted)]">
          {t('debug.collapsed_hint')}
        </div>
      )}
    </Card>
  );
}
