import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildCodexLiveDiagnosticSummary,
  buildCodexLiveSessionSummary,
  filterCodexLiveSessions,
  formatCodexLiveTimingLine,
  getPrimaryCodexLiveRequest,
  getSelectedCodexLiveSession,
} from './model/selectors.ts';
import { buildSessionRowSummary } from './components/formatters.ts';
import { copyCodexLiveSessionID } from './components/sessionClipboard.ts';
import {
  buildLiveSessionBillingDisplay,
  buildLiveSessionQuotaDisplay,
} from './components/accountCardAdapters.ts';
import {
  buildFallbackTimelineSummary,
  buildRequestTimelineSummary,
  formatTimelineRequestID,
  formatTimelineTimeLabel,
  sortRequestTimelineRequests,
} from './components/requestTimelineSummary.ts';
import {
  buildCodexLiveSessionsInitialSnapshot,
  buildCodexLiveSessionsLoadFailureSnapshot,
} from './model/snapshotState.ts';
import { mapBackendCodexLiveSessionHistory, mapBackendCodexLiveSessionsSnapshot } from './model/adapters.ts';
import {
  buildAnimatedCodexLiveSessionsPreviewSnapshot,
  codexLiveSessionsPreviewSnapshot,
} from './model/mockData.ts';
import {
  resolveCodexLiveSessionDetailPollIntervalMs,
  resolveCodexLiveSessionsPollIntervalMs,
} from './model/polling.ts';
import {
  buildCodexLiveRequestTimingMetricAverages,
  buildCodexLiveRequestTimingTrend,
  resolveCodexLiveTimingMetricSummary,
} from './model/requestTimingTrend.ts';
import { mergeCodexLiveSessionsSnapshot } from './model/snapshotMerge.ts';

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

test('filterCodexLiveSessions keeps same-status rows stable when new requests update lastEventAt', () => {
  const oldActive = {
    ...codexLiveSessionsPreviewSnapshot.sessions[0],
    sessionID: 'active-old',
    status: 'streaming',
    startedAt: '2026-05-31T10:00:00.000Z',
    lastEventAt: '2026-05-31T10:00:10.000Z',
  };
  const newActive = {
    ...codexLiveSessionsPreviewSnapshot.sessions[0],
    sessionID: 'active-new',
    status: 'streaming',
    startedAt: '2026-05-31T10:01:00.000Z',
    lastEventAt: '2026-05-31T10:01:10.000Z',
  };
  const refreshedOldActive = {
    ...oldActive,
    lastEventAt: '2026-05-31T10:02:30.000Z',
    activeRequestID: 'new-request-on-old-active',
  };

  assert.deepEqual(
    filterCodexLiveSessions({ sessions: [oldActive, newActive] }).map((session) => session.sessionID),
    ['active-old', 'active-new'],
  );
  assert.deepEqual(
    filterCodexLiveSessions({ sessions: [refreshedOldActive, newActive] }).map((session) => session.sessionID),
    ['active-old', 'active-new'],
  );
});

