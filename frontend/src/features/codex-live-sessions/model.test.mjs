import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCodexLiveDiagnosticSummary,
  buildCodexLiveSessionSummary,
  filterCodexLiveSessions,
  formatCodexLiveTimingLine,
  getSelectedCodexLiveSession,
} from './model/selectors.ts';
import {
  buildCodexLiveSessionsInitialSnapshot,
  buildCodexLiveSessionsLoadFailureSnapshot,
} from './model/snapshotState.ts';
import { mapBackendCodexLiveSessionsSnapshot } from './model/adapters.ts';
import { codexLiveSessionsPreviewSnapshot } from './model/mockData.ts';

test('filterCodexLiveSessions searches request ids and keeps active sessions first', () => {
  const rows = filterCodexLiveSessions({
    sessions: codexLiveSessionsPreviewSnapshot.sessions,
    query: 'gt-req-8912',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionID, 'ws_sess_7a91');

  const sorted = filterCodexLiveSessions({
    sessions: codexLiveSessionsPreviewSnapshot.sessions,
  });
  assert.deepEqual(sorted.slice(0, 3).map((session) => session.status), ['streaming', 'reconnecting', 'degraded_http']);
});

test('filterCodexLiveSessions filters degraded and transport state conservatively', () => {
  const degraded = filterCodexLiveSessions({
    sessions: codexLiveSessionsPreviewSnapshot.sessions,
    statusFilter: 'degraded_http',
  });
  assert.equal(degraded.length, 1);
  assert.equal(degraded[0].fallbackInferred, true);

  const http = filterCodexLiveSessions({
    sessions: codexLiveSessionsPreviewSnapshot.sessions,
    transportFilter: 'http',
  });
  assert.deepEqual(http.map((session) => session.sessionID), ['codex_win_48f2', 'http_req_a623']);
});

test('getSelectedCodexLiveSession keeps explicit conversation id or falls back to first filtered row', () => {
  const sessions = filterCodexLiveSessions({
    sessions: codexLiveSessionsPreviewSnapshot.sessions,
    statusFilter: 'failed',
  });

  assert.equal(getSelectedCodexLiveSession(sessions)?.sessionID, sessions[0].sessionID);
  assert.equal(getSelectedCodexLiveSession(sessions, sessions[0].sessionID)?.sessionID, sessions[0].sessionID);
  assert.equal(getSelectedCodexLiveSession(sessions, 'missing-conversation-id')?.sessionID, sessions[0].sessionID);
});

test('buildCodexLiveSessionSummary derives counts from sessions', () => {
  assert.deepEqual(buildCodexLiveSessionSummary(codexLiveSessionsPreviewSnapshot.sessions), {
    activeSessions: 1,
    activeRequests: 2,
    websocketSessions: 3,
    httpSessions: 2,
    degradedSessions: 1,
    errorSessions: 1,
  });
});

test('buildCodexLiveDiagnosticSummary redacts sensitive text', () => {
  const failed = codexLiveSessionsPreviewSnapshot.sessions.find((session) => session.status === 'failed');
  assert.ok(failed);

  const summary = buildCodexLiveDiagnosticSummary(failed, failed.requests[0]);
  assert.match(summary, /redacted_fields:/);
  assert.match(summary, /timing:/);
  assert.match(summary, /Bearer \[redacted\]/);
  assert.doesNotMatch(summary, /Bearer sk-/);
  assert.doesNotMatch(summary, /Authorization: Bearer [A-Za-z0-9._-]+/);
});

test('formatCodexLiveTimingLine exposes rate and time measurements without payload data', () => {
  const line = formatCodexLiveTimingLine({
    queueWaitMs: 18,
    authSelectMs: 44,
    upstreamConnectMs: 391,
    firstEventMs: 1562,
    firstTokenMs: 1800,
    averageEventGapMs: 82,
    longestEventGapMs: 420,
    streamDurationMs: 7352,
    totalDurationMs: 8034,
    reconnectCount: 2,
    outputTokensPerSecond: 430.4,
    totalTokensPerSecond: 2686.2,
  });

  assert.equal(
    line,
    'queue=18ms auth=44ms connect=391ms ttft=1.6s first_token=1.8s stream=7.4s total=8.0s avg_gap=82ms max_gap=420ms reconnects=2 output_rate=430/s total_rate=2686/s',
  );
});

test('mapBackendCodexLiveSessionsSnapshot normalizes live Wails snapshot for the workbench', () => {
  const snapshot = mapBackendCodexLiveSessionsSnapshot({
    generatedAt: '2026-05-21T08:00:00Z',
    sidecarReady: true,
    source: 'live',
    retentionLabel: '30m / 200',
    summary: {
      activeSessions: 1,
      activeRequests: 1,
      websocketSessions: 1,
      httpSessions: 0,
      degradedSessions: 0,
      errorSessions: 0,
    },
    sessions: [
      {
        sessionID: 'ws-session-1',
        status: 'streaming',
        startedAt: '2026-05-21T08:00:00Z',
        lastEventAt: '2026-05-21T08:00:02Z',
        durationMs: 2000,
        requestCount: 1,
        activeRequestID: 'req-1',
        model: 'gpt-5.5',
        authLabel: 'team-codex@example.com',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        fallbackConfidence: 'not-a-confidence',
        recentEvents: [{ id: 'evt-1', at: '16:00:00.000', lane: 'bad-lane', kind: 'received', label: 'ok', severity: 'bad-severity' }],
        requests: [
          {
            requestID: 'req-1',
            sessionID: 'ws-session-1',
            sequence: 1,
            model: 'gpt-5.5',
            status: 'streaming',
            startedAt: '2026-05-21T08:00:00Z',
            downstreamTransport: 'websocket',
            upstreamTransport: 'websocket',
            timing: { outputTokensPerSecond: 42, firstTokenMs: 800 },
            timeline: [],
          },
        ],
      },
    ],
  });

  assert.equal(snapshot.source, 'live');
  assert.equal(snapshot.sessions[0].requests[0].timing?.outputTokensPerSecond, 42);
  assert.equal(snapshot.sessions[0].fallbackConfidence, undefined);
  assert.equal(snapshot.sessions[0].recentEvents[0].lane, 'sidecar');
  assert.equal(snapshot.sessions[0].recentEvents[0].severity, 'info');
});

test('desktop live sessions state never promotes preview rows to cache', () => {
  const initial = buildCodexLiveSessionsInitialSnapshot({ browserMode: false, sidecarReady: true });

  assert.equal(initial.source, 'unavailable');
  assert.deepEqual(initial.sessions, []);

  const failed = buildCodexLiveSessionsLoadFailureSnapshot(codexLiveSessionsPreviewSnapshot);

  assert.equal(failed.source, 'unavailable');
  assert.equal(failed.sidecarReady, false);
  assert.deepEqual(failed.sessions, []);
});

test('desktop live sessions state keeps only prior real live rows as cache after a poll failure', () => {
  const liveSnapshot = {
    ...codexLiveSessionsPreviewSnapshot,
    source: 'live',
    sessions: [codexLiveSessionsPreviewSnapshot.sessions[0]],
  };

  const failed = buildCodexLiveSessionsLoadFailureSnapshot(liveSnapshot);

  assert.equal(failed.source, 'cache');
  assert.equal(failed.sidecarReady, false);
  assert.equal(failed.sessions.length, 1);
  assert.equal(failed.sessions[0].sessionID, codexLiveSessionsPreviewSnapshot.sessions[0].sessionID);
});
