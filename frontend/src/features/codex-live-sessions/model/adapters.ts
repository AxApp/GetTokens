import type { main } from '../../../../wailsjs/go/models';
import type {
  CodexLiveRequest,
  CodexLiveSessionHistoryResponse,
  CodexLiveSession,
  CodexLiveSessionSnapshot,
  CodexLiveSessionSource,
  CodexLiveSessionStatus,
  CodexLiveTimelineEvent,
  CodexLiveTransport,
} from './types';

const statusValues = new Set<CodexLiveSessionStatus>([
  'active',
  'streaming',
  'reconnecting',
  'upstream_disconnected',
  'degraded_http',
  'completed',
  'failed',
  'cancelled',
]);

const transportValues = new Set<CodexLiveTransport>(['websocket', 'http', 'unknown']);
const sourceValues = new Set<CodexLiveSessionSource>(['live', 'cache', 'preview', 'unavailable']);
const laneValues = new Set<CodexLiveTimelineEvent['lane']>(['downstream', 'sidecar', 'upstream', 'fallback']);
const severityValues = new Set<CodexLiveTimelineEvent['severity']>(['info', 'success', 'warning', 'error']);

export function mapBackendCodexLiveSessionsSnapshot(
  snapshot: main.CodexLiveSessionsSnapshot,
): CodexLiveSessionSnapshot {
  return {
    generatedAt: snapshot.generatedAt || '',
    sidecarReady: Boolean(snapshot.sidecarReady),
    source: normalizeSource(snapshot.source),
    retentionLabel: snapshot.retentionLabel || '',
    summary: {
      activeSessions: snapshot.summary?.activeSessions || 0,
      activeRequests: snapshot.summary?.activeRequests || 0,
      websocketSessions: snapshot.summary?.websocketSessions || 0,
      httpSessions: snapshot.summary?.httpSessions || 0,
      degradedSessions: snapshot.summary?.degradedSessions || 0,
      errorSessions: snapshot.summary?.errorSessions || 0,
    },
    sessions: (snapshot.sessions || []).map(mapBackendCodexLiveSession),
  };
}

export function mapBackendCodexLiveSessionHistory(
  response: main.CodexLiveSessionHistoryResponse,
): CodexLiveSessionHistoryResponse {
  return {
    window: response.window || '',
    generatedAt: response.generatedAt || '',
    limit: response.limit || 0,
    offset: response.offset || 0,
    items: (response.items || []).map(mapBackendCodexLiveRequest),
  };
}

function mapBackendCodexLiveSession(session: main.CodexLiveSession): CodexLiveSession {
  return {
    sessionID: session.sessionID || '',
    projectName: session.projectName || undefined,
    executionSessionID: session.executionSessionID || undefined,
    downstreamSessionID: session.downstreamSessionID || undefined,
    codexWindowID: session.codexWindowID || undefined,
    status: normalizeStatus(session.status),
    startedAt: session.startedAt || '',
    lastEventAt: session.lastEventAt || '',
    durationMs: session.durationMs || 0,
    requestCount: session.requestCount || 0,
    activeRequestID: session.activeRequestID || undefined,
    lastRequestID: session.lastRequestID || undefined,
    model: session.model || '',
    authID: session.authID || undefined,
    authLabel: session.authLabel || undefined,
    provider: session.provider || undefined,
    downstreamTransport: normalizeTransport(session.downstreamTransport),
    upstreamTransport: normalizeTransport(session.upstreamTransport),
    fallbackInferred: Boolean(session.fallbackInferred),
    fallbackConfidence: normalizeFallbackConfidence(session.fallbackConfidence),
    fallbackReason: session.fallbackReason || undefined,
    recentEvents: (session.recentEvents || []).map(mapBackendTimelineEvent),
    requests: (session.requests || []).map(mapBackendCodexLiveRequest),
  };
}

