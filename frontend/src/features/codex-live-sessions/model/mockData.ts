import type { CodexLiveRequest, CodexLiveSession, CodexLiveSessionSnapshot, CodexLiveTimelineEvent } from './types';
import { snapshotWithDerivedSummary } from './selectors.ts';

const generatedAt = '2026-05-21T18:36:42+08:00';
const previewActiveRequestStartedAtMs = Date.parse('2026-05-21T18:35:10+08:00');
const previewLiveElapsedBaseMs = 7600;
const previewLiveElapsedCycleMs = 9000;

function event(
  id: string,
  at: string,
  lane: CodexLiveTimelineEvent['lane'],
  kind: string,
  label: string,
  severity: CodexLiveTimelineEvent['severity'] = 'info',
  detail = '',
): CodexLiveTimelineEvent {
  return { id, at, lane, kind, label, severity, detail };
}

const activeTimeline = [
  event('evt-active-1', '18:35:10.120', 'downstream', 'connected', 'Downstream WebSocket connected', 'success'),
  event('evt-active-2', '18:35:10.244', 'downstream', 'request', 'response.create received: req_gt_8912', 'info'),
  event('evt-active-3', '18:35:10.288', 'sidecar', 'auth_selected', 'auth-file:team-codex selected', 'success'),
  event('evt-active-4', '18:35:10.511', 'upstream', 'handshake', 'Upstream WebSocket handshake completed', 'success'),
  event('evt-active-5', '18:35:10.682', 'upstream', 'first_event', 'response.created received', 'success'),
  event('evt-active-6', '18:35:18.034', 'upstream', 'streaming', 'response.output_text.delta streaming', 'info'),
];

const reconnectingTimeline = [
  event('evt-reconnect-1', '18:32:01.100', 'downstream', 'connected', 'Downstream WebSocket connected', 'success'),
  event('evt-reconnect-2', '18:32:01.384', 'sidecar', 'auth_selected', 'codex-api-key:local-relay selected', 'success'),
  event('evt-reconnect-3', '18:32:02.033', 'upstream', 'handshake', 'Upstream WebSocket handshake completed', 'success'),
  event('evt-reconnect-4', '18:32:45.901', 'upstream', 'read_error', 'Upstream read error: websocket closed', 'warning'),
  event('evt-reconnect-5', '18:32:45.923', 'sidecar', 'notify_downstream', 'Downstream closed so Codex can retry or fallback', 'warning'),
];

const degradedTimeline = [
  event('evt-degraded-1', '18:20:00.310', 'downstream', 'connected', 'WebSocket turn observed for window win_48f2', 'success'),
  event('evt-degraded-2', '18:20:04.814', 'upstream', 'read_error', 'WebSocket retry budget exhausted', 'warning'),
  event('evt-degraded-3', '18:20:05.201', 'fallback', 'inferred', 'Same Codex window switched to HTTP POST /v1/responses', 'warning'),
  event('evt-degraded-4', '18:20:05.388', 'upstream', 'http_stream', 'HTTP stream started after WebSocket attempts', 'info'),
  event('evt-degraded-5', '18:20:18.923', 'upstream', 'completed', 'HTTP response.completed received', 'success'),
];

const failedTimeline = [
  event('evt-failed-1', '18:14:02.110', 'downstream', 'request', 'HTTP POST /v1/responses received', 'info'),
  event('evt-failed-2', '18:14:02.310', 'sidecar', 'auth_selected', 'openai-compatible:team-router selected', 'success'),
  event('evt-failed-3', '18:14:03.600', 'upstream', 'error', '429 websocket_connection_limit_reached', 'error'),
  event('evt-failed-4', '18:14:03.624', 'sidecar', 'failed', 'Request failed with retryable upstream error', 'error'),
];

function request(input: Partial<CodexLiveRequest> & Pick<CodexLiveRequest, 'requestID' | 'sessionID' | 'model' | 'status' | 'startedAt' | 'timeline'>): CodexLiveRequest {
  return {
    sequence: 1,
    downstreamTransport: 'websocket',
    upstreamTransport: 'websocket',
    ...input,
  };
}

