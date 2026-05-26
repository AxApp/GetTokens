import { Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ClipboardSetText } from '../../../../wailsjs/runtime/runtime';
import type {
  CodexLiveRequest,
  CodexLiveSession,
} from '../model/types';
import {
  buildSessionRowSummary,
} from './formatters';
import { getPrimaryCodexLiveRequest } from '../model/selectors';
import { copyCodexLiveSessionID, SESSION_ID_COPY_RESET_MS } from './sessionClipboard';
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
  const [copiedSessionID, setCopiedSessionID] = useState<string>();
  const copyResetTimerRef = useRef<number | null>(null);

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
    <div className="min-h-0 min-w-0 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
      <div
        data-debug={undefined}
        className="grid gap-1 border-b-2 border-[var(--border-color)] px-4 py-3 md:grid-cols-[1fr_auto] md:items-end"
      >
        <div>
          <h3 className="font-mono text-[length:var(--font-size-ui-3xl)] font-black uppercase tracking-[0.16em]">
            {t('codex_live_sessions.session_feed')}
          </h3>
          <p className="mt-1 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
            {t('codex_live_sessions.session_feed_hint')}
          </p>
        </div>
        <span className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-muted)]">
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
        )}
      </div>
    </div>
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
      className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(0,45%)] items-end gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--border-color)_10%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className="col-span-2 min-w-0 text-left transition-transform active:scale-[0.99]"
      >
        <span className="block truncate font-mono text-[length:var(--font-size-ui-2xl)] font-black leading-snug text-[var(--text-primary)]">
          {summary.sessionProjectLabel}
        </span>
      </button>
      <button
        type="button"
        onClick={onSelect}
        tabIndex={-1}
        className="min-w-0 truncate text-left font-mono text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--text-muted)] transition-transform active:scale-[0.99]"
      >
        {summary.accountTransportLabel}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCopySessionID(session.sessionID);
        }}
        aria-label={`${t('codex_live_sessions.copy_session_id')} ${summary.sessionIDLabel}`}
        title={copied ? t('codex_live_sessions.copied') : t('codex_live_sessions.copy_session_id')}
        aria-live="polite"
        className={`flex min-w-0 items-center justify-end gap-1 truncate text-right font-mono text-[length:var(--font-size-ui-sm)] font-bold leading-snug transition-colors active:scale-[0.98] ${
          copied
            ? 'text-[var(--color-status-success)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {copied ? (
          <>
            <span className="truncate">{t('codex_live_sessions.copied')}</span>
            <span aria-hidden="true" className="text-[var(--color-status-success)]">
              ✓
            </span>
          </>
        ) : (
          <>
            <span className="truncate">{summary.sessionIDLabel}</span>
            <Copy className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          </>
        )}
      </button>
    </div>
  );
}
