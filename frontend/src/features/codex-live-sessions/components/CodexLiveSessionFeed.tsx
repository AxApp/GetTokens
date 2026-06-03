import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ClipboardSetText } from '../../../../wailsjs/runtime/runtime';
import type {
  CodexLiveRequest,
  CodexLiveSession,
} from '../model/types';
import {
  buildCodexLiveRequestFeedRows,
  buildRequestRowSummary,
  buildSessionRowSummary,
  statusDotClass,
} from './formatters';
import { getPrimaryCodexLiveRequest } from '../model/selectors';
import { copyCodexLiveSessionID, SESSION_ID_COPY_RESET_MS } from './sessionClipboard';
import type { Translate } from './types';

export function SessionFeed({
  sessions,
  selectedSessionID,
  onSelectSession,
  onClearSessions,
  t,
}: {
  sessions: readonly CodexLiveSession[];
  selectedSessionID?: string;
  onSelectSession: (sessionID: string) => void;
  onClearSessions?: () => void;
  t: Translate;
}) {
  const [copiedSessionID, setCopiedSessionID] = useState<string>();
  const [feedMode, setFeedMode] = useState<'sessions' | 'requests'>('sessions');
  const copyResetTimerRef = useRef<number | null>(null);
  const requestRows = buildCodexLiveRequestFeedRows(sessions);
  const visibleCount = feedMode === 'sessions' ? sessions.length : requestRows.length;

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  async function copySessionID(sessionID: string) {
    setCopiedSessionID(sessionID);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopiedSessionID(undefined);
      copyResetTimerRef.current = null;
    }, SESSION_ID_COPY_RESET_MS);

    try {
      const copied = await copyCodexLiveSessionID(sessionID, {
        writeText: writeClipboardText,
      });
      if (!copied) {
        throw new Error('Clipboard copy returned false.');
      }
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="min-h-0 min-w-0 overflow-hidden border border-[color:color-mix(in_srgb,var(--border-color)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--bg-main)_78%,var(--bg-surface))] shadow-[0_1px_0_color-mix(in_srgb,var(--border-color)_18%,transparent)]">
      <div
        data-debug={undefined}
        className="grid gap-1 border-b border-[color:color-mix(in_srgb,var(--border-color)_24%,transparent)] px-4 py-3 md:grid-cols-[1fr_auto] md:items-end"
      >
        <div>
          <div className="inline-grid overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] sm:grid-cols-2">
            <FeedModeButton active={feedMode === 'sessions'} onClick={() => setFeedMode('sessions')}>
              {t('codex_live_sessions.feed_mode_sessions')}
            </FeedModeButton>
            <FeedModeButton active={feedMode === 'requests'} onClick={() => setFeedMode('requests')} bordered>
              {t('codex_live_sessions.feed_mode_requests')}
            </FeedModeButton>
          </div>
          <p className="mt-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
            {feedMode === 'sessions' ? t('codex_live_sessions.session_feed_hint') : t('codex_live_sessions.request_feed_hint')}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-muted)]">
            {visibleCount} {feedMode === 'sessions' ? t('codex_live_sessions.session_rows') : t('codex_live_sessions.request_rows')}
          </span>
          <button
            type="button"
            className="btn-swiss h-8 !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
            onClick={onClearSessions}
            disabled={!onClearSessions || sessions.length === 0}
            title={t('codex_live_sessions.clear_sessions_title')}
          >
            {t('codex_live_sessions.clear_sessions')}
          </button>
        </div>
      </div>

      <div>
        {visibleCount === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed border-[var(--border-color)] p-5 text-center font-bold text-[var(--text-muted)]">
              {feedMode === 'sessions' ? t('codex_live_sessions.empty') : t('codex_live_sessions.request_feed_empty')}
            </div>
          </div>
        ) : feedMode === 'sessions' ? (
          <div className="divide-y divide-[color:color-mix(in_srgb,var(--border-color)_22%,transparent)]">
            {sessions.map((session) => {
              const request = getPrimaryCodexLiveRequest(session);
              const selected = session.sessionID === selectedSessionID;
              return (
                <SessionRow
                  key={session.sessionID}
                  session={session}
                  request={request}
                  selected={selected}
                  onSelect={() => onSelectSession(session.sessionID)}
                  onCopySessionID={copySessionID}
                  copied={copiedSessionID === session.sessionID}
                  t={t}
                />
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-[color:color-mix(in_srgb,var(--border-color)_22%,transparent)]">
            {requestRows.map((row) => (
              <RequestRow
                key={row.rowID}
                row={row}
                selected={row.session.sessionID === selectedSessionID}
                onSelect={() => onSelectSession(row.session.sessionID)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function FeedModeButton({
  active,
  bordered = false,
  onClick,
  children,
}: {
  active: boolean;
  bordered?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-2 text-left font-mono text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-[0.12em] transition-colors ${bordered ? 'border-t-2 border-[var(--border-color)] sm:border-l-2 sm:border-t-0' : ''} ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

async function writeClipboardText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  try {
    const copied = await ClipboardSetText(value);
    if (copied) {
      return;
    }
  } catch {
    // fall through to DOM copy
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable.');
  }

  let eventHandled = false;
  const handleCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text/plain', value);
    event.preventDefault();
    eventHandled = true;
  };
  document.addEventListener('copy', handleCopy, { once: true });
  const commandSucceeded = document.execCommand('copy');
  document.removeEventListener('copy', handleCopy);
  if (!commandSucceeded || !eventHandled) {
    throw new Error('Clipboard copy failed.');
  }
}


function RequestRow({
  row,
  selected,
  onSelect,
  t,
}: {
  row: ReturnType<typeof buildCodexLiveRequestFeedRows>[number];
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  const summary = buildRequestRowSummary(row, t);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-expanded={selected}
      className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--text-primary)_7%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg)] font-black leading-snug text-[var(--text-primary)]">
        {summary.requestLabel}
      </span>
      <span className="col-start-2 row-start-1 min-w-0 self-center justify-self-end truncate text-right font-mono text-[length:var(--font-size-ui-sm)] font-black leading-snug uppercase text-[var(--text-muted)]">
        {summary.transportLabel}
      </span>
      <span className="col-start-1 row-start-2 min-w-0 self-center truncate font-mono text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--text-muted)]">
        {summary.projectLabel} · {summary.modelLabel}
      </span>
      <span className="col-start-1 row-start-3 min-w-0 self-center truncate font-mono text-[length:var(--font-size-ui-xs)] font-bold leading-snug text-[var(--text-muted)]">
        {summary.accountLabel} · {summary.timingLabel}
      </span>
      <span className="col-start-2 row-span-2 row-start-2 inline-flex items-center justify-end gap-1 justify-self-end text-right font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">
        <span className={`h-2 w-2 rounded-full ${statusDotClass(row.status)}`} />
        {summary.sequenceLabel} · {summary.statusLabel}
      </span>
    </div>
  );
}

function SessionRow({
  session,
  request,
  selected,
  onSelect,
  onCopySessionID,
  copied,
  t,
}: {
  session: CodexLiveSession;
  request?: CodexLiveRequest;
  selected: boolean;
  onSelect: () => void;
  onCopySessionID: (sessionID: string) => void;
  copied: boolean;
  t: Translate;
}) {
  const summary = buildSessionRowSummary(session, request, t);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-expanded={selected}
      className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--text-primary)_7%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg)] font-black leading-snug text-[var(--text-primary)]">
        {summary.sessionProjectLabel}
      </span>
      <span className="col-start-2 row-start-1 min-w-0 self-center justify-self-end truncate text-right font-mono text-[length:var(--font-size-ui-sm)] font-black leading-snug uppercase text-[var(--text-muted)]">
        {summary.transportLabel}
      </span>
      <span className="col-start-1 row-start-2 min-w-0 self-center truncate font-mono text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--text-muted)]">
        {summary.accountLabel}
      </span>
      <div className="col-start-2 row-start-2 flex min-w-0 items-center justify-end justify-self-end text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCopySessionID(session.sessionID);
          }}
          aria-label={`${t('codex_live_sessions.copy_session_id')} ${summary.sessionIDLabel}`}
          title={copied ? t('codex_live_sessions.copied') : `${t('codex_live_sessions.copy_session_id')} ${summary.sessionIDLabel}`}
          aria-live="polite"
          className={`inline-flex h-6 shrink-0 items-center justify-center border border-[color:color-mix(in_srgb,var(--border-color)_38%,transparent)] px-1.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none transition-colors active:scale-[0.98] ${
            copied
              ? 'border-[color:color-mix(in_srgb,var(--color-status-success)_55%,transparent)] text-[var(--color-status-success)]'
              : 'text-[var(--text-muted)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {copied ? t('codex_live_sessions.copied') : t('codex_live_sessions.session_button')}
        </button>
      </div>
    </div>
  );
}