const activeRequests: CodexLiveRequest[] = [
  request({
    requestID: 'gt-req-8874',
    clientRequestID: 'cr_01hx-live-8874',
    upstreamRequestID: 'req_up_0c31',
    sessionID: 'ws_sess_7a91',
    sequence: 1,
    model: 'gpt-5.5',
    status: 'completed',
    startedAt: '2026-05-21T18:27:40+08:00',
    completedAt: '2026-05-21T18:27:46+08:00',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    connectionReused: false,
    usage: { inputTokens: 12420, cachedInputTokens: 6120, outputTokens: 2140, totalTokens: 14560 },
    timing: {
      queueWaitMs: 30,
      authSelectMs: 72,
      upstreamConnectMs: 610,
      firstEventMs: 740,
      firstTokenMs: 1180,
      averageEventGapMs: 96,
      longestEventGapMs: 560,
      streamDurationMs: 4860,
      totalDurationMs: 6040,
      reconnectCount: 0,
      outputTokensPerSecond: 440,
      totalTokensPerSecond: 2411,
    },
    timeline: activeTimeline,
  }),
  request({
    requestID: 'gt-req-8885',
    clientRequestID: 'cr_01hx-live-8885',
    upstreamRequestID: 'req_up_2b87',
    sessionID: 'ws_sess_7a91',
    sequence: 2,
    model: 'gpt-5.5',
    status: 'completed',
    startedAt: '2026-05-21T18:29:05+08:00',
    completedAt: '2026-05-21T18:29:11+08:00',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    connectionReused: true,
    usage: { inputTokens: 15340, cachedInputTokens: 7290, outputTokens: 2488, totalTokens: 17828 },
    timing: {
      queueWaitMs: 22,
      authSelectMs: 48,
      upstreamConnectMs: 310,
      firstEventMs: 490,
      firstTokenMs: 710,
      averageEventGapMs: 74,
      longestEventGapMs: 380,
      streamDurationMs: 5210,
      totalDurationMs: 5920,
      reconnectCount: 0,
      outputTokensPerSecond: 477,
      totalTokensPerSecond: 3011,
    },
    timeline: activeTimeline,
  }),
  request({
    requestID: 'gt-req-8898',
    clientRequestID: 'cr_01hx-live-8898',
    upstreamRequestID: 'req_up_4aa1',
    sessionID: 'ws_sess_7a91',
    sequence: 3,
    model: 'gpt-5.5',
    status: 'completed',
    startedAt: '2026-05-21T18:31:22+08:00',
    completedAt: '2026-05-21T18:31:31+08:00',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    connectionReused: true,
    usage: { inputTokens: 17780, cachedInputTokens: 7930, outputTokens: 3980, totalTokens: 21760 },
    timing: {
      queueWaitMs: 116,
      authSelectMs: 58,
      upstreamConnectMs: 420,
      firstEventMs: 920,
      firstTokenMs: 1460,
      averageEventGapMs: 128,
      longestEventGapMs: 740,
      streamDurationMs: 7770,
      totalDurationMs: 9230,
      reconnectCount: 0,
      outputTokensPerSecond: 512,
      totalTokensPerSecond: 2358,
    },
    timeline: activeTimeline,
  }),
  request({
    requestID: 'gt-req-8906',
    clientRequestID: 'cr_01hx-live-8906',
    upstreamRequestID: 'req_up_5d7e',
    sessionID: 'ws_sess_7a91',
    sequence: 4,
    model: 'gpt-5.5',
    status: 'completed',
    startedAt: '2026-05-21T18:33:48+08:00',
    completedAt: '2026-05-21T18:33:53+08:00',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    connectionReused: true,
    usage: { inputTokens: 13480, cachedInputTokens: 6900, outputTokens: 1880, totalTokens: 15360 },
    timing: {
      queueWaitMs: 16,
      authSelectMs: 40,
      upstreamConnectMs: 260,
      firstEventMs: 430,
      firstTokenMs: 650,
      averageEventGapMs: 69,
      longestEventGapMs: 330,
      streamDurationMs: 3980,
      totalDurationMs: 4630,
      reconnectCount: 0,
      outputTokensPerSecond: 472,
      totalTokensPerSecond: 3317,
    },
    timeline: activeTimeline,
  }),
  request({
    requestID: 'gt-req-8912',
    clientRequestID: 'cr_01hx-live-8912',
    upstreamRequestID: 'req_up_6d4f',
    sessionID: 'ws_sess_7a91',
    sequence: 5,
    model: 'gpt-5.5',
    status: 'streaming',
    startedAt: '2026-05-21T18:35:10+08:00',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    connectionReused: true,
    usage: { inputTokens: 18420, cachedInputTokens: 8240, outputTokens: 3160, totalTokens: 21580 },
    timing: {
      queueWaitMs: 18,
      authSelectMs: 44,
      upstreamConnectMs: 391,
      firstEventMs: 562,
      firstTokenMs: 810,
      averageEventGapMs: 82,
      longestEventGapMs: 420,
      streamDurationMs: 7352,
      totalDurationMs: 8034,
      reconnectCount: 0,
      outputTokensPerSecond: 430,
      totalTokensPerSecond: 2686,
    },
    timeline: activeTimeline,
  }),
];