test('filterCodexLiveSessions still matches row-feed request ids without embedded request arrays', () => {
  const rowOnlySession = {
    ...codexLiveSessionsPreviewSnapshot.sessions[0],
    requests: [],
  };
  const rows = filterCodexLiveSessions({
    sessions: [rowOnlySession],
    query: rowOnlySession.activeRequestID,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionID, rowOnlySession.sessionID);
});

test('filterCodexLiveSessions matches project names case-insensitively', () => {
  const rows = filterCodexLiveSessions({
    sessions: codexLiveSessionsPreviewSnapshot.sessions,
    query: 'gettokens',
  });

  assert.ok(rows.length > 0);
  assert.ok(rows.every((session) => session.projectName === 'GetTokens'));
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

test('buildSessionRowSummary only exposes session project, account, and short protocol', () => {
  const session = codexLiveSessionsPreviewSnapshot.sessions[0];
  const summary = buildSessionRowSummary(session, session.requests[0], (key) => key);

  assert.deepEqual(summary, {
    sessionProjectLabel: 'GetTokens',
    accountLabel: 'team-codex@example.com',
    transportLabel: 'ws',
    sessionIDLabel: 'ws_sess_7a91',
  });
  assert.doesNotMatch(Object.values(summary).join(' '), /gpt-5\.5|streaming|8\.0s/);
});

test('buildSessionRowSummary keeps long session ids separate from the project title', () => {
  const session = {
    ...codexLiveSessionsPreviewSnapshot.sessions[0],
    sessionID: 'projects/-Users-linhey-Desktop-linhay-open-sources-GetTokens/sessions/2026/05/25/very-long-session-id.jsonl',
  };
  const summary = buildSessionRowSummary(session, session.requests[0], (key) => key);

  assert.equal(summary.sessionProjectLabel, 'GetTokens');
  assert.match(summary.sessionIDLabel, /^projects\//);
});

test('buildSessionRowSummary falls back to unknown project and prefers http for degraded rows', () => {
  const session = {
    ...codexLiveSessionsPreviewSnapshot.sessions[2],
    projectName: '',
  };
  const summary = buildSessionRowSummary(session, session.requests[0], (key) => {
    if (key === 'codex_live_sessions.unknown_project') {
      return '未知项目';
    }
    if (key === 'codex_live_sessions.unknown_auth') {
      return '未知账号';
    }
    return key;
  });

  assert.equal(summary.sessionProjectLabel, '未知项目');
  assert.equal(summary.accountLabel, 'team-codex@example.com');
  assert.equal(summary.transportLabel, 'http');
  assert.equal(summary.sessionIDLabel, 'codex_win_48f2');
});

test('buildSessionRowSummary derives short protocol from the latest request before session transport', () => {
  const session = {
    ...codexLiveSessionsPreviewSnapshot.sessions[2],
    downstreamTransport: 'http',
    upstreamTransport: 'http',
    fallbackInferred: true,
  };
  const latestRequest = {
    ...session.requests[0],
    requestID: 'gt-req-latest-ws',
    sequence: 99,
    downstreamTransport: 'websocket',
    upstreamTransport: 'websocket',
  };

  const summary = buildSessionRowSummary(session, latestRequest, (key) => key);

  assert.equal(summary.transportLabel, 'ws');
});

test('codex live session row gives project text priority and compresses session id into a button', async () => {
  const feedSource = await readFile(new URL('./components/CodexLiveSessionFeed.tsx', import.meta.url), 'utf8');

  assert.match(feedSource, /role="button"/);
  assert.match(feedSource, /tabIndex=\{0\}/);
  assert.match(feedSource, /onClick=\{onSelect\}/);
  assert.match(feedSource, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(feedSource, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(feedSource, /className="col-start-1 row-start-1/);
  assert.match(feedSource, /className="col-start-2 row-start-1[^"]*self-center[^"]*justify-self-end/);
  assert.match(feedSource, /\{summary\.transportLabel\}/);
  assert.match(feedSource, /className="col-start-1 row-start-2[^"]*self-center/);
  assert.match(feedSource, /\{summary\.accountLabel\}/);
  assert.match(feedSource, /className="col-start-2 row-start-2[^"]*items-center[^"]*justify-end/);
  assert.match(feedSource, /t\('codex_live_sessions\.session_button'\)/);
  assert.doesNotMatch(feedSource, /summary\.sessionIDLabel\}\s*<\/span>/);
  assert.doesNotMatch(feedSource, /accountTransportLabel/);
});

test('copyCodexLiveSessionID writes the exact session id to clipboard', async () => {
  let copiedValue = '';
  const copied = await copyCodexLiveSessionID('codex_win_48f2', {
    writeText: async (value) => {
      copiedValue = value;
    },
  });

  assert.equal(copied, true);
  assert.equal(copiedValue, 'codex_win_48f2');
});

test('copyCodexLiveSessionID ignores blank session ids', async () => {
  let called = false;
  const copied = await copyCodexLiveSessionID('   ', {
    writeText: async () => {
      called = true;
    },
  });

  assert.equal(copied, false);
  assert.equal(called, false);
});

test('getPrimaryCodexLiveRequest prefers active request, then last request, then newest sequence', () => {
  const session = {
    ...codexLiveSessionsPreviewSnapshot.sessions[0],
    activeRequestID: '',
    lastRequestID: 'gt-req-8913',
    authID: 'auth-file:team-codex-legacy',
    authLabel: 'legacy-session-account@example.com',
    requests: [
      {
        ...codexLiveSessionsPreviewSnapshot.sessions[0].requests[0],
        requestID: 'gt-req-8912',
        sequence: 1,
        authID: 'auth-file:team-codex-old',
        authLabel: 'old-account@example.com',
      },
      {
        ...codexLiveSessionsPreviewSnapshot.sessions[0].requests[0],
        requestID: 'gt-req-8913',
        sequence: 2,
        authID: 'auth-file:team-codex-new',
        authLabel: 'new-account@example.com',
      },
    ],
  };

  const selected = getPrimaryCodexLiveRequest(session);
  assert.equal(selected?.requestID, 'gt-req-8913');

  const rowSummary = buildSessionRowSummary(session, selected, (key) => {
    if (key === 'codex_live_sessions.unknown_project') {
      return 'unknown-project';
    }
    if (key === 'codex_live_sessions.unknown_auth') {
      return 'unknown-auth';
    }
    return key;
  });
  assert.equal(rowSummary.accountLabel, 'new-account@example.com');
  assert.equal(rowSummary.transportLabel, 'ws');

  const diagnostic = buildCodexLiveDiagnosticSummary(session, selected);
  assert.match(diagnostic, /auth: auth-file:team-codex-new \/ new-account@example.com/);
});

test('buildLiveSessionQuotaDisplay and billing display reuse account card shapes', () => {
  const quotaDisplay = buildLiveSessionQuotaDisplay([
    { label: '30m', remaining: 12, limit: 40, remainingPercent: 30, resetLabel: '2026-05-23 12:00', resetAtUnix: 123 },
  ]);
  const billingDisplay = buildLiveSessionBillingDisplay([
    { currency: 'USD', totalBalance: 10, grantedBalance: 7, toppedUpBalance: 3 },
  ]);

  assert.deepEqual(quotaDisplay, {
    status: 'success',
    planType: 'live',
    windows: [
      {
        id: '0',
        label: '30m',
        remainingPercent: 30,
        usedLabel: '12 / 40',
        resetLabel: '2026-05-23 12:00',
        resetAtUnix: 123,
      },
    ],
  });
  assert.deepEqual(billingDisplay, {
    isAvailable: true,
    balances: [
      {
        currency: 'USD',
        totalBalance: '10',
        grantedBalance: '7',
        toppedUpBalance: '3',
      },
    ],
  });
});

test('buildRequestTimelineSummary keeps timeline rows focused on time fields', () => {
  const request = getPrimaryCodexLiveRequest(codexLiveSessionsPreviewSnapshot.sessions[0]);
  assert.ok(request);
  const summary = buildRequestTimelineSummary(request);

  assert.deepEqual(summary, {
    requestID: 'gt-req-8912',
    sequenceLabel: '#50',
    modelLabel: 'gpt-5.5',
    startedAtLabel: '18:35:10',
    completedAtLabel: '-',
    totalDurationLabel: '8.0s',
    ttftLabel: '620ms',
    firstTokenLabel: '860ms',
    streamDurationLabel: '7.2s',
    averageGapLabel: '72ms',
    longestGapLabel: '360ms',
  });
  assert.doesNotMatch(Object.values(summary).join(' '), /team-codex|websocket|response\.output_text|21,580/);
});

test('sortRequestTimelineRequests keeps newest request rows first without mutating input', () => {
  const session = codexLiveSessionsPreviewSnapshot.sessions[0];
  const originalOrder = session.requests.map((request) => request.requestID);
  const sorted = sortRequestTimelineRequests(session.requests);

  assert.equal(sorted.length, 50);
  assert.deepEqual(sorted.slice(0, 5).map((request) => request.requestID), [
    'gt-req-8912',
    'gt-req-8911',
    'gt-req-8910',
    'gt-req-8909',
    'gt-req-8908',
  ]);
  assert.deepEqual(sorted.slice(-3).map((request) => request.requestID), ['gt-req-8865', 'gt-req-8864', 'gt-req-8863']);
  assert.deepEqual(session.requests.map((request) => request.requestID), originalOrder);
});

test('formatTimelineTimeLabel keeps request rows to clock time', () => {
  const now = new Date('2026-05-21T20:00:00+08:00');

  assert.equal(formatTimelineTimeLabel('2026-05-21T18:35:10+08:00', now), '18:35:10');
  assert.equal(formatTimelineTimeLabel('2026-05-20T18:35:10+08:00', now), '18:35:10');
  assert.equal(formatTimelineTimeLabel('18:14:02.110', now), '18:14:02');
});

test('formatTimelineRequestID keeps only the operator-facing request suffix', () => {
  assert.equal(formatTimelineRequestID('gt-req-8912'), 'REQ-8912');
  assert.equal(formatTimelineRequestID('GT_REQ_ab12'), 'REQ-AB12');
  assert.equal(formatTimelineRequestID('unknown-request'), 'unknow...uest');
});

test('buildFallbackTimelineSummary exposes only fallback time boundaries', () => {
  const fallbackEvents = codexLiveSessionsPreviewSnapshot.sessions.find((session) => session.status === 'failed')?.recentEvents ?? [];
  const summary = buildFallbackTimelineSummary(fallbackEvents, (key) => {
    if (key === 'codex_live_sessions.unknown_request') {
      return 'Unknown request';
    }
    return key;
  });

  assert.equal(summary.requestID, 'Unknown request');
  assert.equal(summary.startedAtLabel, '18:14:02');
  assert.equal(summary.completedAtLabel, '18:14:03');
  assert.equal(summary.totalDurationLabel, 'n/a');
  assert.doesNotMatch(Object.values(summary).join(' '), /upstream\.error|sidecar\.failed|team-codex|websocket/);
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
    'total=8.0s ttft=1.6s first_token=1.8s stream=7.4s queue=18ms auth=44ms connect=391ms avg_gap=82ms max_gap=420ms reconnects=2 output_rate=430/s total_rate=2686/s',
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
        timingSummary: {
          window: 'retained_requests',
          sampleCount: 2,
          sequenceFrom: 4,
          sequenceTo: 5,
          activeIncluded: true,
          generatedAt: '2026-05-21T08:00:02Z',
          averages: {
            totalDurationMs: 2500,
            firstEventMs: 450,
            outputTokensPerSecond: 30,
          },
        },
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
  assert.equal(snapshot.sessions[0].timingSummary?.sampleCount, 2);
  assert.equal(snapshot.sessions[0].timingSummary?.sequenceFrom, 4);
  assert.equal(snapshot.sessions[0].timingSummary?.sequenceTo, 5);
  assert.equal(snapshot.sessions[0].timingSummary?.averages.totalDurationMs, 2500);
  assert.equal(snapshot.sessions[0].recentEvents[0].lane, 'sidecar');
  assert.equal(snapshot.sessions[0].recentEvents[0].severity, 'info');
});

test('mapBackendCodexLiveSessionHistory normalizes request detail history payloads', () => {
  const history = mapBackendCodexLiveSessionHistory({
    window: 'all',
    generatedAt: '2026-05-21T08:00:00Z',
    limit: 20,
    offset: 0,
    items: [
      {
        requestID: 'req-1',
        sessionID: 'ws-session-1',
        sequence: 1,
        model: 'gpt-5.5',
        status: 'completed',
        startedAt: '2026-05-21T08:00:00Z',
        completedAt: '2026-05-21T08:00:02Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: { firstTokenMs: 800, outputTokensPerSecond: 42 },
        timeline: [],
      },
    ],
  });

  assert.equal(history.window, 'all');
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].timing?.outputTokensPerSecond, 42);
});

test('resolveCodexLiveSessionsPollIntervalMs follows workspace visibility and activity', () => {
  assert.equal(
    resolveCodexLiveSessionsPollIntervalMs({
      browserMode: false,
      sidecarReady: true,
      hidden: false,
      activeSessionCount: 1,
    }),
    2000,
  );
  assert.equal(
    resolveCodexLiveSessionsPollIntervalMs({
      browserMode: false,
      sidecarReady: true,
      hidden: false,
      activeSessionCount: 0,
    }),
    8000,
  );
  assert.equal(
    resolveCodexLiveSessionsPollIntervalMs({
      browserMode: false,
      sidecarReady: true,
      hidden: true,
      activeSessionCount: 1,
    }),
    30000,
  );
  assert.equal(
    resolveCodexLiveSessionsPollIntervalMs({
      browserMode: true,
      sidecarReady: true,
      hidden: false,
      activeSessionCount: 1,
    }),
    1000,
  );
  assert.equal(
    resolveCodexLiveSessionsPollIntervalMs({
      browserMode: true,
      sidecarReady: false,
      hidden: false,
      activeSessionCount: 0,
    }),
    1000,
  );
});

test('resolveCodexLiveSessionDetailPollIntervalMs pauses detail polling without a selected session', () => {
  assert.equal(
    resolveCodexLiveSessionDetailPollIntervalMs({
      browserMode: false,
      sidecarReady: true,
      hidden: false,
      hasSelection: true,
    }),
    4000,
  );
  assert.equal(
    resolveCodexLiveSessionDetailPollIntervalMs({
      browserMode: false,
      sidecarReady: true,
      hidden: true,
      hasSelection: true,
    }),
    30000,
  );
  assert.equal(
    resolveCodexLiveSessionDetailPollIntervalMs({
      browserMode: false,
      sidecarReady: true,
      hidden: false,
      hasSelection: false,
    }),
    null,
  );
  assert.equal(
    resolveCodexLiveSessionDetailPollIntervalMs({
      browserMode: true,
      sidecarReady: false,
      hidden: false,
      hasSelection: true,
    }),
    null,
  );
});

test('mergeCodexLiveSessionsSnapshot ignores clock-only live refreshes', () => {
  const anchorMs = Date.parse('2026-05-27T10:00:00+08:00');
  const first = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs, anchorMs);
  const second = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs + 1000, anchorMs);
  const merged = mergeCodexLiveSessionsSnapshot(first, second);

  assert.equal(merged, first);
  assert.equal(merged.sessions[0], first.sessions[0]);
  assert.equal(merged.sessions[0].requests[49], first.sessions[0].requests[49]);
});

test('mergeCodexLiveSessionsSnapshot ignores browser cache preview clock refreshes', () => {
  const anchorMs = Date.parse('2026-05-27T10:00:00+08:00');
  const first = {
    ...buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs, anchorMs),
    source: 'cache',
    sidecarReady: false,
  };
  const second = {
    ...buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs + 1000, anchorMs),
    source: 'cache',
    sidecarReady: false,
  };
  const merged = mergeCodexLiveSessionsSnapshot(first, second);

  assert.equal(merged, first);
  assert.equal(merged.sessions[0], first.sessions[0]);
});

test('mergeCodexLiveSessionsSnapshot updates only structurally changed sessions', () => {
  const first = codexLiveSessionsPreviewSnapshot;
  const changed = {
    ...first,
    generatedAt: '2026-05-27T10:00:00+08:00',
    sessions: first.sessions.map((session) =>
      session.sessionID === 'ws_sess_4c27'
        ? {
            ...session,
            status: 'failed',
          }
        : session,
    ),
  };
  const merged = mergeCodexLiveSessionsSnapshot(first, changed);

  assert.notEqual(merged, first);
  assert.equal(merged.generatedAt, changed.generatedAt);
  assert.equal(merged.sessions[0], first.sessions[0]);
  assert.notEqual(merged.sessions[1], first.sessions[1]);
  assert.equal(merged.sessions[2], first.sessions[2]);
});

test('codex live session surfaces use larger typography tokens for the dense workbench', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');
  const feedSource = await readFile(new URL('./components/CodexLiveSessionFeed.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /RequestTimingTrend/);
  assert.match(detailSource, /font-size-ui-lg/);
  assert.match(detailSource, /font-size-ui-sm/);
  assert.match(detailSource, /font-size-ui-xs/);
  assert.match(feedSource, /font-size-ui-xl/);
  assert.match(feedSource, /font-size-ui-lg/);
  assert.match(feedSource, /font-size-ui-sm/);
});

test('codex live session feed renders session id as an independent copy target', async () => {
  const feedSource = await readFile(new URL('./components/CodexLiveSessionFeed.tsx', import.meta.url), 'utf8');

  assert.match(feedSource, /copyCodexLiveSessionID/);
  assert.match(feedSource, /onCopySessionID/);
  assert.match(feedSource, /event\.stopPropagation\(\)/);
  assert.match(feedSource, /\`\$\{t\('codex_live_sessions\.copy_session_id'\)\} \$\{summary\.sessionIDLabel\}\`/);
  assert.match(feedSource, /className=\{`inline-flex h-6 shrink-0 items-center justify-center/);
  assert.match(feedSource, /ClipboardSetText/);
  assert.match(feedSource, /document\.execCommand\('copy'\)/);
  assert.match(feedSource, /aria-live="polite"/);
  assert.match(feedSource, /t\('codex_live_sessions\.copied'\)/);
  assert.match(feedSource, /t\('codex_live_sessions\.session_button'\)/);
  assert.match(feedSource, /codex_live_sessions\.copy_session_id/);
});

test('codex live session detail timeline renders request monitor fields instead of event-only rows', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /function Timeline\(\{\s+requests,/);
  assert.match(detailSource, /request\.requestID/);
  assert.match(detailSource, /request\.clientRequestID/);
  assert.match(detailSource, /request\.upstreamRequestID/);
  assert.match(detailSource, /request\.authLabel/);
  assert.match(detailSource, /request\.timing/);
  assert.match(detailSource, /request\.usage/);
  assert.match(detailSource, /request\.error/);
  assert.doesNotMatch(detailSource, /md:grid-cols-\[5\.2rem_8rem_1fr\]/);
});

test('codex live session detail timeline uses compact rows without horizontal table scroll', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');
  const timelineSource = detailSource.slice(
    detailSource.indexOf('function Timeline('),
    detailSource.indexOf('function TimelineRequestRow('),
  );

  assert.match(detailSource, /function buildTimingMetricRows\(/);
  const timingMetricsSource = detailSource.slice(
    detailSource.indexOf('function TimingMetrics('),
    detailSource.indexOf('function AccountCard('),
  );
  const requestDetailMetricsSource = detailSource.slice(
    detailSource.indexOf('const metricRows: Array<[string, string]>'),
    detailSource.indexOf('return (', detailSource.indexOf('const metricRows: Array<[string, string]>')),
  );
  assert.match(timingMetricsSource, /timing_ttft[\s\S]*timing_first_token[\s\S]*timing_stream[\s\S]*timing_queue[\s\S]*timing_auth[\s\S]*timing_connect/);
  assert.doesNotMatch(timingMetricsSource, /timing_total/);
  assert.doesNotMatch(timingMetricsSource, /timing_total_rate/);
  assert.doesNotMatch(requestDetailMetricsSource, /timing_total/);
  assert.doesNotMatch(requestDetailMetricsSource, /tokens_total/);
  assert.match(detailSource, /reduce<TimingMetricRow\[\]>/);
  assert.match(detailSource, /entry\.value !== 'n\/a'/);
  assert.match(detailSource, /no_timing_data/);
  assert.match(detailSource, /buildTimelineMetricItems/);
  assert.match(detailSource, /isTimelineValuePresent/);
  assert.match(detailSource, /TimelineMetricPill/);
  assert.match(detailSource, /const requestTimelineVisibleLimit = 15/);
  assert.match(timelineSource, /visibleRequests = sortedRequests\.slice\(0, requestTimelineVisibleLimit\)/);
  assert.match(timelineSource, /visibleRowCount/);
  assert.match(timelineSource, /visibleRequests\.map/);
  assert.doesNotMatch(timelineSource, /sortedRequests\.map/);
  assert.match(detailSource, /function TimelineSummaryRow/);
  assert.match(detailSource, /onClick=\{onOpen\}/);
  assert.match(detailSource, /formatTimelineRequestID/);
  assert.match(detailSource, /summary\.firstTokenLabel/);
  assert.match(detailSource, /priority >= 3 \? 'hidden xl:inline-flex' : 'inline-flex'/);
  assert.doesNotMatch(detailSource, /priority >= 2 \? 'hidden sm:inline-flex'/);
  assert.match(detailSource, /grid-cols-\[auto_auto_minmax\(0,1fr\)_auto\]/);
  assert.match(detailSource, /flex-nowrap/);
  assert.match(detailSource, /whitespace-nowrap/);
  assert.doesNotMatch(detailSource, /flex-wrap items-center gap-x-3/);
  assert.doesNotMatch(timelineSource, /overflow-x-auto/);
  assert.doesNotMatch(timelineSource, /min-w-\[1320px\]/);
  assert.doesNotMatch(detailSource, /function TimelineHeader/);
  assert.doesNotMatch(detailSource, /from 'lucide-react'/);
  assert.doesNotMatch(detailSource, /btn-swiss inline-flex h-8 w-8/);
});

test('codex live session detail does not render the redacted diagnostic block', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(detailSource, /DiagnosticSummary/);
  assert.doesNotMatch(detailSource, /SnippetPre/);
  assert.doesNotMatch(detailSource, /redacted_diagnostic/);
});

test('codex live session surfaces avoid nested card shells in the dense workbench', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');
  const workbenchSource = await readFile(new URL('./components/CodexLiveSessionsWorkbench.tsx', import.meta.url), 'utf8');
  const filterSource = workbenchSource.slice(
    workbenchSource.indexOf('<SearchInput'),
    workbenchSource.indexOf('<div className="grid min-h-[620px]'),
  );
  const timingTrendSource = detailSource.slice(
    detailSource.indexOf('function RequestTimingTrend('),
    detailSource.indexOf('function TimingTrendFooterItem('),
  );

  assert.match(detailSource, /className="grid max-h-\[calc\(100vh-13rem\)\] min-w-0 w-full gap-5 overflow-y-auto overscroll-contain pr-1 scrollbar-stable"/);
  assert.match(timingTrendSource, /<section className="grid min-w-0 gap-3"/);
  assert.doesNotMatch(timingTrendSource, /className="min-w-0 border border-\[color:color-mix\(in_srgb,var\(--border-color\)_40%,transparent\)\] bg-\[color:color-mix\(in_srgb,var\(--bg-main\)_72%,var\(--bg-surface\)\)\] p-4 shadow/);
  assert.doesNotMatch(detailSource, /className="min-w-0 w-full border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] shadow-\[6px_6px_0_var\(--shadow-color\)\]"/);
  assert.doesNotMatch(detailSource, /grid gap-5 border-b-2 border-\[var\(--border-color\)\] p-4/);
  assert.match(workbenchSource, /className="grid min-w-0 gap-2 lg:grid-cols-\[minmax\(260px,1fr\)_auto\]"/);
  assert.doesNotMatch(workbenchSource, /className="grid gap-3 border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] p-3 shadow-\[6px_6px_0_var\(--shadow-color\)\]/);
  assert.doesNotMatch(filterSource, /border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] p-3/);
});

test('codex live session detail uses fluid regions with bounded live growth and contained scrolling', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');
  const workbenchSource = await readFile(new URL('./components/CodexLiveSessionsWorkbench.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(detailSource, /grid-rows-\[2\.5rem_\d+px_\d+px_\d+px\]/);
  assert.doesNotMatch(detailSource, /grid-rows-\[\d+px_\d+px_\d+px\]/);
  assert.match(detailSource, /data-codex-session-detail-root="true"/);
  assert.match(detailSource, /max-h-\[calc\(100vh-13rem\)\]/);
  assert.match(detailSource, /overflow-y-auto/);
  assert.match(detailSource, /overscroll-contain/);
  assert.match(detailSource, /scrollbar-stable/);
  assert.match(detailSource, /className="grid min-w-0 gap-3" data-codex-detail-section="analysis"/);
  assert.doesNotMatch(detailSource, /<div className="h-10" aria-hidden="true" \/>/);
  assert.match(detailSource, /className="grid min-w-0 gap-5 2xl:grid-cols-2" data-codex-detail-section="metadata"/);
  for (const slot of ['status', 'trend', 'metrics', 'timeline', 'account', 'session', 'transport']) {
    assert.match(detailSource, new RegExp(`data-codex-detail-slot="${slot}"`));
  }
  assert.match(detailSource, /className="overflow-hidden" data-codex-detail-slot="status"/);
  assert.match(detailSource, /className="min-w-0" data-codex-detail-slot="timeline"/);
  assert.match(detailSource, /data-codex-detail-slot="account"[\s\S]*?<AccountCard/);
  assert.match(detailSource, /data-codex-detail-slot="session"[\s\S]*?<SessionCard/);
  assert.match(detailSource, /data-codex-detail-slot="transport"[\s\S]*?<TransportLane/);
  assert.match(detailSource, /className="min-w-0" data-codex-detail-slot="account"/);
  assert.match(detailSource, /className="min-w-0" data-codex-detail-slot="session"/);
  assert.match(detailSource, /className="min-w-0 2xl:col-span-2" data-codex-detail-slot="transport"/);
  assert.match(detailSource, /className="grid min-h-\[320px\] max-h-\[clamp\(360px,42vh,560px\)\] grid-rows-\[auto_minmax\(0,1fr\)\] gap-3"/);
  assert.match(detailSource, /className="min-h-0 overflow-y-auto border border-\[color:color-mix\(in_srgb,var\(--border-color\)_34%,transparent\)\] bg-\[color:color-mix\(in_srgb,var\(--bg-main\)_82%,var\(--bg-surface\)\)\] scrollbar-stable"/);
  assert.match(workbenchSource, /xl:grid-cols-\[minmax\(280px,340px\)_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(workbenchSource, /xl:sticky/);
  assert.doesNotMatch(workbenchSource, /xl:max-h-\[calc\(100vh-2\.5rem\)\]/);
  assert.doesNotMatch(workbenchSource, /xl:overscroll-contain/);
});

test('codex live session detail header uses request timing trend chart', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /useState<CodexLiveTimingTrendMetric>\('firstEventMs'\)/);
  assert.match(detailSource, /<RequestTimingTrend session=\{session\} request=\{request\} selectedMetric=\{selectedTimingMetric\} t=\{t\} \/>/);
  assert.match(detailSource, /<TimingMetrics[\s\S]*selectedMetric=\{selectedTimingMetric\}[\s\S]*onSelectMetric=\{setSelectedTimingMetric\}/);
  assert.match(detailSource, /<RequestTimingTrend[\s\S]*?<TimingMetrics[\s\S]*?<Timeline[\s\S]*?<AccountCard/);
  assert.match(detailSource, /function RequestTimingTrend/);
  assert.match(detailSource, /buildCodexLiveRequestTimingTrend/);
  const trendSeriesSource = detailSource.slice(
    detailSource.indexOf('const timingTrendSeries'),
    detailSource.indexOf('const requestTimelineVisibleLimit'),
  );
  assert.doesNotMatch(trendSeriesSource, /timing_total/);
  assert.match(detailSource, /function TimingTrendChart/);
  assert.match(detailSource, /flex min-w-0 flex-wrap items-start justify-between/);
  assert.match(detailSource, /flex-nowrap items-center justify-end/);
  assert.match(detailSource, /\{session\.model\}[\s\S]*?·[\s\S]*?\{session\.downstreamTransport\} → \{session\.upstreamTransport\}/);
  assert.doesNotMatch(detailSource, /xl:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.doesNotMatch(detailSource, /<div className="mt-1 truncate">\{session\.downstreamTransport\} → \{session\.upstreamTransport\}<\/div>/);
  assert.match(detailSource, /TimingTrendFooterItem label=\{t\('codex_live_sessions\.duration'\)\}/);
  assert.doesNotMatch(detailSource, /min-h-\[166px\][^"]*border[^"]*bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(detailSource, /font-size-ui-5xl/);
});

test('codex live sessions feature splits row snapshot polling from detail history loading', async () => {
  const featureSource = await readFile(new URL('./CodexLiveSessionsFeature.tsx', import.meta.url), 'utf8');

  assert.match(featureSource, /GetCodexLiveSessionsSnapshot/);
  assert.match(featureSource, /GetCodexLiveSessionHistory/);
  assert.match(featureSource, /document\.visibilityState/);
  assert.match(featureSource, /resolveCodexLiveSessionsPollIntervalMs/);
  assert.match(featureSource, /resolveCodexLiveSessionDetailPollIntervalMs/);
  assert.match(featureSource, /detailRequestVersionRef/);
});

test('buildCodexLiveRequestTimingTrend orders request timing metrics by request start time', () => {
  const trend = buildCodexLiveRequestTimingTrend(
    [
      {
        requestID: 'req-b',
        sessionID: 'session-1',
        sequence: 2,
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-05-21T08:02:00Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: { totalDurationMs: 2400, firstEventMs: 520, firstTokenMs: 760 },
        timeline: [],
      },
      {
        requestID: 'req-a',
        sessionID: 'session-1',
        sequence: 1,
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-05-21T08:00:00Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: { totalDurationMs: 1800, firstEventMs: 400, firstTokenMs: 650 },
        timeline: [],
      },
    ],
    {
      requestID: 'req-c',
      sessionID: 'session-1',
      sequence: 3,
      model: 'gpt-5',
      status: 'streaming',
      startedAt: '2026-05-21T08:04:00Z',
      downstreamTransport: 'websocket',
      upstreamTransport: 'websocket',
      timing: { firstTokenMs: 900 },
      timeline: [],
    },
  );

  assert.deepEqual(trend.points.map((point) => point.requestID), ['req-a', 'req-b', 'req-c']);
  assert.deepEqual(trend.points.map((point) => point.values.totalDurationMs), [1800, 2400, null]);
  assert.deepEqual(trend.points.map((point) => point.values.firstTokenMs), [650, 760, 900]);
  assert.equal(trend.maxMs, 2400);
  assert.equal(trend.hasData, true);
});

test('buildCodexLiveRequestTimingTrend projects active request duration from current time', () => {
  const trend = buildCodexLiveRequestTimingTrend(
    [],
    {
      requestID: 'req-live',
      sessionID: 'session-1',
      sequence: 1,
      model: 'gpt-5',
      status: 'streaming',
      startedAt: '2026-05-21T08:00:00Z',
      downstreamTransport: 'websocket',
      upstreamTransport: 'websocket',
      timing: { firstEventMs: 420, firstTokenMs: 760 },
      timeline: [],
    },
    { nowMs: Date.parse('2026-05-21T08:00:07Z') },
  );

  assert.equal(trend.points[0].values.totalDurationMs, 7000);
  assert.equal(trend.points[0].isLive, true);
  assert.equal(trend.maxMs, 7000);
});

test('buildCodexLiveRequestTimingTrend only projects the current active request', () => {
  const staleStreamingRequest = {
    requestID: 'req-stale',
    sessionID: 'session-1',
    sequence: 1,
    model: 'gpt-5',
    status: 'streaming',
    startedAt: '2026-05-21T08:00:00Z',
    downstreamTransport: 'websocket',
    upstreamTransport: 'websocket',
    timing: { totalDurationMs: 1800, firstEventMs: 400, firstTokenMs: 650 },
    timeline: [],
  };
  const activeRequest = {
    requestID: 'req-live',
    sessionID: 'session-1',
    sequence: 2,
    model: 'gpt-5',
    status: 'streaming',
    startedAt: '2026-05-21T08:00:05Z',
    downstreamTransport: 'websocket',
    upstreamTransport: 'websocket',
    timing: { firstEventMs: 420, firstTokenMs: 760 },
    timeline: [],
  };

  const trend = buildCodexLiveRequestTimingTrend(
    [staleStreamingRequest],
    activeRequest,
    { nowMs: Date.parse('2026-05-21T08:00:12Z') },
  );

  assert.deepEqual(trend.points.map((point) => point.requestID), ['req-stale', 'req-live']);
  assert.deepEqual(trend.points.map((point) => point.values.totalDurationMs), [1800, 7000]);
  assert.deepEqual(trend.points.map((point) => point.isLive), [false, true]);
});

test('buildCodexLiveRequestTimingMetricAverages summarizes the timing trend window', () => {
  const averages = buildCodexLiveRequestTimingMetricAverages(
    [
      {
        requestID: 'req-a',
        sessionID: 'session-1',
        sequence: 1,
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-05-21T08:00:00Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: {
          totalDurationMs: 1800,
          firstEventMs: 400,
          firstTokenMs: 650,
          outputTokensPerSecond: 20,
          totalTokensPerSecond: 200,
          reconnectCount: 0,
        },
        timeline: [],
      },
      {
        requestID: 'req-b',
        sessionID: 'session-1',
        sequence: 2,
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-05-21T08:02:00Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: {
          totalDurationMs: 2400,
          firstEventMs: 520,
          firstTokenMs: 760,
          outputTokensPerSecond: 40,
          totalTokensPerSecond: 400,
          reconnectCount: 1,
        },
        timeline: [],
      },
    ],
    {
      requestID: 'req-live',
      sessionID: 'session-1',
      sequence: 3,
      model: 'gpt-5',
      status: 'streaming',
      startedAt: '2026-05-21T08:04:00Z',
      downstreamTransport: 'websocket',
      upstreamTransport: 'websocket',
      timing: {
        firstEventMs: 420,
        firstTokenMs: 900,
        outputTokensPerSecond: 60,
        totalTokensPerSecond: 600,
        reconnectCount: 0,
      },
      timeline: [],
    },
    { nowMs: Date.parse('2026-05-21T08:04:07Z') },
  );

  assert.equal(averages.values.totalDurationMs, 3733);
  assert.equal(averages.values.firstEventMs, 447);
  assert.equal(averages.values.firstTokenMs, 770);
  assert.equal(averages.values.outputTokensPerSecond, 40);
  assert.equal(averages.values.totalTokensPerSecond, 400);
  assert.equal(averages.values.reconnectCount, 0);
  assert.equal(averages.sampleCount, 3);
});

test('resolveCodexLiveTimingMetricSummary prefers sidecar summary over local request averages', () => {
  const summary = resolveCodexLiveTimingMetricSummary(
    {
      sessionID: 'session-1',
      status: 'streaming',
      startedAt: '2026-05-21T08:00:00Z',
      lastEventAt: '2026-05-21T08:04:07Z',
      durationMs: 247000,
      requestCount: 2,
      activeRequestID: 'req-b',
      lastRequestID: 'req-b',
      model: 'gpt-5',
      downstreamTransport: 'websocket',
      upstreamTransport: 'websocket',
      recentEvents: [],
      timingSummary: {
        window: 'retained_requests',
        sampleCount: 2,
        sequenceFrom: 10,
        sequenceTo: 11,
        activeIncluded: true,
        generatedAt: '2026-05-21T08:04:07Z',
        averages: {
          totalDurationMs: 1234,
          firstEventMs: 456,
          outputTokensPerSecond: 78,
        },
      },
      requests: [
        {
          requestID: 'req-a',
          sessionID: 'session-1',
          sequence: 10,
          model: 'gpt-5',
          status: 'completed',
          startedAt: '2026-05-21T08:00:00Z',
          downstreamTransport: 'websocket',
          upstreamTransport: 'websocket',
          timing: { totalDurationMs: 9000, firstEventMs: 900 },
          timeline: [],
        },
      ],
    },
    undefined,
    { nowMs: Date.parse('2026-05-21T08:04:07Z') },
  );

  assert.equal(summary.source, 'sidecar');
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.sequenceFrom, 10);
  assert.equal(summary.sequenceTo, 11);
  assert.equal(summary.values.totalDurationMs, 1234);
  assert.equal(summary.values.firstEventMs, 456);
  assert.equal(summary.values.outputTokensPerSecond, 78);
});

test('buildCodexLiveRequestTimingTrend keeps only latest requests inside a fixed count window', () => {
  const trend = buildCodexLiveRequestTimingTrend(
    [
      {
        requestID: 'req-old',
        sessionID: 'session-1',
        sequence: 1,
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-05-21T08:00:00Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: { totalDurationMs: 12000, firstEventMs: 400, firstTokenMs: 650 },
        timeline: [],
      },
      {
        requestID: 'req-recent',
        sessionID: 'session-1',
        sequence: 2,
        model: 'gpt-5',
        status: 'completed',
        startedAt: '2026-05-21T08:09:00Z',
        downstreamTransport: 'websocket',
        upstreamTransport: 'websocket',
        timing: { totalDurationMs: 2400, firstEventMs: 520, firstTokenMs: 760 },
        timeline: [],
      },
    ],
    {
      requestID: 'req-latest',
      sessionID: 'session-1',
      sequence: 3,
      model: 'gpt-5',
      status: 'streaming',
      startedAt: '2026-05-21T08:10:00Z',
      downstreamTransport: 'websocket',
      upstreamTransport: 'websocket',
      timing: { totalDurationMs: 4200, firstEventMs: 620, firstTokenMs: 900 },
      timeline: [],
    },
    { maxPoints: 2 },
  );

  assert.deepEqual(trend.points.map((point) => point.requestID), ['req-recent', 'req-latest']);
  assert.equal(trend.maxMs, 4200);
  assert.equal(trend.startedAtMinMs, Date.parse('2026-05-21T08:09:00Z'));
  assert.equal(trend.startedAtMaxMs, Date.parse('2026-05-21T08:10:00Z'));
  assert.equal(trend.maxPoints, 2);
});

test('codex live sessions preview data gives the default detail chart capped rolling timing samples', () => {
  const selectedSession = getSelectedCodexLiveSession(codexLiveSessionsPreviewSnapshot.sessions);
  assert.ok(selectedSession);
  const selectedRequest = getPrimaryCodexLiveRequest(selectedSession);
  const trend = buildCodexLiveRequestTimingTrend(selectedSession.requests, selectedRequest);

  assert.equal(selectedSession.sessionID, 'ws_sess_7a91');
  assert.equal(selectedRequest?.requestID, 'gt-req-8912');
  assert.equal(selectedSession.requestCount, selectedSession.requests.length);
  assert.equal(selectedSession.requests.length, 50);
  assert.equal(trend.points.length, 50);
  assert.deepEqual(trend.points.slice(0, 3).map((point) => point.requestID), ['gt-req-8863', 'gt-req-8864', 'gt-req-8865']);
  assert.deepEqual(trend.points.slice(-3).map((point) => point.requestID), ['gt-req-8910', 'gt-req-8911', 'gt-req-8912']);
  assert.deepEqual(trend.points.slice(-3).map((point) => point.sequence), [48, 49, 50]);
  assert.equal(trend.points[trend.points.length - 1]?.isLive, true);
  assert.equal(trend.startedAtMinMs, Date.parse('2026-05-21T18:30:16+08:00'));
  assert.equal(trend.startedAtMaxMs, Date.parse('2026-05-21T18:35:10+08:00'));
  assert.equal(trend.maxPoints, 50);
});

test('buildAnimatedCodexLiveSessionsPreviewSnapshot keeps browser preview live over time', () => {
  const anchorMs = Date.parse('2026-05-27T10:00:00+08:00');
  const first = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs, anchorMs);
  const second = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs + 1000, anchorMs);

  const firstSession = getSelectedCodexLiveSession(first.sessions);
  const secondSession = getSelectedCodexLiveSession(second.sessions);
  const firstRequest = getPrimaryCodexLiveRequest(firstSession);
  const secondRequest = getPrimaryCodexLiveRequest(secondSession);

  assert.ok(firstSession);
  assert.ok(secondSession);
  assert.ok(firstRequest);
  assert.ok(secondRequest);
  assert.equal(first.source, 'preview');
  assert.equal(second.source, 'preview');
  assert.equal(firstSession.startedAt, secondSession.startedAt);
  assert.ok((secondSession.durationMs ?? 0) > (firstSession.durationMs ?? 0));
  assert.ok((secondRequest?.timing?.totalDurationMs ?? 0) > (firstRequest?.timing?.totalDurationMs ?? 0));

  const firstCompletedTiming = new Map(
    firstSession.requests
      .filter((request) => request.completedAt)
      .map((request) => [request.requestID, request.timing?.totalDurationMs]),
  );
  const changedCompletedRequests = secondSession.requests.filter((request) => (
    request.completedAt &&
    firstCompletedTiming.has(request.requestID) &&
    firstCompletedTiming.get(request.requestID) !== request.timing?.totalDurationMs
  ));
  assert.deepEqual(changedCompletedRequests.map((request) => request.requestID), []);
});

test('buildAnimatedCodexLiveSessionsPreviewSnapshot advances labels with a capped rolling request window', () => {
  const anchorMs = Date.parse('2026-05-27T10:00:00+08:00');
  const first = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs, anchorMs);
  const second = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs + 6000, anchorMs);

  const firstSession = getSelectedCodexLiveSession(first.sessions);
  const secondSession = getSelectedCodexLiveSession(second.sessions);
  const firstRequest = getPrimaryCodexLiveRequest(firstSession);
  const secondRequest = getPrimaryCodexLiveRequest(secondSession);

  assert.ok(firstSession);
  assert.ok(secondSession);
  assert.equal(firstSession.requests.length, 50);
  assert.equal(secondSession.requests.length, 50);
  assert.equal(firstRequest?.sequence, 50);
  assert.equal(secondRequest?.sequence, 51);
  assert.equal(secondSession.requests[0]?.sequence, 2);
  assert.equal(secondRequest?.requestID, 'gt-req-8913');

  const firstCompletedTiming = new Map(
    firstSession.requests
      .filter((request) => request.completedAt)
      .map((request) => [request.requestID, request.timing?.totalDurationMs]),
  );
  const overlappingCompletedRequests = secondSession.requests.filter((request) => (
    request.completedAt &&
    firstCompletedTiming.has(request.requestID)
  ));
  assert.ok(overlappingCompletedRequests.length > 40);
  assert.deepEqual(
    overlappingCompletedRequests.filter((request) => firstCompletedTiming.get(request.requestID) !== request.timing?.totalDurationMs),
    [],
  );
});

