import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionStatus,
  CodexLiveTimelineEvent,
} from '../model/types';
import type { Translate } from './types';

export const statusLabelKeys: Record<CodexLiveSessionStatus, string> = {
  active: 'codex_live_sessions.status_active',
  streaming: 'codex_live_sessions.status_streaming',
  reconnecting: 'codex_live_sessions.status_reconnecting',
  upstream_disconnected: 'codex_live_sessions.status_upstream_disconnected',
  degraded_http: 'codex_live_sessions.status_degraded_http',
  completed: 'codex_live_sessions.status_completed',
  failed: 'codex_live_sessions.status_failed',
  cancelled: 'codex_live_sessions.status_cancelled',
};

export function getConnectionLabel(session: CodexLiveSession, t: Translate): string {
  if (session.fallbackInferred || (session.downstreamTransport === 'websocket' && session.upstreamTransport === 'http')) {
    return t('codex_live_sessions.connection_ws_to_http');
  }
  if (session.downstreamTransport === 'websocket' || session.upstreamTransport === 'websocket') {
    return t('codex_live_sessions.connection_websocket');
  }
  if (session.downstreamTransport === 'http' || session.upstreamTransport === 'http') {
    return t('codex_live_sessions.connection_http');
  }
  return t('codex_live_sessions.connection_unknown');
}


export interface CodexLiveRequestFeedRow {
  rowID: string;
  session: CodexLiveSession;
  request?: CodexLiveRequest;
  requestID: string;
  sequence: number;
  model: string;
  status: CodexLiveSessionStatus;
  startedAt: string;
}

export function buildCodexLiveRequestFeedRows(sessions: readonly CodexLiveSession[]): CodexLiveRequestFeedRow[] {
  return sessions
    .flatMap((session) => {
      if (session.requests.length > 0) {
        return session.requests.map((request) => ({
          rowID: `${session.sessionID}:${request.requestID}`,
          session,
          request,
          requestID: request.requestID,
          sequence: request.sequence,
          model: request.model,
          status: request.status,
          startedAt: request.startedAt,
        }));
      }
      const requestID = session.activeRequestID || session.lastRequestID;
      if (!requestID) {
        return [];
      }
      return [
        {
          rowID: `${session.sessionID}:${requestID}`,
          session,
          requestID,
          sequence: session.requestCount,
          model: session.model,
          status: session.status,
          startedAt: session.lastEventAt || session.startedAt,
        },
      ];
    })
    .sort((left, right) => {
      const rightTime = Date.parse(right.startedAt);
      const leftTime = Date.parse(left.startedAt);
      const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
      const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
      if (safeRight !== safeLeft) {
        return safeRight - safeLeft;
      }
      if (right.sequence !== left.sequence) {
        return right.sequence - left.sequence;
      }
      return left.requestID.localeCompare(right.requestID);
    });
}

export function buildRequestRowSummary(row: CodexLiveRequestFeedRow, t: Translate) {
  const request = row.request;
  const projectName = row.session.projectName?.trim() || t('codex_live_sessions.unknown_project');
  const auth = request?.authLabel || row.session.authLabel || request?.authID || row.session.authID || t('codex_live_sessions.unknown_auth');
  const totalDuration = formatOptionalDuration(request?.timing?.totalDurationMs);
  const ttft = formatOptionalDuration(request?.timing?.firstEventMs);

  return {
    requestLabel: formatRequestShortID(row.requestID),
    projectLabel: projectName,
    accountLabel: auth,
    modelLabel: row.model || t('codex_live_sessions.unknown'),
    statusLabel: t(statusLabelKeys[row.status] || 'codex_live_sessions.unknown'),
    transportLabel: request ? getShortTransportLabel(row.session, request) : getShortTransportLabel(row.session),
    timingLabel: totalDuration === 'n/a' && ttft === 'n/a' ? t('codex_live_sessions.no_timing_data') : `${totalDuration} / ${ttft}`,
    sequenceLabel: row.sequence > 0 ? `#${row.sequence}` : '-',
  };
}

function formatRequestShortID(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '-';
  }
  const reqMatch = trimmed.match(/(?:^|[-_])req[-_]([a-z0-9]+)$/i);
  if (reqMatch) {
    return `REQ-${reqMatch[1].toUpperCase()}`;
  }
  if (trimmed.length <= 16) {
    return trimmed;
  }
  return `${trimmed.slice(0, 7)}...${trimmed.slice(-5)}`;
}

export function buildSessionRowSummary(
  session: CodexLiveSession,
  request: CodexLiveRequest | undefined,
  t: Translate,
) {
  const projectName = session.projectName?.trim() || t('codex_live_sessions.unknown_project');
  const auth = request?.authLabel || session.authLabel || request?.authID || session.authID || t('codex_live_sessions.unknown_auth');

  return {
    sessionProjectLabel: projectName,
    accountLabel: auth,
    transportLabel: getShortTransportLabel(session, request),
    sessionIDLabel: session.sessionID,
  };
}

function getShortTransportLabel(session: CodexLiveSession, request?: CodexLiveRequest): 'http' | 'ws' | string {
  if (request) {
    return shortTransportFromPair(request.downstreamTransport, request.upstreamTransport);
  }
  return shortTransportFromPair(session.downstreamTransport, session.upstreamTransport, session.fallbackInferred);
}

function shortTransportFromPair(downstream: string, upstream: string, fallbackInferred = false): 'http' | 'ws' | string {
  if (upstream === 'websocket') {
    return 'ws';
  }
  if (upstream === 'http') {
    return 'http';
  }
  if (downstream === 'websocket') {
    return 'ws';
  }
  if (downstream === 'http') {
    return 'http';
  }
  if (fallbackInferred) {
    return 'http';
  }
  return 'unknown';
}

export function statusDotClass(status: CodexLiveSessionStatus): string {
  if (status === 'failed' || status === 'cancelled') {
    return 'bg-[var(--color-danger)]';
  }
  if (status === 'degraded_http' || status === 'reconnecting' || status === 'upstream_disconnected') {
    return 'bg-[var(--color-warning)]';
  }
  if (status === 'active' || status === 'streaming') {
    return 'bg-[var(--color-success)]';
  }
  return 'bg-[var(--text-muted)]';
}

export function severityDotClass(severity: CodexLiveTimelineEvent['severity']): string {
  if (severity === 'error') {
    return 'bg-[var(--color-danger)]';
  }
  if (severity === 'warning') {
    return 'bg-[var(--color-warning)]';
  }
  if (severity === 'success') {
    return 'bg-[var(--color-success)]';
  }
  return 'bg-[var(--text-muted)]';
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const preciseSeconds = ms / 1000;
  if (preciseSeconds < 10) {
    return `${preciseSeconds.toFixed(1)}s`;
  }
  const seconds = Math.round(preciseSeconds);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatOptionalDuration(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return 'n/a';
  }
  return formatDuration(ms);
}

export function formatOptionalRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  return `${Math.round(value)}/s`;
}