export const codexLiveSessionsPreviewSessions: CodexLiveSession[] = [
  {
    sessionID: 'ws_sess_7a91',
    projectName: 'GetTokens',
    executionSessionID: '8a1d8e9f-6e9a-4e0f-bb5a-05c69d2a8c20',
    downstreamSessionID: 'downstream:7a91',
    codexWindowID: 'win_831f',
    status: 'streaming',
    startedAt: '2026-05-21T18:35:10+08:00',
    lastEventAt: '2026-05-21T18:35:18+08:00',
    durationMs: 458034,
    requestCount: activeRequests.length,
    activeRequestID: 'gt-req-8912',
    lastRequestID: 'gt-req-8912',
    model: 'gpt-5.5',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    downstreamTransport: 'websocket',
    upstreamTransport: 'websocket',
    recentEvents: activeTimeline,
    requests: activeRequests,
  },
  {
    sessionID: 'ws_sess_4c27',
    projectName: 'GetTokens',
    executionSessionID: '50827663-0bde-438e-b80a-c6bdf21d38b2',
    downstreamSessionID: 'downstream:4c27',
    codexWindowID: 'win_92ad',
    status: 'reconnecting',
    startedAt: '2026-05-21T18:32:01+08:00',
    lastEventAt: '2026-05-21T18:32:45+08:00',
    durationMs: 44923,
    requestCount: 1,
    activeRequestID: 'gt-req-7714',
    lastRequestID: 'gt-req-7714',
    model: 'gpt-5.4',
    authID: 'codex-api-key:local-relay',
    authLabel: 'Local Relay Key',
    provider: 'codex',
    downstreamTransport: 'websocket',
    upstreamTransport: 'unknown',
    recentEvents: reconnectingTimeline,
    requests: [
      request({
        requestID: 'gt-req-7714',
        clientRequestID: 'cr_01hx-retry-7714',
        sessionID: 'ws_sess_4c27',
        model: 'gpt-5.4',
        status: 'reconnecting',
        startedAt: '2026-05-21T18:32:01+08:00',
        authID: 'codex-api-key:local-relay',
        authLabel: 'Local Relay Key',
        provider: 'codex',
        upstreamTransport: 'unknown',
        error: { message: 'websocket closed before response.completed', retryable: true },
        timing: {
          queueWaitMs: 210,
          authSelectMs: 284,
          upstreamConnectMs: 649,
          firstEventMs: 1120,
          firstTokenMs: 1800,
          averageEventGapMs: 960,
          longestEventGapMs: 12900,
          streamDurationMs: 43890,
          totalDurationMs: 44923,
          reconnectCount: 1,
          outputTokensPerSecond: 74,
          totalTokensPerSecond: 74,
        },
        timeline: reconnectingTimeline,
      }),
    ],
  },
  {
    sessionID: 'codex_win_48f2',
    projectName: 'GetTokens',
    executionSessionID: '69e11a8e-8583-4f02-bf94-183b2e0988e6',
    codexWindowID: 'win_48f2',
    status: 'degraded_http',
    startedAt: '2026-05-21T18:20:00+08:00',
    lastEventAt: '2026-05-21T18:20:18+08:00',
    durationMs: 18613,
    requestCount: 2,
    lastRequestID: 'gt-req-6620',
    model: 'gpt-5.5',
    authID: 'auth-file:team-codex',
    authLabel: 'team-codex@example.com',
    provider: 'codex',
    downstreamTransport: 'http',
    upstreamTransport: 'http',
    fallbackInferred: true,
    fallbackConfidence: 'high',
    fallbackReason: 'websocket_then_http_same_window',
    recentEvents: degradedTimeline,
    requests: [
      request({
        requestID: 'gt-req-6620',
        clientRequestID: 'cr_01hx-http-6620',
        upstreamRequestID: 'req_http_f912',
        sessionID: 'codex_win_48f2',
        sequence: 2,
        model: 'gpt-5.5',
        status: 'completed',
        startedAt: '2026-05-21T18:20:05+08:00',
        completedAt: '2026-05-21T18:20:18+08:00',
        downstreamTransport: 'http',
        upstreamTransport: 'http',
        authID: 'auth-file:team-codex',
        authLabel: 'team-codex@example.com',
        provider: 'codex',
        usage: { inputTokens: 24012, cachedInputTokens: 12104, outputTokens: 6041, totalTokens: 30053 },
        timing: {
          queueWaitMs: 39,
          authSelectMs: 53,
          upstreamConnectMs: 187,
          firstEventMs: 982,
          firstTokenMs: 1430,
          averageEventGapMs: 110,
          longestEventGapMs: 870,
          streamDurationMs: 13535,
          totalDurationMs: 18613,
          reconnectCount: 3,
          outputTokensPerSecond: 446,
          totalTokensPerSecond: 1615,
        },
        timeline: degradedTimeline,
      }),
    ],
  },
  {
    sessionID: 'http_req_a623',
    projectName: 'GetTokens',
    codexWindowID: 'win_a623',
    status: 'failed',
    startedAt: '2026-05-21T18:14:02+08:00',
    lastEventAt: '2026-05-21T18:14:03+08:00',
    durationMs: 1514,
    requestCount: 1,
    lastRequestID: 'gt-req-5100',
    model: 'gpt-5.4-mini',
    authID: 'openai-compatible:team-router',
    authLabel: 'team-router.internal',
    provider: 'team-router',
    downstreamTransport: 'http',
    upstreamTransport: 'websocket',
    recentEvents: failedTimeline,
    requests: [
      request({
        requestID: 'gt-req-5100',
        clientRequestID: 'cr_01hx-failed-5100',
        upstreamRequestID: 'req_fail_5100',
        sessionID: 'http_req_a623',
        model: 'gpt-5.4-mini',
        status: 'failed',
        startedAt: '2026-05-21T18:14:02+08:00',
        completedAt: '2026-05-21T18:14:03+08:00',
        downstreamTransport: 'http',
        upstreamTransport: 'websocket',
        authID: 'openai-compatible:team-router',
        authLabel: 'team-router.internal',
        provider: 'team-router',
        error: {
          statusCode: 429,
          code: 'websocket_connection_limit_reached',
          message: 'Responses websocket connection limit reached. Authorization: Bearer [redacted]',
          retryable: true,
        },
        timing: {
          queueWaitMs: 96,
          authSelectMs: 200,
          upstreamConnectMs: 1290,
          firstEventMs: 0,
          firstTokenMs: 0,
          averageEventGapMs: 0,
          longestEventGapMs: 0,
          streamDurationMs: 0,
          totalDurationMs: 1514,
          reconnectCount: 0,
          outputTokensPerSecond: 0,
          totalTokensPerSecond: 0,
        },
        timeline: failedTimeline,
      }),
    ],
  },
];