test('buildAnimatedCodexLiveSessionsPreviewSnapshot keeps live sample below realistic completed spikes', () => {
  const anchorMs = Date.parse('2026-05-27T10:00:00+08:00');
  const snapshot = buildAnimatedCodexLiveSessionsPreviewSnapshot(anchorMs + 3000, anchorMs);
  const session = getSelectedCodexLiveSession(snapshot.sessions);
  const activeRequest = getPrimaryCodexLiveRequest(session);
  const completedMaxMs = Math.max(
    ...session.requests
      .filter((request) => request.completedAt)
      .map((request) => request.timing?.totalDurationMs ?? 0),
  );

  assert.ok(session);
  assert.ok(activeRequest);
  assert.equal(activeRequest.completedAt, undefined);
  assert.ok(completedMaxMs >= 24000);
  assert.ok((activeRequest.timing?.totalDurationMs ?? 0) < completedMaxMs);
});

test('codex live session timing chart uses a latency line chart and live refresh', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /setInterval/);
  assert.match(detailSource, /nowMs/);
  assert.match(detailSource, /buildTimingTrendLinePoints/);
  assert.match(detailSource, /buildTimingTrendLinePath/);
  assert.match(detailSource, /buildTimingTrendAreaPath/);
  assert.match(detailSource, /selectedMetric: CodexLiveTimingTrendMetric/);
  assert.match(detailSource, /timingTrendPointStepPx/);
  assert.match(detailSource, /visibleRequestCount = resolveTimingTrendVisibleRequestCount\(width, padding\)/);
  assert.match(detailSource, /visiblePoints = trend\.points\.slice\(-visibleRequestCount\)/);
  assert.match(detailSource, /getTimingTrendMetricMax\(visiblePoints, selectedMetric\)/);
  assert.match(detailSource, /data-codex-timing-latency-chart/);
  assert.match(detailSource, /data-codex-timing-line-path/);
  assert.match(detailSource, /data-codex-timing-area-path/);
  assert.match(detailSource, /data-codex-timing-point/);
  assert.match(detailSource, /resolveTimingTrendBarX\(index, points\.length, width, padding\)/);
  assert.match(detailSource, /#\{point\.sequence\}/);
  assert.doesNotMatch(detailSource, /buildTimingTrendWaveformBars/);
  assert.doesNotMatch(detailSource, /data-codex-timing-waveform/);
  assert.doesNotMatch(detailSource, /strokeDasharray=\{point\.isLive/);
  assert.doesNotMatch(detailSource, /trendChartX/);
  assert.doesNotMatch(detailSource, /visibleStartedAtMinMs/);
  assert.doesNotMatch(detailSource, /resolveTimingTrendPointXMs/);
});

