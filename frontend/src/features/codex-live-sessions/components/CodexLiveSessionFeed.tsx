import { useEffect, useRef, useState } from 'react';
import { ClipboardSetText } from '../../../../wailsjs/runtime/runtime';
import type {
  CodexLiveProjectSummary,
  CodexLiveRequest,
  CodexLiveSession,
} from '../model/types';
import {
  buildCodexLiveRequestFeedRows,
  buildSessionRowSummary,
} from './formatters';
import { getPrimaryCodexLiveRequest } from '../model/selectors';
import { copyCodexLiveSessionID, SESSION_ID_COPY_RESET_MS } from './sessionClipboard';
import type { Translate } from './types';

export function SessionFeed({
  sessions,
  selectedSessionID,
  title,
  hint,
  onSelectSession,
  onShowOverview,
  t,
}: {
  sessions: readonly CodexLiveSession[];
  selectedSessionID?: string;
  title?: string;
  hint?: string;
  onSelectSession: (sessionID: string) => void;
  onShowOverview: () => void;
  t: Translate;
}) {
  const [copiedSessionID, setCopiedSessionID] = useState<string>();
  const copyResetTimerRef = useRef<number | null>(null);
  const requestRows = buildCodexLiveRequestFeedRows(sessions);

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
    <div className="min-h-0 min-w-0 overflow-hidden border border-[color:color-mix(in_srgb,var(--border-color)_34%,transparent)] bg-[var(--bg-main)] shadow-[0_1px_0_color-mix(in_srgb,var(--border-color)_18%,transparent)]">
      <div
        role="button"
        tabIndex={0}
        data-debug={undefined}
        data-codex-session-feed-overview-trigger="true"
        aria-pressed={!selectedSessionID}
        onClick={onShowOverview}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onShowOverview();
          }
        }}
        className={`grid w-full cursor-pointer gap-1 border-b border-[color:color-mix(in_srgb,var(--border-color)_24%,transparent)] px-4 py-3 text-left transition-colors md:grid-cols-[1fr_auto] md:items-end ${
          !selectedSessionID ? 'codex-live-session-list-item-selected' : 'codex-live-session-list-item-idle'
        }`}
      >
        <div>
          <h3>
            <span className="font-mono text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
              {title ?? t('codex_live_sessions.session_feed')}
            </span>
          </h3>
          <p className="mt-1 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
            {hint ?? t('codex_live_sessions.session_feed_hint')}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-muted)]">
            {sessions.length} {t('codex_live_sessions.session_rows')} · {requestRows.length} {t('codex_live_sessions.request_rows')}
          </span>
        </div>
      </div>

      <div>
        {sessions.length === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed border-[var(--border-color)] p-5 text-center font-bold text-[var(--text-muted)]">
              {t('codex_live_sessions.empty')}
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export function ProjectFeed({
  projects,
  selectedProjectID,
  onSelectProject,
  t,
}: {
  projects: readonly CodexLiveProjectSummary[];
  selectedProjectID?: string;
  onSelectProject: (projectID: string) => void;
  t: Translate;
}) {
  return (
    <div
      className="min-h-0 min-w-0 overflow-hidden border border-[color:color-mix(in_srgb,var(--border-color)_34%,transparent)] bg-[var(--bg-main)] shadow-[0_1px_0_color-mix(in_srgb,var(--border-color)_18%,transparent)]"
      data-codex-live-project-feed="true"
    >
      <div className="grid w-full gap-1 border-b border-[color:color-mix(in_srgb,var(--border-color)_24%,transparent)] px-4 py-3 text-left md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h3>
            <span className="font-mono text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
              {t('codex_live_sessions.project_feed')}
            </span>
          </h3>
          <p className="mt-1 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
            {t('codex_live_sessions.project_feed_hint')}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-muted)]">
            {projects.length} {t('codex_live_sessions.project_rows')}
          </span>
        </div>
      </div>

      <div>
        {projects.length === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed border-[var(--border-color)] p-5 text-center font-bold text-[var(--text-muted)]">
              {t('codex_live_sessions.project_empty')}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[color:color-mix(in_srgb,var(--border-color)_22%,transparent)]">
            {projects.map((project) => (
              <ProjectRow
                key={project.projectID}
                project={project}
                selected={project.projectID === selectedProjectID}
                onSelect={() => onSelectProject(project.projectID)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  selected,
  onSelect,
  t,
}: {
  project: CodexLiveProjectSummary;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  const healthLabel = t(`codex_live_sessions.project_health_${project.health}`);
  const modelLabel = project.lastModel || t('codex_live_sessions.unknown');
  const authLabel = project.lastAuthLabel || t('codex_live_sessions.unknown_auth');

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
      aria-pressed={selected}
      className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors ${
        selected ? 'codex-live-session-list-item-selected' : 'codex-live-session-list-item-idle'
      }`}
      data-codex-live-project-row={project.projectID}
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg)] font-black leading-snug text-[var(--text-primary)]">
        {project.projectName}
      </span>
      <span className="col-start-2 row-start-1 min-w-0 self-center justify-self-end truncate text-right font-mono text-[length:var(--font-size-ui-sm)] font-black leading-snug uppercase text-[var(--text-muted)]">
        {healthLabel}
      </span>
      <span className="col-start-1 row-start-2 min-w-0 self-center truncate font-mono text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--text-muted)]">
        {project.sessionCount} {t('codex_live_sessions.session_rows')} · {project.requestCount} {t('codex_live_sessions.request_rows')} · {modelLabel} / {authLabel}
      </span>
      <span className="col-start-2 row-start-2 min-w-0 self-center justify-self-end truncate text-right font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">
        A {project.activeSessionCount} · D {project.degradedSessionCount} · F {project.failedSessionCount}
      </span>
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
        selected ? 'codex-live-session-list-item-selected' : 'codex-live-session-list-item-idle'
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