export const codexLiveSessionsPreviewSnapshot: CodexLiveSessionSnapshot = snapshotWithDerivedSummary({
  generatedAt,
  sidecarReady: true,
  source: 'preview',
  retentionLabel: '30m / 200 sessions',
  summary: {
    activeSessions: 0,
    activeRequests: 0,
    websocketSessions: 0,
    httpSessions: 0,
    degradedSessions: 0,
    errorSessions: 0,
  },
  sessions: codexLiveSessionsPreviewSessions,
});

export function buildAnimatedCodexLiveSessionsPreviewSnapshot(nowMs = Date.now()): CodexLiveSessionSnapshot {
  const safeNowMs = Number.isFinite(nowMs) ? Math.round(nowMs) : Date.now();
  const liveElapsedMs = previewLiveElapsedBaseMs + (safeNowMs % previewLiveElapsedCycleMs);
  const targetActiveRequestStartedAtMs = safeNowMs - liveElapsedMs;
  const timestampDeltaMs = targetActiveRequestStartedAtMs - previewActiveRequestStartedAtMs;
  const sessions = codexLiveSessionsPreviewSessions.map((session) =>
    shiftPreviewSessionTimestamps(session, timestampDeltaMs, safeNowMs),
  );

  return snapshotWithDerivedSummary({
    ...codexLiveSessionsPreviewSnapshot,
    generatedAt: new Date(safeNowMs).toISOString(),
    sessions,
  });
}

