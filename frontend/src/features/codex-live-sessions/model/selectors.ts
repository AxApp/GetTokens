import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionFilter,
  CodexLiveSessionSnapshot,
  CodexLiveSessionStatus,
  CodexLiveTimingMetrics,
  CodexLiveTimelineEvent,
  CodexLiveTransportFilter,
} from './types';

const activeStatuses = new Set<CodexLiveSessionStatus>(['active', 'streaming']);
const reconnectingStatuses = new Set<CodexLiveSessionStatus>(['reconnecting', 'upstream_disconnected']);
const failedStatuses = new Set<CodexLiveSessionStatus>(['failed', 'cancelled']);

const statusRank: Record<CodexLiveSessionStatus, number> = {
  active: 0,
  streaming: 1,
  reconnecting: 2,
  upstream_disconnected: 3,
  degraded_http: 4,
  failed: 5,
  cancelled: 6,
  completed: 7,
};

export function filterCodexLiveSessions(input: {
  sessions: readonly CodexLiveSession[];
  query?: string;
  statusFilter?: CodexLiveSessionFilter;
  transportFilter?: CodexLiveTransportFilter;
}): CodexLiveSession[] {
  const query = normalizeSearch(input.query);
  const statusFilter = input.statusFilter ?? 'all';
  const transportFilter = input.transportFilter ?? 'all';

  return input.sessions
    .filter((session) => matchesStatusFilter(session, statusFilter))
    .filter((session) => matchesTransportFilter(session, transportFilter))
    .filter((session) => !query || buildSessionSearchText(session).includes(query))
    .slice()
    .sort(compareCodexLiveSessions);
}

export function compareCodexLiveSessions(a: CodexLiveSession, b: CodexLiveSession): number {
  const rankDelta = statusRank[a.status] - statusRank[b.status];
  if (rankDelta !== 0) {
    return rankDelta;
  }
  return Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt);
}

export function buildCodexLiveSessionSummary(sessions: readonly CodexLiveSession[]) {
  return {
    activeSessions: sessions.filter((session) => activeStatuses.has(session.status)).length,
    activeRequests: sessions.filter((session) => session.activeRequestID).length,
    websocketSessions: sessions.filter(
      (session) => session.downstreamTransport === 'websocket' || session.upstreamTransport === 'websocket',
    ).length,
    httpSessions: sessions.filter(
      (session) => session.downstreamTransport === 'http' || session.upstreamTransport === 'http',
    ).length,
    degradedSessions: sessions.filter((session) => session.status === 'degraded_http' || session.fallbackInferred).length,
    errorSessions: sessions.filter((session) => failedStatuses.has(session.status)).length,
  };
}

export function getSelectedCodexLiveSession(
  sessions: readonly CodexLiveSession[],
  selectedSessionID?: string,
): CodexLiveSession | undefined {
  if (selectedSessionID) {
    const selected = sessions.find((session) => session.sessionID === selectedSessionID);
    if (selected) {
      return selected;
    }
  }
  return filterCodexLiveSessions({ sessions })[0];
}

export function getPrimaryCodexLiveRequest(session: CodexLiveSession): CodexLiveRequest | undefined {
  const activeRequest = session.requests.find((item) => item.requestID === session.activeRequestID);
  if (activeRequest) {
    return activeRequest;
  }

  const lastRequest = session.requests.find((item) => item.requestID === session.lastRequestID);
  if (lastRequest) {
    return lastRequest;
  }

  let newestRequest: CodexLiveRequest | undefined;
  for (const request of session.requests) {
    if (!newestRequest) {
      newestRequest = request;
      continue;
    }

    if (request.sequence > newestRequest.sequence) {
      newestRequest = request;
      continue;
    }

    if (request.sequence === newestRequest.sequence && Date.parse(request.startedAt) > Date.parse(newestRequest.startedAt)) {
      newestRequest = request;
    }
  }

  return newestRequest;
}

