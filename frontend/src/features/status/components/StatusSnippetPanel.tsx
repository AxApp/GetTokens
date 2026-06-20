import type { ReactNode } from 'react';
import SnippetPre from '../../../components/ui/SnippetPre';
import { resolveUnifiedDiffLineTone } from '../model/relayLocalState';

interface StatusSnippetPanelProps {
  title: string;
  content: string;
  onCopy?: () => void;
  headerAction?: ReactNode;
  preClassName?: string;
}

export default function StatusSnippetPanel({
  title,
  content,
  onCopy,
  headerAction,
  preClassName = '',
}: StatusSnippetPanelProps) {
  const lines = content.split('\n');

  function lineClassName(line: string) {
    const tone = resolveUnifiedDiffLineTone(line);
    switch (tone) {
      case 'add':
        return 'border-l-4 border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] pl-2 text-[var(--gt-status-success)]';
      case 'remove':
        return 'border-l-4 border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] pl-2 text-[var(--gt-status-danger)]';
      case 'hunk':
        return 'text-[var(--gt-ink-muted)]';
      case 'file':
        return 'font-semibold text-[var(--gt-ink-primary)]';
      case 'meta':
        return 'text-[var(--gt-ink-muted)]';
      default:
        return 'text-[var(--gt-ink-primary)]';
    }
  }

  return (
    <div className="min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--gt-border-subtle)] px-1 pb-2">
        <div className="font-mono text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--gt-ink-primary)]">
          {title}
        </div>
        {onCopy || headerAction ? (
          <div className="flex items-center gap-2">
            {onCopy ? (
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
              >
                复制
              </button>
            ) : null}
            {headerAction}
          </div>
        ) : null}
      </div>
      <SnippetPre className={preClassName}>
        {lines.map((line, index) => (
          <code key={`${index}-${line}`} className={`block min-h-6 whitespace-pre ${lineClassName(line)}`}>
            {line || ' '}
          </code>
        ))}
      </SnippetPre>
    </div>
  );
}