test('codex live session timing chart reserves y-axis labels for latency values', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /function resolveTimingTrendChartPadding/);
  assert.match(detailSource, /const padding = resolveTimingTrendChartPadding\(/);
  assert.match(detailSource, /left: 52/);
  assert.match(detailSource, /right: 18/);
  assert.match(detailSource, /formatDuration\(selectedMetricMaxMs \* \(1 - ratio\)\)/);
  assert.match(detailSource, /data-codex-timing-grid-line/);
  assert.doesNotMatch(detailSource, /timingTrendLiveRingRadiusPx/);
  assert.doesNotMatch(detailSource, /timingTrendYAxisLabelSafeWidthPx/);
});

test('codex live session timing chart puts request sequence into bottom ticks', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /timingTrendSequenceTickMinGapPx/);
  assert.match(detailSource, /function resolveTimingTrendSequenceTickIndexes/);
  assert.match(detailSource, /sequenceTickIndexes = resolveTimingTrendSequenceTickIndexes\(chartPoints, selectedRequestID\)/);
  assert.match(detailSource, /sequenceTickIndexes\.has\(index\)/);
  assert.match(detailSource, /data-codex-timing-sequence-tick/);
  assert.match(detailSource, /y1=\{height - padding\.bottom \+ 10\}/);
  assert.match(detailSource, /y=\{height - 8\}/);
  assert.match(detailSource, /Math\.abs\(point\.x - existingX\) >= timingTrendSequenceTickMinGapPx/);
  assert.doesNotMatch(detailSource, /resolveTimingTrendAxisLabelIndexes/);
  assert.doesNotMatch(detailSource, /axisLabelIndexes/);
  assert.doesNotMatch(detailSource, /shouldShowTimingTrendAxisLabel/);
});