export function buildCodexLiveDiagnosticSummary(session: CodexLiveSession, request?: CodexLiveRequest): string {
  const selectedRequest = request ?? getPrimaryCodexLiveRequest(session);
  const redactedCount = selectedRequest?.error ? 5 : 4;
  const timeline = (selectedRequest?.timeline ?? session.recentEvents)
    .slice(0, 8)
    .map((event) => `- ${event.at} ${event.lane}.${event.kind}: ${sanitizeDiagnosticText(event.label)}`)
    .join('\n');

  return [
    'Codex live session diagnostic',
    `session_id: ${session.sessionID}`,
    `execution_session_id: ${session.executionSessionID || 'unknown'}`,
    `codex_window_id: ${session.codexWindowID || 'unknown'}`,
    `request_id: ${selectedRequest?.requestID || session.lastRequestID || 'unknown'}`,
    `client_request_id: ${selectedRequest?.clientRequestID || 'unknown'}`,
    `upstream_request_id: ${selectedRequest?.upstreamRequestID || 'unknown'}`,
    `model: ${selectedRequest?.model || session.model}`,
    `auth: ${selectedRequest?.authID || session.authID || 'unknown'} / ${selectedRequest?.authLabel || session.authLabel || 'unknown'}`,
    `transport: downstream=${session.downstreamTransport} upstream=${session.upstreamTransport}`,
    `status: ${session.status}`,
    `fallback_inferred: ${session.fallbackInferred ? `true (${session.fallbackConfidence || 'unknown'})` : 'false'}`,
    `fallback_reason: ${session.fallbackReason || 'none'}`,
    selectedRequest?.usage ? `usage: total=${selectedRequest.usage.totalTokens} input=${selectedRequest.usage.inputTokens} output=${selectedRequest.usage.outputTokens}` : 'usage: unavailable',
    selectedRequest?.timing ? `timing: ${formatCodexLiveTimingLine(selectedRequest.timing)}` : 'timing: unavailable',
    selectedRequest?.error ? `error: ${selectedRequest.error.statusCode || 0} ${selectedRequest.error.code || 'unknown'} ${sanitizeDiagnosticText(selectedRequest.error.message)}` : 'error: none',
    `redacted_fields: ${redactedCount}`,
    'timeline:',
    timeline || '- no timeline events',
  ].join('\n');
}

export function formatCodexLiveTimingLine(timing: CodexLiveTimingMetrics): string {
  return [
    `total=${formatMetricMs(timing.totalDurationMs)}`,
    `ttft=${formatMetricMs(timing.firstEventMs)}`,
    `first_token=${formatMetricMs(timing.firstTokenMs)}`,
    `stream=${formatMetricMs(timing.streamDurationMs)}`,
    `queue=${formatMetricMs(timing.queueWaitMs)}`,
    `auth=${formatMetricMs(timing.authSelectMs)}`,
    `connect=${formatMetricMs(timing.upstreamConnectMs)}`,
    `avg_gap=${formatMetricMs(timing.averageEventGapMs)}`,
    `max_gap=${formatMetricMs(timing.longestEventGapMs)}`,
    `reconnects=${timing.reconnectCount ?? 0}`,
    `output_rate=${formatMetricRate(timing.outputTokensPerSecond)}`,
    `total_rate=${formatMetricRate(timing.totalTokensPerSecond)}`,
  ].join(' ');
}

export function snapshotWithDerivedSummary(snapshot: CodexLiveSessionSnapshot): CodexLiveSessionSnapshot {
  return {
    ...snapshot,
    summary: buildCodexLiveSessionSummary(snapshot.sessions),
  };
}

function matchesStatusFilter(session: CodexLiveSession, filter: CodexLiveSessionFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'active') {
    return activeStatuses.has(session.status);
  }
  if (filter === 'reconnecting') {
    return reconnectingStatuses.has(session.status);
  }
  if (filter === 'failed') {
    return failedStatuses.has(session.status);
  }
  return session.status === filter;
}

function matchesTransportFilter(session: CodexLiveSession, filter: CodexLiveTransportFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  return session.downstreamTransport === filter || session.upstreamTransport === filter;
}

function buildSessionSearchText(session: CodexLiveSession): string {
  const requestText = session.requests
    .flatMap((request) => [
      request.requestID,
      request.clientRequestID,
      request.upstreamRequestID,
      request.model,
      request.authID,
      request.authLabel,
      request.provider,
      request.proxyRoute,
    ])
    .join(' ');
  return normalizeSearch(
    [
      session.sessionID,
      session.executionSessionID,
      session.downstreamSessionID,
      session.codexWindowID,
      session.activeRequestID,
      session.lastRequestID,
      session.model,
      session.authID,
      session.authLabel,
      session.provider,
      session.status,
      session.downstreamTransport,
      session.upstreamTransport,
      requestText,
    ].join(' '),
  );
}

function normalizeSearch(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9._-]+/g, 'sk-[redacted]')
    .replace(/refresh[_-]?token[=:]\S+/gi, 'refresh_token=[redacted]')
    .replace(/cookie[=:]\S+/gi, 'cookie=[redacted]');
}

function formatMetricMs(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }
  return `${(value / 1000).toFixed(1)}s`;
}

function formatMetricRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  return `${Math.round(value)}/s`;
}

export function groupTimelineByLane(events: readonly CodexLiveTimelineEvent[]) {
  return {
    downstream: events.filter((event) => event.lane === 'downstream'),
    sidecar: events.filter((event) => event.lane === 'sidecar'),
    upstream: events.filter((event) => event.lane === 'upstream'),
    fallback: events.filter((event) => event.lane === 'fallback'),
  };
}
