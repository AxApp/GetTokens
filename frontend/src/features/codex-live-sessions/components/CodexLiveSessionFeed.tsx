import type {
  CodexLiveRequest,
  CodexLiveSession,
} from '../model/types';
import {
  buildSessionRowSummary,
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
  const summary = buildSessionRowSummary(session, request, t);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={`grid w-full gap-1 px-4 py-3 text-left transition-colors active:scale-[0.99] ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--border-color)_10%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <div className="min-w-0">
        <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black leading-snug text-[var(--text-primary)]">
          {summary.sessionProjectLabel}
        </div>
        <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-bold leading-snug text-[var(--text-muted)]">
          {summary.accountTransportLabel}
        </div>
      </div>
    </button>
  );
}
