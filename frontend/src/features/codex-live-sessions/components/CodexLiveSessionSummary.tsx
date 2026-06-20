import type { CodexLiveSessionSnapshot } from '../model/types';

export function SourceBadge({ snapshot }: { snapshot: CodexLiveSessionSnapshot }) {
  const label = snapshot.source === 'unavailable' ? 'UNAVAILABLE' : snapshot.sidecarReady ? snapshot.source.toUpperCase() : 'CACHE';
  return (
    <span className="inline-flex items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2.5 py-1.5 font-mono text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--gt-ink-muted)]">
      {label}
    </span>
  );
}
