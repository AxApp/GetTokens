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
import {
  buildLiveSessionBillingDisplay,
  buildLiveSessionQuotaDisplay,
} from './components/accountCardAdapters.ts';
import {
  buildFallbackTimelineSummary,
  buildRequestTimelineSummary,
  formatTimelineRequestID,
  formatTimelineTimeLabel,
} from './components/requestTimelineSummary.ts';
import {
  buildCodexLiveSessionsInitialSnapshot,
  buildCodexLiveSessionsLoadFailureSnapshot,
} from './model/snapshotState.ts';
import { mapBackendCodexLiveSessionsSnapshot } from './model/adapters.ts';
import { codexLiveSessionsPreviewSnapshot } from './model/mockData.ts';
import { buildCodexLiveRequestTimingTrend } from './model/requestTimingTrend.ts';

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

test('buildSessionRowSummary only exposes session project, account, and short protocol', () => {
  const session = codexLiveSessionsPreviewSnapshot.sessions[0];
  const summary = buildSessionRowSummary(session, session.requests[0], (key) => key);

  assert.deepEqual(summary, {
    sessionProjectLabel: 'GetTokens / ws_sess_7a91',
    accountTransportLabel: 'team-codex@example.com / ws',
  });
  assert.doesNotMatch(Object.values(summary).join(' '), /gpt-5\.5|streaming|8\.0s/);
});

test('buildSessionRowSummary places project name before long session ids so feed truncation keeps it visible', () => {
  const session = {
    ...codexLiveSessionsPreviewSnapshot.sessions[0],
    sessionID: 'projects/-Users-linhey-Desktop-linhay-open-sources-GetTokens/sessions/2026/05/25/very-long-session-id.jsonl',
  };
  const summary = buildSessionRowSummary(session, session.requests[0], (key) => key);

  assert.match(summary.sessionProjectLabel, /^GetTokens \/ projects\//);
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

  assert.equal(summary.sessionProjectLabel, '未知项目 / codex_win_48f2');
  assert.equal(summary.accountTransportLabel, 'team-codex@example.com / http');
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
  assert.equal(rowSummary.accountTransportLabel, 'new-account@example.com / ws');

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
    sequenceLabel: '#5',
    modelLabel: 'gpt-5.5',
    startedAtLabel: '18:35:10',
    completedAtLabel: '-',
    totalDurationLabel: '8.0s',
    ttftLabel: '562ms',
    firstTokenLabel: '810ms',
    streamDurationLabel: '7.4s',
    averageGapLabel: '82ms',
    longestGapLabel: '420ms',
  });
  assert.doesNotMatch(Object.values(summary).join(' '), /team-codex|websocket|response\.output_text|21,580/);
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

test('codex live session surfaces use larger typography tokens for the dense workbench', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');
  const feedSource = await readFile(new URL('./components/CodexLiveSessionFeed.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /RequestTimingTrend/);
  assert.match(detailSource, /font-size-ui-lg/);
  assert.match(detailSource, /font-size-ui-sm/);
  assert.match(detailSource, /font-size-ui-xs/);
  assert.match(feedSource, /font-size-ui-3xl/);
  assert.match(feedSource, /font-size-ui-2xl/);
  assert.match(feedSource, /font-size-ui-sm/);
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

  assert.match(detailSource, /buildTimelineMetricItems/);
  assert.match(detailSource, /isTimelineValuePresent/);
  assert.match(detailSource, /TimelineMetricPill/);
  assert.match(detailSource, /function TimelineSummaryRow/);
  assert.match(detailSource, /onClick=\{onOpen\}/);
  assert.match(detailSource, /formatTimelineRequestID/);
  assert.match(detailSource, /grid-cols-\[auto_auto_auto_minmax\(0,1fr\)\]/);
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

  assert.match(detailSource, /className="grid min-w-0 w-full gap-5"/);
  assert.doesNotMatch(detailSource, /className="min-w-0 w-full border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] shadow-\[6px_6px_0_var\(--shadow-color\)\]"/);
  assert.doesNotMatch(detailSource, /grid gap-5 border-b-2 border-\[var\(--border-color\)\] p-4/);
  assert.match(workbenchSource, /className="grid min-w-0 gap-2 lg:grid-cols-\[minmax\(260px,1fr\)_auto\]"/);
  assert.doesNotMatch(workbenchSource, /className="grid gap-3 border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] p-3 shadow-\[6px_6px_0_var\(--shadow-color\)\]/);
  assert.doesNotMatch(filterSource, /border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] p-3/);
});

test('codex live session detail header uses request timing trend chart', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /<RequestTimingTrend session=\{session\} request=\{request\} t=\{t\} \/>/);
  assert.match(detailSource, /<RequestTimingTrend[\s\S]*?<TimingMetrics[\s\S]*?<Timeline[\s\S]*?<AccountCard/);
  assert.match(detailSource, /function RequestTimingTrend/);
  assert.match(detailSource, /buildCodexLiveRequestTimingTrend/);
  assert.match(detailSource, /function TimingTrendChart/);
  assert.match(detailSource, /TimingTrendFooterItem label=\{t\('codex_live_sessions\.duration'\)\}/);
  assert.doesNotMatch(detailSource, /min-h-\[166px\][^"]*border[^"]*bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(detailSource, /font-size-ui-5xl/);
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

test('codex live sessions preview data gives the default detail chart multiple timing samples', () => {
  const selectedSession = getSelectedCodexLiveSession(codexLiveSessionsPreviewSnapshot.sessions);
  assert.ok(selectedSession);
  const selectedRequest = getPrimaryCodexLiveRequest(selectedSession);
  const trend = buildCodexLiveRequestTimingTrend(selectedSession.requests, selectedRequest);

  assert.equal(selectedSession.sessionID, 'ws_sess_7a91');
  assert.equal(selectedRequest?.requestID, 'gt-req-8912');
  assert.equal(selectedSession.requestCount, selectedSession.requests.length);
  assert.ok(trend.points.length >= 5);
  assert.deepEqual(trend.points.map((point) => point.requestID), [
    'gt-req-8874',
    'gt-req-8885',
    'gt-req-8898',
    'gt-req-8906',
    'gt-req-8912',
  ]);
});

test('codex live session timing chart uses request timestamps and live refresh', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /setInterval/);
  assert.match(detailSource, /nowMs/);
  assert.match(detailSource, /trendChartX\(point\.startedAtMs/);
  assert.match(detailSource, /buildTimingTrendAreaPath/);
  assert.match(detailSource, /strokeDasharray=\{point\.isLive/);
  assert.doesNotMatch(detailSource, /trendChartX\(index,/);
});

test('codex live session timing chart follows Usage Desk chart styling primitives', async () => {
  const detailSource = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(detailSource, /backgroundImage:/);
  assert.match(detailSource, /var\(--color-chart-grid\)/);
  assert.match(detailSource, /var\(--color-chart-grid-subtle\)/);
  assert.match(detailSource, /codex-live-total-area/);
  assert.match(detailSource, /usage-desk-curve-sweep/);
  assert.match(detailSource, /function TimingTrendPoint/);
  assert.match(detailSource, /buildTimingTrendPointStyle/);
  assert.doesNotMatch(detailSource, /className="mt-3 h-\[128px\] w-full overflow-visible bg-\[var\(--bg-main\)\]"/);
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
