import type { CodexLiveSessionSnapshot } from '../model/types';
import type { Translate } from './types';

export function SourceBadge({ snapshot }: { snapshot: CodexLiveSessionSnapshot }) {
  const label = snapshot.source === 'unavailable' ? 'UNAVAILABLE' : snapshot.sidecarReady ? snapshot.source.toUpperCase() : 'CACHE';
  return (
    <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase shadow-[3px_3px_0_var(--shadow-color)]">
      {label}
    </span>
  );
}

export function SummaryStrip({ snapshot, t }: { snapshot: CodexLiveSessionSnapshot; t: Translate }) {
  const items = [
    [t('codex_live_sessions.summary_active'), snapshot.summary.activeSessions],
    [t('codex_live_sessions.summary_requests'), snapshot.summary.activeRequests],
    [t('codex_live_sessions.summary_ws'), snapshot.summary.websocketSessions],
    [t('codex_live_sessions.summary_http'), snapshot.summary.httpSessions],
    [t('codex_live_sessions.summary_degraded'), snapshot.summary.degradedSessions],
    [t('codex_live_sessions.summary_failed'), snapshot.summary.errorSessions],
  ];

  return (
    <div data-debug={undefined} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="min-h-[86px] border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[4px_4px_0_var(--shadow-color)]"
        >
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {label}
          </div>
          <div className="mt-2 font-mono text-[length:var(--font-size-ui-6xl)] font-black tracking-normal text-[var(--text-primary)]">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
