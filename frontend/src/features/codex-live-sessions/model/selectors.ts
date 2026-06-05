import type {
  CodexLiveProjectHealth,
  CodexLiveProjectSummary,
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
const completedStatuses = new Set<CodexLiveSessionStatus>(['completed']);
const unknownProjectID = 'project:unknown';
const unknownProjectName = 'Unknown project';

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


export function buildCodexLiveProjectSummaries(sessions: readonly CodexLiveSession[]): CodexLiveProjectSummary[] {
  const projects = new Map<string, CodexLiveProjectSummary>();

  for (const session of sessions) {
    const projectID = getCodexLiveProjectIDForSession(session);
    const project = projects.get(projectID) ?? createEmptyProjectSummary(projectID, resolveCodexLiveProjectName(session));
    projects.set(projectID, project);

    project.sessionCount += 1;
    project.requestCount += Math.max(0, session.requestCount || session.requests.length);
    project.durationMs = Math.max(project.durationMs ?? 0, session.durationMs || 0);
    project.sessionIDs.push(session.sessionID);

    if (activeStatuses.has(session.status) || reconnectingStatuses.has(session.status)) {
      project.activeSessionCount += 1;
    }
    if (completedStatuses.has(session.status)) {
      project.completedSessionCount += 1;
    }
    if (session.status === 'degraded_http' || session.fallbackInferred) {
      project.degradedSessionCount += 1;
    }
    if (failedStatuses.has(session.status)) {
      project.failedSessionCount += 1;
    }
    if (session.activeRequestID) {
      project.activeRequestCount += 1;
    }
    if (session.downstreamTransport === 'websocket' || session.upstreamTransport === 'websocket') {
      project.websocketSessionCount += 1;
    }
    if (session.downstreamTransport === 'http' || session.upstreamTransport === 'http') {
      project.httpSessionCount += 1;
    }
    if (session.provider) {
      project.providerCounts[session.provider] = (project.providerCounts[session.provider] ?? 0) + 1;
    }
    if (session.model) {
      project.modelCounts[session.model] = (project.modelCounts[session.model] ?? 0) + 1;
    }

    if (!project.startedAt || compareLiveSessionTime(project.startedAt, session.startedAt) > 0) {
      project.startedAt = session.startedAt;
    }
    if (!project.lastEventAt || compareLiveSessionTime(project.lastEventAt, session.lastEventAt) < 0) {
      project.lastEventAt = session.lastEventAt;
      project.lastModel = session.model || project.lastModel;
      project.lastAuthLabel = session.authLabel || project.lastAuthLabel;
      project.lastRequestID = session.lastRequestID || session.activeRequestID || project.lastRequestID;
    }
  }

  return Array.from(projects.values())
    .map((project) => ({
      ...project,
      providerCounts: sortCountRecord(project.providerCounts),
      modelCounts: sortCountRecord(project.modelCounts),
      health: resolveProjectHealth(project),
    }))
    .sort(compareCodexLiveProjectSummaries);
}

export function getCodexLiveProjectIDForSession(session: Pick<CodexLiveSession, 'projectName'>): string {
  const name = resolveCodexLiveProjectName(session);
  if (name === unknownProjectName) {
    return unknownProjectID;
  }
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? `project:${normalized}` : unknownProjectID;
}

function createEmptyProjectSummary(projectID: string, projectName: string): CodexLiveProjectSummary {
  return {
    projectID,
    projectName,
    sessionCount: 0,
    activeSessionCount: 0,
    completedSessionCount: 0,
    degradedSessionCount: 0,
    failedSessionCount: 0,
    requestCount: 0,
    activeRequestCount: 0,
    websocketSessionCount: 0,
    httpSessionCount: 0,
    providerCounts: {},
    modelCounts: {},
    durationMs: 0,
    health: 'idle',
    sessionIDs: [],
  };
}

function resolveCodexLiveProjectName(session: Pick<CodexLiveSession, 'projectName'>): string {
  const projectName = session.projectName?.trim();
  return projectName || unknownProjectName;
}

function resolveProjectHealth(project: CodexLiveProjectSummary): CodexLiveProjectHealth {
  if (project.failedSessionCount > 0) {
    return 'error';
  }
  if (project.degradedSessionCount > 0) {
    return 'warning';
  }
  if (project.activeSessionCount > 0 || project.activeRequestCount > 0) {
    return 'active';
  }
  return 'idle';
}

const projectHealthRank: Record<CodexLiveProjectHealth, number> = {
  error: 0,
  warning: 1,
  active: 2,
  idle: 3,
};

function compareCodexLiveProjectSummaries(a: CodexLiveProjectSummary, b: CodexLiveProjectSummary): number {
  const healthDelta = projectHealthRank[a.health] - projectHealthRank[b.health];
  if (healthDelta !== 0) {
    return healthDelta;
  }
  const timeDelta = compareLiveSessionTime(a.lastEventAt ?? '', b.lastEventAt ?? '');
  if (timeDelta !== 0) {
    return timeDelta;
  }
  return a.projectName.localeCompare(b.projectName);
}

function sortCountRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).sort((a, b) => {
      const countDelta = b[1] - a[1];
      return countDelta !== 0 ? countDelta : a[0].localeCompare(b[0]);
    }),
  );
}

export function compareCodexLiveSessions(a: CodexLiveSession, b: CodexLiveSession): number {
  const rankDelta = statusRank[a.status] - statusRank[b.status];
  if (rankDelta !== 0) {
    return rankDelta;
  }
  const startedDelta = compareLiveSessionTime(a.startedAt, b.startedAt);
  if (startedDelta !== 0) {
    return startedDelta;
  }
  return a.sessionID.localeCompare(b.sessionID);
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
    `account_key: ${selectedRequest?.accountKey || session.accountKey || 'unknown'}`,
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
      session.projectName,
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

function compareLiveSessionTime(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) && !Number.isFinite(right)) {
    return 0;
  }
  if (!Number.isFinite(left)) {
    return 1;
  }
  if (!Number.isFinite(right)) {
    return -1;
  }
  return left - right;
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
