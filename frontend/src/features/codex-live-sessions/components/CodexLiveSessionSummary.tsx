import { Tag } from 'antd';
import type { CodexLiveSessionSnapshot } from '../model/types';

export function SourceBadge({ snapshot }: { snapshot: CodexLiveSessionSnapshot }) {
  const label = snapshot.source === 'unavailable' ? 'UNAVAILABLE' : snapshot.sidecarReady ? snapshot.source.toUpperCase() : 'CACHE';
  return (
    <Tag color="default" className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
      {label}
    </Tag>
  );
}