test('codex live session timing chart uses a fixed viewport without horizontal panning', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /chartShellRef/);
  assert.match(detailSource, /useLayoutEffect/);
  assert.match(detailSource, /timingTrendChartFallbackWidthPx/);
  assert.match(detailSource, /ResizeObserver/);
  assert.match(detailSource, /element\.clientWidth/);
  assert.match(detailSource, /const width = chartWidth > 0 \? chartWidth : timingTrendChartFallbackWidthPx/);
  assert.match(detailSource, /const svgWidthStyle = chartWidth > 0 \? '100%' : `\$\{timingTrendChartFallbackWidthPx\}px`/);
  assert.match(detailSource, /preserveAspectRatio="xMinYMin meet"/);
  assert.match(detailSource, /style=\{\{ width: svgWidthStyle \}\}/);
  assert.doesNotMatch(detailSource, /visibility: .*'hidden'/);
  assert.doesNotMatch(detailSource, /preserveAspectRatio="none"/);
  assert.doesNotMatch(detailSource, /chartWidth \|\| 0/);
  assert.match(detailSource, /resolveTimingTrendVisibleRequestCount/);
  assert.match(detailSource, /timingTrendMinVisiblePoints/);
  assert.match(detailSource, /timingTrendPointStepPx/);
  assert.match(detailSource, /className="overflow-hidden border border-\[color:color-mix\(in_srgb,var\(--border-color\)_24%,transparent\)\] bg-\[color:color-mix\(in_srgb,var\(--bg-main\)_92%,var\(--bg-surface\)\)\]"/);
  assert.doesNotMatch(detailSource, /resolveTimingTrendVisibleWindowMs/);
  assert.doesNotMatch(detailSource, /timingTrendStripFullWindowWidthPx/);
  assert.doesNotMatch(detailSource, /overflow-x-auto/);
  assert.doesNotMatch(detailSource, /scrollContainerRef/);
  assert.doesNotMatch(detailSource, /autoFollowLatest/);
  assert.doesNotMatch(detailSource, /requestAnimationFrame/);
  assert.doesNotMatch(detailSource, /onPointerMove/);
});