function mapBackendCodexLiveRequest(request: main.CodexLiveRequest): CodexLiveRequest {
  return {
    requestID: request.requestID || '',
    clientRequestID: request.clientRequestID || undefined,
    upstreamRequestID: request.upstreamRequestID || undefined,
    sessionID: request.sessionID || '',
    sequence: request.sequence || 0,
    model: request.model || '',
    status: normalizeStatus(request.status),
    startedAt: request.startedAt || '',
    completedAt: request.completedAt || undefined,
    downstreamTransport: normalizeTransport(request.downstreamTransport),
    upstreamTransport: normalizeTransport(request.upstreamTransport),
    connectionReused: Boolean(request.connectionReused),
    authID: request.authID || undefined,
    authLabel: request.authLabel || undefined,
    provider: request.provider || undefined,
    proxyRoute: request.proxyRoute || undefined,
    usage: request.usage
      ? {
          inputTokens: request.usage.inputTokens || 0,
          cachedInputTokens: request.usage.cachedInputTokens || 0,
          outputTokens: request.usage.outputTokens || 0,
          totalTokens: request.usage.totalTokens || 0,
        }
      : undefined,
    quota: (((request as any).quota) || []).map((q: any) => ({
      label: q.label || '',
      remaining: q.remaining,
      limit: q.limit,
      remainingPercent: q.remainingPercent,
      resetLabel: q.resetLabel,
      resetAtUnix: q.resetAtUnix,
    })),
    billing: (((request as any).billing) || []).map((b: any) => ({
      currency: b.currency || '',
      totalBalance: b.totalBalance || 0,
      grantedBalance: b.grantedBalance || 0,
      toppedUpBalance: b.toppedUpBalance || 0,
    })),
    timing: request.timing
      ? {
          queueWaitMs: request.timing.queueWaitMs,
          authSelectMs: request.timing.authSelectMs,
          upstreamConnectMs: request.timing.upstreamConnectMs,
          firstEventMs: request.timing.firstEventMs,
          firstTokenMs: request.timing.firstTokenMs,
          averageEventGapMs: request.timing.averageEventGapMs,
          longestEventGapMs: request.timing.longestEventGapMs,
          streamDurationMs: request.timing.streamDurationMs,
          totalDurationMs: request.timing.totalDurationMs,
          reconnectCount: request.timing.reconnectCount,
          outputTokensPerSecond: request.timing.outputTokensPerSecond,
          totalTokensPerSecond: request.timing.totalTokensPerSecond,
        }
      : undefined,
    error: request.error
      ? {
          statusCode: request.error.statusCode,
          code: request.error.code,
          message: request.error.message || '',
          retryable: request.error.retryable,
        }
      : undefined,
    timeline: (request.timeline || []).map(mapBackendTimelineEvent),
  };
}

function mapBackendTimelineEvent(event: main.CodexLiveTimelineEvent): CodexLiveTimelineEvent {
  return {
    id: event.id || '',
    at: event.at || '',
    lane: laneValues.has(event.lane as CodexLiveTimelineEvent['lane'])
      ? (event.lane as CodexLiveTimelineEvent['lane'])
      : 'sidecar',
    kind: event.kind || 'event',
    label: event.label || '',
    severity: severityValues.has(event.severity as CodexLiveTimelineEvent['severity'])
      ? (event.severity as CodexLiveTimelineEvent['severity'])
      : 'info',
    detail: event.detail || undefined,
  };
}

function normalizeStatus(value: string): CodexLiveSessionStatus {
  return statusValues.has(value as CodexLiveSessionStatus) ? (value as CodexLiveSessionStatus) : 'active';
}

function normalizeTransport(value: string): CodexLiveTransport {
  return transportValues.has(value as CodexLiveTransport) ? (value as CodexLiveTransport) : 'unknown';
}

function normalizeSource(value: string): CodexLiveSessionSource {
  return sourceValues.has(value as CodexLiveSessionSource) ? (value as CodexLiveSessionSource) : 'cache';
}

function normalizeFallbackConfidence(value?: string): 'high' | 'medium' | 'low' | undefined {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return undefined;
}
