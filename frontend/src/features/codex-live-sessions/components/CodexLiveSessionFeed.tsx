import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionStatus,
} from '../model/types';
import {
  formatDuration,
  formatOptionalDuration,
  formatOptionalRate,
  getConnectionLabel,
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
  const timing = request?.timing;
  const connectionLabel = getConnectionLabel(session, t);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={`grid w-full gap-3 px-4 py-4 text-left transition-colors active:scale-[0.99] ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--border-color)_10%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_status')}
        </span>
        <RowStatus status={session.status} fallbackInferred={session.fallbackInferred} t={t} />
      </div>

      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_model_account')}
        </span>
        <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
          {request?.model || session.model}
        </div>
        <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
          {request?.authLabel || session.authLabel || request?.authID || session.authID || t('codex_live_sessions.unknown_auth')}
        </div>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_connection')}
        </span>
        <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
          {connectionLabel}
        </div>
        <div className="mt-1 truncate text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
          {session.fallbackInferred ? t('codex_live_sessions.connection_degraded_hint') : t('codex_live_sessions.connection_normal_hint')}
        </div>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_speed')}
        </span>
        <div className="grid gap-1 font-mono text-[length:var(--font-size-ui-xs)] uppercase">
          <MetricText label={t('codex_live_sessions.metric_output_rate')} value={formatOptionalRate(timing?.outputTokensPerSecond)} />
          <MetricText label={t('codex_live_sessions.metric_first_token')} value={formatOptionalDuration(timing?.firstTokenMs)} />
          <MetricText label={t('codex_live_sessions.metric_running_for')} value={formatDuration(session.durationMs)} />
        </div>
      </div>

      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
        {selected ? t('codex_live_sessions.collapse') : t('codex_live_sessions.expand')}
      </div>
    </button>
  );
}

function RowStatus({
  status,
  fallbackInferred,
  t,
}: {
  status: CodexLiveSessionStatus;
  fallbackInferred?: boolean;
  t: Translate;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 ${statusDotClass(status)}`} />
      <div className="min-w-0">
        <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]">
          {t(statusLabelKeys[status])}
        </div>
        {fallbackInferred ? (
          <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-warning)]">
            {t('codex_live_sessions.http_inferred')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 truncate text-[var(--text-muted)]">
      {label} <b className="text-[var(--text-primary)]">{value}</b>
    </span>
  );
}
