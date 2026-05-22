import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionStatus,
} from '../model/types';
import {
  formatDuration,
  statusDotClass,
  statusLabelKeys,
} from './formatters';
import type { Translate } from './types';

export function SessionFeed({
  sessions,
  selectedSessionID,
  onSelectSession,
  t,
}: {
  sessions: readonly CodexLiveSession[];
  selectedSessionID?: string;
  onSelectSession: (sessionID: string) => void;
  t: Translate;
}) {
  return (
    <div className="min-h-0 min-w-0 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
      <div
        data-debug={undefined}
        className="grid gap-1 border-b-2 border-[var(--border-color)] px-4 py-3 md:grid-cols-[1fr_auto] md:items-end"
      >
        <div>
          <h3 className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em]">
            {t('codex_live_sessions.session_feed')}
          </h3>
          <p className="mt-1 text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
            {t('codex_live_sessions.session_feed_hint')}
          </p>
        </div>
        <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          {sessions.length} {t('codex_live_sessions.rows')}
        </span>
      </div>

      <div>
        {sessions.length === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed border-[var(--border-color)] p-5 text-center font-bold text-[var(--text-muted)]">
              {t('codex_live_sessions.empty')}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)]">
            {sessions.map((session) => {
              const request = getPrimarySessionRequest(session);
              const selected = session.sessionID === selectedSessionID;
              return (
                <SessionRow
                  key={session.sessionID}
                  session={session}
                  request={request}
                  selected={selected}
                  onSelect={() => onSelectSession(session.sessionID)}
                  t={t}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function getPrimarySessionRequest(session: CodexLiveSession): CodexLiveRequest | undefined {
  return session.requests.find((request) => request.requestID === session.activeRequestID) ?? session.requests[0];
}

function SessionRow({
  session,
  request,
  selected,
  onSelect,
  t,
}: {
  session: CodexLiveSession;
  request?: CodexLiveRequest;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={`grid w-full grid-cols-[1fr_auto] items-start gap-x-4 px-4 py-3 text-left transition-colors active:scale-[0.99] ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--border-color)_10%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black leading-snug text-[var(--text-primary)]">
            {request?.model || session.model}
          </span>
          <RowStatusTag status={session.status} fallbackInferred={session.fallbackInferred} t={t} />
        </div>
        <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-bold leading-snug text-[var(--text-muted)]">
          {request?.authLabel || session.authLabel || request?.authID || session.authID || t('codex_live_sessions.unknown_auth')}
        </div>
      </div>

      <div className="text-right font-mono text-[length:var(--font-size-ui-sm)] font-black leading-snug text-[var(--text-primary)]">
        {formatDuration(session.durationMs)}
      </div>
    </button>
  );
}

function RowStatusTag({
  status,
  fallbackInferred,
  t,
}: {
  status: CodexLiveSessionStatus;
  fallbackInferred?: boolean;
  t: Translate;
}) {
  const toneBg =
    status === 'failed' || status === 'cancelled'
      ? 'bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]'
      : status === 'degraded_http' || status === 'reconnecting' || status === 'upstream_disconnected'
        ? 'bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)]'
        : status === 'active' || status === 'streaming'
          ? 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]'
          : 'bg-[var(--bg-surface)]';

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 ${toneBg}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(status)}`} />
      <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none text-[var(--text-primary)]">
        {t(statusLabelKeys[status])}
        {fallbackInferred ? ` · ${t('codex_live_sessions.http_inferred')}` : ''}
      </span>
    </span>
  );
}