test('codex live session timing chart follows low-noise line chart primitives', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /codex-live-chart-enter/);
  assert.match(detailSource, /codex-live-point-pulse/);
  assert.match(detailSource, /key=\{`\$\{selectedMetric\}-latency-trend-layer`\}/);
  assert.match(detailSource, /data-codex-timing-line-layer/);
  assert.match(detailSource, /function buildTimingTrendLinePoints/);
  assert.match(detailSource, /interface TimingTrendLinePoint/);
  assert.match(detailSource, /y: number/);
  assert.match(detailSource, /strokeLinejoin="round"/);
  assert.match(detailSource, /strokeWidth="2\.5"/);
  assert.match(detailSource, /stroke=\{selectedSeries\.color\}/);
  assert.doesNotMatch(detailSource, /backgroundImage:/);
  assert.doesNotMatch(detailSource, /function TimingTrendPoint/);
  assert.doesNotMatch(detailSource, /buildTimingTrendPointStyle/);
  assert.doesNotMatch(detailSource, /shouldShowTimingTrendMarker/);
  assert.doesNotMatch(detailSource, /strokeWidth=\{point\.requestID === selectedRequestID \? 10 : 7\}/);
  assert.doesNotMatch(detailSource, /strokeDasharray="2 3"/);
  assert.doesNotMatch(detailSource, /border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] shadow-\[inset_0_12px_16px_-12px/);
  assert.doesNotMatch(detailSource, /buildTimingTrendWaveformBars/);
  assert.doesNotMatch(detailSource, /interface TimingTrendWaveformBar/);
  assert.doesNotMatch(detailSource, /codex-live-strip-enter/);
  assert.doesNotMatch(detailSource, /codex-live-ring-breathe/);
  assert.doesNotMatch(detailSource, /barShape/);
  assert.doesNotMatch(detailSource, /primary: boolean/);
  assert.doesNotMatch(detailSource, /buildTimingTrendEcgPath/);
  assert.doesNotMatch(detailSource, /buildTimingTrendLollipopPoints/);
  assert.doesNotMatch(detailSource, /lollipop/i);
  assert.doesNotMatch(detailSource, /heartbeat strip/i);
  assert.doesNotMatch(detailSource, /selectedWavePath/);
  assert.doesNotMatch(detailSource, /strokeLinejoin="miter"/);
  assert.doesNotMatch(detailSource, /strokeDasharray="1"/);
  assert.doesNotMatch(detailSource, /pathLength="1"/);
  assert.doesNotMatch(detailSource, /timingTrendSeries\.map\(\(series\)[\s\S]*buildTimingTrendWaveformBars/);
  assert.doesNotMatch(detailSource, /buildTimingTrendSeriesPath/);
  assert.doesNotMatch(detailSource, /codex-live-total-area/);
});

