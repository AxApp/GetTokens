import { Button, Card } from 'antd';
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

  const statusColor =
    entry.status === 'success' ? 'var(--gt-status-success)'
    : entry.status === 'error' ? 'var(--gt-status-danger)'
    : 'var(--gt-ink-muted)';

  return (
    <Card
      className="flex max-h-[600px] flex-col overflow-hidden"
      style={isSelected ? { boxShadow: '0 0 0 2px var(--gt-accent-primary)' } : undefined}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b px-5 py-3"
        style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)' }}
      >
        <div className="flex items-start gap-3">
          <label className="mt-0.5 flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleEntry(entry.id)}
              className="h-4 w-4 rounded accent-[var(--gt-accent-primary)]"
            />
          </label>
          <div className="space-y-0.5">
            <div
              className="text-xs"
              style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}
            >
              {entry.transport} · {entry.startedAt}
            </div>
            <div
              className="text-sm font-semibold"
              style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-sans)' }}
            >
              {entry.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs" style={{ fontFamily: 'var(--gt-font-family-mono)' }}>
            <div style={{ color: statusColor, fontWeight: 600 }}>{entry.status}</div>
            <div className="mt-0.5" style={{ color: 'var(--gt-ink-muted)' }}>{entry.durationMs ?? 0}ms</div>
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
          <div
            className="border-b p-4 md:border-b-0 md:border-r"
            style={{ borderColor: 'var(--gt-border-subtle)' }}
          >
            <div
              className="mb-2 text-xs font-semibold"
              style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}
            >
              {t('debug.request')}
            </div>
            <pre
              className="overflow-auto whitespace-pre-wrap break-all text-sm leading-relaxed"
              style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-mono)' }}
            >
              {entry.requestText}
            </pre>
          </div>
          <div className="p-4">
            <div
              className="mb-2 text-xs font-semibold"
              style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}
            >
              {entry.status === 'error' ? t('debug.response_error') : t('debug.response')}
            </div>
            <pre
              className="overflow-auto whitespace-pre-wrap break-all text-sm leading-relaxed"
              style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-mono)' }}
            >
              {entry.responseText}
            </pre>
          </div>
        </div>
      ) : (
        <div
          className="px-5 py-3 text-xs"
          style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}
        >
          {t('debug.collapsed_hint')}
        </div>
      )}
    </Card>
  );
}