export const codexLiveSessionsEmptySnapshot: CodexLiveSessionSnapshot = snapshotWithDerivedSummary({
  generatedAt,
  sidecarReady: true,
  source: 'preview',
  retentionLabel: '30m / 200 sessions',
  summary: {
    activeSessions: 0,
    activeRequests: 0,
    websocketSessions: 0,
    httpSessions: 0,
    degradedSessions: 0,
    errorSessions: 0,
  },
  sessions: [],
});

function shiftPreviewSessionTimestamps(session: CodexLiveSession, timestampDeltaMs: number, nowMs: number): CodexLiveSession {
  const startedAt = shiftPreviewTimestamp(session.startedAt, timestampDeltaMs);
  const requests = session.requests.map((request) => shiftPreviewRequestTimestamps(request, timestampDeltaMs, nowMs));
  const activeRequest = session.activeRequestID
    ? requests.find((request) => request.requestID === session.activeRequestID)
    : undefined;
  const lastEventAt = shiftPreviewTimestamp(session.lastEventAt, timestampDeltaMs);
  const activeDurationMs = activeRequest ? Math.max(0, Math.round(nowMs - Date.parse(activeRequest.startedAt))) : null;
  const historicalDurationMs = Math.max(0, Date.parse(lastEventAt) - Date.parse(startedAt));

  return {
    ...session,
    startedAt,
    lastEventAt,
    durationMs: activeDurationMs ?? historicalDurationMs,
    recentEvents: session.recentEvents,
    requests,
  };
}

function shiftPreviewRequestTimestamps(request: CodexLiveRequest, timestampDeltaMs: number, nowMs: number): CodexLiveRequest {
  const startedAt = shiftPreviewTimestamp(request.startedAt, timestampDeltaMs);
  const shiftedRequest = {
    ...request,
    startedAt,
    completedAt: request.completedAt ? shiftPreviewTimestamp(request.completedAt, timestampDeltaMs) : undefined,
  };
  if (shiftedRequest.completedAt || !['active', 'streaming', 'reconnecting'].includes(shiftedRequest.status)) {
    return shiftedRequest;
  }

  const liveElapsedMs = Math.max(0, Math.round(nowMs - Date.parse(startedAt)));
  return {
    ...shiftedRequest,
    timing: {
      ...shiftedRequest.timing,
      totalDurationMs: liveElapsedMs,
      streamDurationMs: Math.max(0, liveElapsedMs - (shiftedRequest.timing?.firstTokenMs ?? 0)),
    },
  };
}

function shiftPreviewTimestamp(value: string, timestampDeltaMs: number): string {
  const timestampMs = Date.parse(value);
  if (!Number.isFinite(timestampMs)) {
    return value;
  }
  return new Date(timestampMs + timestampDeltaMs).toISOString();
}

export const codexLiveSessionsSidecarNotReadySnapshot: CodexLiveSessionSnapshot = {
  ...codexLiveSessionsPreviewSnapshot,
  sidecarReady: false,
  source: 'cache',
};

export const codexLiveSessionsHighVolumeSnapshot: CodexLiveSessionSnapshot = snapshotWithDerivedSummary({
  ...codexLiveSessionsPreviewSnapshot,
  sessions: Array.from({ length: 80 }, (_, index) => {
    const base = codexLiveSessionsPreviewSessions[index % codexLiveSessionsPreviewSessions.length];
    return {
      ...base,
      sessionID: `${base.sessionID}_${String(index + 1).padStart(2, '0')}`,
      lastEventAt: new Date(Date.parse(base.lastEventAt) - index * 30000).toISOString(),
      requests: base.requests.map((item) => ({
        ...item,
        requestID: `${item.requestID}_${String(index + 1).padStart(2, '0')}`,
      })),
    };
  }),
});