test('codex live session timing metrics switch the single trend metric', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /interface TimingMetricRow/);
  assert.match(detailSource, /trendMetric\?: CodexLiveTimingTrendMetric/);
  assert.match(detailSource, /onClick=\{\(\) => onSelectMetric\(trendMetric\)\}/);
  assert.match(detailSource, /aria-pressed=\{selected\}/);
  assert.match(detailSource, /trendMetric: 'streamDurationMs'/);
  assert.match(detailSource, /trendMetric: 'longestEventGapMs'/);
  assert.match(detailSource, /timing_average/);
  assert.match(detailSource, /useState<CodexLiveTimingTrendMetric>\('firstEventMs'\)/);
  assert.doesNotMatch(detailSource, /buildTimingSummaryMeta/);
  assert.doesNotMatch(detailSource, /timing_summary_sidecar/);
  assert.doesNotMatch(detailSource, /timing_summary_fallback/);
  assert.doesNotMatch(detailSource, /summaryMeta/);
  assert.doesNotMatch(detailSource, /trendMetric: 'totalDurationMs'/);
  assert.doesNotMatch(detailSource, /trendMetric: 'reconnectCount'/);
  assert.doesNotMatch(detailSource, /trendMetric: 'outputTokensPerSecond'/);
  assert.doesNotMatch(detailSource, /trendMetric: 'totalTokensPerSecond'/);
});

test('codex live session account block reuses account attribution card presentation', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /from '..\/..\/accounts\/components\/AttributionCard'/);
  assert.match(detailSource, /<AttributionCard/);
  assert.match(detailSource, /buildLiveAccountUsageSummary/);
  assert.doesNotMatch(detailSource, /function UsageStat/);
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
