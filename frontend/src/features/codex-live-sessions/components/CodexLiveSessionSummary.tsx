import type { CodexLiveSessionSnapshot } from '../model/types';

export function SourceBadge({ snapshot }: { snapshot: CodexLiveSessionSnapshot }) {
  const label = snapshot.source === 'unavailable' ? 'UNAVAILABLE' : snapshot.sidecarReady ? snapshot.source.toUpperCase() : 'CACHE';
  return (
    <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase shadow-[3px_3px_0_var(--shadow-color)]">
      {label}
    </span>
  );
}
