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

export function buildSessionRowSummary(
  session: CodexLiveSession,
  request: CodexLiveRequest | undefined,
  t: Translate,
) {
  const projectName = session.projectName?.trim() || t('codex_live_sessions.unknown_project');
  const auth = request?.authLabel || session.authLabel || request?.authID || session.authID || t('codex_live_sessions.unknown_auth');

  return {
    sessionProjectLabel: `${session.sessionID} / ${projectName}`,
    accountTransportLabel: `${auth} / ${getShortTransportLabel(session)}`,
  };
}

function getShortTransportLabel(session: CodexLiveSession): 'http' | 'ws' | string {
  if (session.fallbackInferred || session.downstreamTransport === 'http' || session.upstreamTransport === 'http') {
    return 'http';
  }
  if (session.downstreamTransport === 'websocket' || session.upstreamTransport === 'websocket') {
    return 'ws';
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
