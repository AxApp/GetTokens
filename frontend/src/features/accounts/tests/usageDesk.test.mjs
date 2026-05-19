import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUsageDeskChartValueScale,
  buildUsageDeskChartPointStyle,
  buildUsageDeskObservedSummaryItems,
  buildUsageDeskObservedSnapshot,
  buildUsageDeskProjectedSnapshot,
  buildUsageDeskProjectedProjectUsageRows,
  buildUsageDeskProjectedSummaryItems,
  collectUsageDeskObservedDetails,
  collectUsageDeskProjectedDetails,
  formatUsageDeskChartValue,
  readUsageDeskProjectedStats,
  resolveUsageDeskCurveAnimationConfig,
  resolveUsageDeskChartSelectionKey,
  resolveUsageDeskLinkedRowKey,
  resolveUsageDeskRangeDrilldownDayKey,
  shouldOpenUsageDeskProjectedSessionSurface,
  usageDeskProjectDrilldownColumnLabels,
  usageDeskSessionDrilldownColumnLabels,
  usageDeskProjectedSurfaceViewOptions,
} from '../model/usageDesk.ts';

test('buildUsageDeskChartPointStyle keeps hit area centered on the plotted coordinate', () => {
  assert.deepEqual(buildUsageDeskChartPointStyle(128, 96), {
    left: '128px',
    top: '96px',
    transform: 'translate(-50%, -50%)',
  });
});

test('buildUsageDeskChartValueScale keeps normal ranges linear', () => {
  const scale = buildUsageDeskChartValueScale([10, 20, 30]);

  assert.equal(scale.mode, 'linear');
  assert.equal(scale.ratio(10), 10 / 30);
  assert.equal(scale.ratio(30), 1);
  assert.equal(scale.ratio(0), 0);
});

test('buildUsageDeskChartValueScale compresses extreme outliers without changing labels', () => {
  const scale = buildUsageDeskChartValueScale([12, 14, 16, 120000]);

  assert.equal(scale.mode, 'compressed');
  assert.equal(scale.ratio(120000), 1);
  assert.ok(scale.ratio(16) > 0.18);
  assert.ok(scale.ratio(16) < 0.5);
  assert.equal(scale.ratio(0), 0);
});

test('projected surface view options include a local sessions mode', () => {
  assert.deepEqual(
    usageDeskProjectedSurfaceViewOptions.map((option) => option.id),
    ['daily', 'minute', 'projects', 'sessions'],
  );
});

test('session drilldown columns keep table order stable', () => {
  assert.deepEqual(Array.from(usageDeskSessionDrilldownColumnLabels), ['会话来源', '模型', '请求', 'Token', '输入', '缓存', '输出']);
});

test('project drilldown columns keep aggregate table order stable', () => {
  assert.deepEqual(Array.from(usageDeskProjectDrilldownColumnLabels), ['项目', '会话', '模型', '请求', 'Token', '输入', '缓存', '输出']);
});

test('projected usage row selection opens session surface only for local projected data', () => {
  assert.equal(shouldOpenUsageDeskProjectedSessionSurface('projected', '2026-04-28'), true);
  assert.equal(shouldOpenUsageDeskProjectedSessionSurface('projected', '   '), false);
  assert.equal(shouldOpenUsageDeskProjectedSessionSurface('observed', '2026-04-28'), false);
});

test('resolveUsageDeskCurveAnimationConfig keeps realtime motion bounded', () => {
  assert.deepEqual(resolveUsageDeskCurveAnimationConfig('standard', 1440), {
    durationMs: 420,
    pointDelayMs: 0,
  });

  assert.deepEqual(resolveUsageDeskCurveAnimationConfig('realtime', 10), {
    durationMs: 1400,
    pointDelayMs: 60,
  });

  assert.deepEqual(resolveUsageDeskCurveAnimationConfig('realtime', 1440), {
    durationMs: 3200,
    pointDelayMs: 1600 / 1440,
  });
});

test('collectUsageDeskObservedDetails keeps provider and model from nested usage payload', () => {
  const details = collectUsageDeskObservedDetails({
    apis: {
      codex: {
        models: {
          'gpt-5': {
            details: [
              {
                timestamp: '2026-04-28T06:20:00.000Z',
                failed: false,
                latency_ms: 180,
              },
            ],
          },
        },
      },
    },
  });

  assert.equal(details.length, 1);
  assert.equal(details[0].provider, 'codex');
  assert.equal(details[0].model, 'gpt-5');
  assert.equal(details[0].requestCount, 1);
  assert.equal(details[0].failedCount, 0);
  assert.equal(details[0].latencyMs, 180);
});

test('buildUsageDeskObservedSnapshot aggregates daily and minute buckets and falls back to latest day', () => {
  const snapshot = buildUsageDeskObservedSnapshot({
    apis: {
      codex: {
        models: {
          'gpt-5': {
            details: [
              { timestamp: '2026-04-27T06:20:00.000Z', failed: false, latency_ms: 180 },
              { timestamp: '2026-04-28T06:18:00.000Z', failed: true, latency_ms: 2200 },
              { timestamp: '2026-04-28T06:20:00.000Z', failed: false, latency_ms: 140 },
            ],
          },
        },
      },
      gemini: {
        models: {
          'gemini-2.5-pro': {
            details: [{ timestamp: '2026-04-28T06:20:00.000Z', failed: false, latency_ms: 160 }],
          },
        },
      },
    },
  });

  assert.equal(snapshot.hasData, true);
  assert.equal(snapshot.success, 3);
  assert.equal(snapshot.failure, 1);
  assert.deepEqual(snapshot.availableDayKeys, ['2026-04-27', '2026-04-28']);
  assert.equal(snapshot.selectedDayKey, '2026-04-28');
  assert.equal(snapshot.dailyPoints[1].requests, 3);
  assert.equal(snapshot.dailyPoints[1].success, 2);
  assert.equal(snapshot.dailyPoints[1].failure, 1);
  assert.equal(snapshot.minutePoints.length, 2);
  assert.equal(snapshot.minuteRows.length, 2);
  assert.equal(snapshot.minuteRows[0].timeLabel, '14:20');
  assert.equal(snapshot.minuteRows[0].provider, 'mixed');
  assert.equal(snapshot.minuteRows[0].metric, '总请求');
  assert.equal(snapshot.minuteRows[0].model, 'gemini-2.5-pro,*');
  assert.equal(snapshot.minuteRows[0].value, '2 次');
  assert.equal(snapshot.minuteRows[0].requests, '2 次');
  assert.equal(snapshot.minuteRows[0].inputTokens, '0');
  assert.equal(snapshot.minuteRows[0].cachedInputTokens, '0');
  assert.equal(snapshot.minuteRows[0].outputTokens, '0');
});

test('buildUsageDeskObservedSnapshot supports explicit single-day minute drilldown from time-level history', () => {
  const snapshot = buildUsageDeskObservedSnapshot(
    {
      apis: {
        codex: {
          models: {
            'gpt-5': {
              details: [
                { timestamp: '2026-04-27T06:20:00.000Z', failed: false, latency_ms: 180 },
                { timestamp: '2026-04-28T06:18:00.000Z', failed: true, latency_ms: 2200 },
                { timestamp: '2026-04-28T06:20:00.000Z', failed: false, latency_ms: 140 },
              ],
            },
          },
        },
      },
    },
    '2026-04-27',
  );

  assert.equal(snapshot.selectedDayKey, '2026-04-27');
  assert.equal(snapshot.minutePoints.length, 1);
  assert.equal(snapshot.minutePoints[0].label, '14:20');
  assert.equal(snapshot.minutePoints[0].success, 1);
  assert.equal(snapshot.minutePoints[0].failure, 0);
  assert.equal(snapshot.minuteRows.length, 1);
  assert.equal(snapshot.minuteRows[0].metric, '请求成功');
});

test('collectUsageDeskObservedDetails supports sidecar attribution buckets', () => {
  const details = collectUsageDeskObservedDetails({
    items: [
      {
        accountKey: 'codex-api-key:local-1',
        attributionKey: 'auth-id:runtime-auth-1',
        provider: 'codex',
        requestedModels: ['gpt-5'],
        buckets: [
          {
            start: '2026-04-28T06:20:00.000Z',
            requestCount: 4,
            failedCount: 1,
            inputTokens: 400,
            cachedInputTokens: 80,
            outputTokens: 120,
            totalTokens: 600,
          },
        ],
      },
    ],
    unresolved: [],
  });

  assert.equal(details.length, 1);
  assert.equal(details[0].accountKey, 'codex-api-key:local-1');
  assert.equal(details[0].attributionKey, 'auth-id:runtime-auth-1');
  assert.equal(details[0].provider, 'codex');
  assert.equal(details[0].model, 'gpt-5');
  assert.equal(details[0].requestCount, 4);
  assert.equal(details[0].failedCount, 1);
  assert.equal(details[0].inputTokens, 400);
  assert.equal(details[0].cachedInputTokens, 80);
  assert.equal(details[0].outputTokens, 120);
  assert.equal(details[0].totalTokens, 600);
});

test('buildUsageDeskObservedSnapshot aggregates sidecar attribution buckets by request count and tokens', () => {
  const snapshot = buildUsageDeskObservedSnapshot(
    {
      items: [
        {
          accountKey: 'codex-api-key:local-1',
          attributionKey: 'auth-id:runtime-auth-1',
          provider: 'codex',
          requestedModels: ['gpt-5'],
          buckets: [
            {
              start: '2026-04-28T06:18:00.000Z',
              requestCount: 2,
              failedCount: 1,
              inputTokens: 200,
              cachedInputTokens: 20,
              outputTokens: 50,
              totalTokens: 270,
            },
            {
              start: '2026-04-28T06:20:00.000Z',
              requestCount: 3,
              failedCount: 0,
              inputTokens: 300,
              cachedInputTokens: 40,
              outputTokens: 90,
              totalTokens: 430,
            },
          ],
        },
      ],
      unresolved: [
        {
          accountKey: '',
          attributionKey: 'auth-id:unresolved-1',
          provider: 'codex',
          requestedModels: ['gpt-5-mini'],
          buckets: [
            {
              start: '2026-04-28T06:20:00.000Z',
              requestCount: 1,
              failedCount: 1,
              inputTokens: 60,
              cachedInputTokens: 0,
              outputTokens: 10,
              totalTokens: 70,
            },
          ],
        },
      ],
    },
    '2026-04-28',
  );

  assert.equal(snapshot.hasData, true);
  assert.equal(snapshot.success, 4);
  assert.equal(snapshot.failure, 2);
  assert.equal(snapshot.dailyPoints[0].requests, 6);
  assert.equal(snapshot.dailyPoints[0].totalTokens, 770);
  assert.equal(snapshot.minutePoints.length, 2);
  assert.equal(snapshot.minutePoints[1].requests, 4);
  assert.equal(snapshot.minutePoints[1].totalTokens, 500);
  assert.equal(snapshot.minuteRows[0].timeLabel, '14:20');
  assert.equal(snapshot.minuteRows[0].metric, '总请求');
  assert.equal(snapshot.minuteRows[0].value, '4 次');
  assert.equal(snapshot.minuteRows[0].requests, '4 次');
  assert.equal(snapshot.minuteRows[0].inputTokens, '360');
  assert.equal(snapshot.minuteRows[0].cachedInputTokens, '40');
  assert.equal(snapshot.minuteRows[0].outputTokens, '100');
  assert.equal(snapshot.minuteRows[0].note, 'codex-api-key:local-1 / 失败 1 次');
});

test('collectUsageDeskProjectedDetails keeps provider and token fields from local projected payload', () => {
  const details = collectUsageDeskProjectedDetails({
    details: [
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
        projectName: 'GetTokens',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 4800,
        cachedInputTokens: 1200,
        outputTokens: 200,
        requestCount: 1,
      },
    ],
  });

  assert.equal(details.length, 1);
  assert.equal(details[0].provider, 'codex');
  assert.equal(details[0].sessionID, 'sessions/2026/04/28/rollout-a.jsonl');
  assert.equal(details[0].projectName, 'GetTokens');
  assert.equal(details[0].model, 'gpt-5-codex');
  assert.equal(details[0].inputTokens, 4800);
  assert.equal(details[0].cachedInputTokens, 1200);
  assert.equal(details[0].outputTokens, 200);
});

test('buildUsageDeskProjectedSnapshot aggregates total tokens and minute rows and falls back to latest day', () => {
  const snapshot = buildUsageDeskProjectedSnapshot({
    details: [
      {
        timestamp: '2026-04-27T06:20:00.000Z',
        provider: 'codex',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 100,
        cachedInputTokens: 10,
        outputTokens: 20,
        requestCount: 1,
      },
      {
        timestamp: '2026-04-28T06:18:00.000Z',
        provider: 'codex',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 200,
        cachedInputTokens: 50,
        outputTokens: 40,
        requestCount: 1,
      },
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
        projectName: 'GetTokens',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 300,
        cachedInputTokens: 120,
        outputTokens: 60,
        requestCount: 1,
      },
    ],
  });

  assert.equal(snapshot.hasData, true);
  assert.equal(snapshot.totalRequests, 3);
  assert.equal(snapshot.totalTokens, 720);
  assert.deepEqual(snapshot.availableDayKeys, ['2026-04-27', '2026-04-28']);
  assert.equal(snapshot.selectedDayKey, '2026-04-28');
  assert.equal(snapshot.dailyPoints[1].requests, 2);
  assert.equal(snapshot.dailyPoints[1].totalTokens, 600);
  assert.equal(snapshot.dailyPoints[1].model, 'gpt-5-codex');
  assert.equal(snapshot.dailyPoints[1].inputTokens, 500);
  assert.equal(snapshot.dailyPoints[1].cachedInputTokens, 170);
  assert.equal(snapshot.dailyPoints[1].outputTokens, 100);
  assert.equal(snapshot.minutePoints.length, 2);
  assert.equal(snapshot.minuteRows.length, 2);
  assert.equal(snapshot.minutePoints[1].totalTokens, 360);
  assert.equal(snapshot.minuteRows[0].timeLabel, '14:20');
  assert.equal(snapshot.minuteRows[0].value, '360');
  assert.equal(snapshot.minuteRows[0].requests, '1 次');
  assert.equal(snapshot.minuteRows[0].inputTokens, '300');
  assert.equal(snapshot.minuteRows[0].cachedInputTokens, '120');
  assert.equal(snapshot.minuteRows[0].outputTokens, '60');
  assert.equal(snapshot.minuteRows[0].note, undefined);
});

test('buildUsageDeskProjectedSummaryItems separates cached input from non-cached estimate', () => {
  const summary = buildUsageDeskProjectedSummaryItems({
    drilldownDayKey: null,
    dailyPoints: [],
    visibleDailyPoints: [
      {
        dayKey: '2026-04-28',
        label: '04-28',
        model: 'gpt-5-codex',
        requests: 2,
        totalTokens: 600,
        inputTokens: 500,
        cachedInputTokens: 460,
        outputTokens: 100,
      },
    ],
  });

  assert.deepEqual(summary, [
    '请求 2 次',
    'Token(含缓存) 600',
    '非缓存估算 140',
    '输入 500',
    '缓存 460',
    '输出 100',
  ]);
});

test('buildUsageDeskProjectedSnapshot merges multiple details from the same minute into one table row', () => {
  const snapshot = buildUsageDeskProjectedSnapshot({
    details: [
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
        projectName: 'GetTokens',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 300,
        cachedInputTokens: 120,
        outputTokens: 60,
        requestCount: 1,
      },
      {
        timestamp: '2026-04-28T06:20:20.000Z',
        provider: 'codex',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 50,
        cachedInputTokens: 20,
        outputTokens: 10,
        requestCount: 1,
      },
    ],
  });

  assert.equal(snapshot.minuteRows.length, 1);
  assert.equal(snapshot.minuteRows[0].timeLabel, '14:20');
  assert.equal(snapshot.minuteRows[0].value, '420');
  assert.equal(snapshot.minuteRows[0].requests, '2 次');
  assert.equal(snapshot.minuteRows[0].inputTokens, '350');
  assert.equal(snapshot.minuteRows[0].cachedInputTokens, '140');
  assert.equal(snapshot.minuteRows[0].outputTokens, '70');
});

test('buildUsageDeskProjectedSnapshot marks additional day-level models behind the dominant model', () => {
  const snapshot = buildUsageDeskProjectedSnapshot({
    details: [
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
        projectName: 'GetTokens',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 300,
        cachedInputTokens: 120,
        outputTokens: 60,
        requestCount: 1,
      },
      {
        timestamp: '2026-04-28T07:20:20.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-b.jsonl',
        sourceKind: 'local_projected',
        model: 'o3',
        inputTokens: 50,
        cachedInputTokens: 20,
        outputTokens: 10,
        requestCount: 1,
      },
    ],
  });

  assert.equal(snapshot.dailyPoints.length, 1);
  assert.equal(snapshot.dailyPoints[0].model, 'gpt-5-codex,*');
});

test('buildUsageDeskProjectedSnapshot shows the dominant model and marks additional models in the same minute', () => {
  const snapshot = buildUsageDeskProjectedSnapshot({
    details: [
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
        projectName: 'GetTokens',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 300,
        cachedInputTokens: 120,
        outputTokens: 60,
        requestCount: 1,
      },
      {
        timestamp: '2026-04-28T06:20:20.000Z',
        provider: 'codex',
        sessionID: 'sessions/2026/04/28/rollout-b.jsonl',
        sourceKind: 'local_projected',
        model: 'o3',
        inputTokens: 50,
        cachedInputTokens: 20,
        outputTokens: 10,
        requestCount: 1,
      },
    ],
  });

  assert.equal(snapshot.minutePoints.length, 1);
  assert.equal(snapshot.minutePoints[0].totalTokens, 420);
  assert.equal(snapshot.minuteRows.length, 1);
  assert.equal(snapshot.minuteRows[0].timeLabel, '14:20');
  assert.equal(snapshot.minuteRows[0].model, 'gpt-5-codex,*');
  assert.equal(snapshot.minuteRows[0].value, '420');
  assert.equal(snapshot.minuteRows[0].requests, '2 次');
  assert.equal(snapshot.minuteRows[0].inputTokens, '350');
  assert.equal(snapshot.minuteRows[0].cachedInputTokens, '140');
  assert.equal(snapshot.minuteRows[0].outputTokens, '70');
  assert.deepEqual(
    snapshot.sessionUsageByBucket['2026-04-28|14:20'].map((session) => ({
      sessionID: session.sessionID,
      fileLabel: session.fileLabel,
      projectName: session.projectName,
      model: session.model,
      totalTokens: session.totalTokens,
      requests: session.requests,
    })),
    [
      {
        sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
        fileLabel: 'rollout-a.jsonl',
        projectName: 'GetTokens',
        model: 'gpt-5-codex',
        totalTokens: 360,
        requests: 1,
      },
      {
        sessionID: 'sessions/2026/04/28/rollout-b.jsonl',
        fileLabel: 'rollout-b.jsonl',
        projectName: '',
        model: 'o3',
        totalTokens: 60,
        requests: 1,
      },
    ],
  );
});

test('buildUsageDeskProjectedProjectUsageRows aggregates sessions by project', () => {
  const projectRows = buildUsageDeskProjectedProjectUsageRows([
    {
      sessionID: 'sessions/2026/04/28/rollout-a.jsonl',
      fileLabel: 'rollout-a.jsonl',
      projectName: 'GetTokens',
      model: 'gpt-5-codex',
      requests: 1,
      totalTokens: 360,
      inputTokens: 300,
      cachedInputTokens: 120,
      outputTokens: 60,
      latestTimestamp: '2026-04-28T06:20:00.000Z',
    },
    {
      sessionID: 'sessions/2026/04/28/rollout-b.jsonl',
      fileLabel: 'rollout-b.jsonl',
      projectName: 'GetTokens',
      model: 'o3',
      requests: 2,
      totalTokens: 180,
      inputTokens: 150,
      cachedInputTokens: 40,
      outputTokens: 30,
      latestTimestamp: '2026-04-28T06:21:00.000Z',
    },
    {
      sessionID: 'sessions/2026/04/28/rollout-c.jsonl',
      fileLabel: 'rollout-c.jsonl',
      projectName: '',
      model: 'gpt-5-codex',
      requests: 1,
      totalTokens: 90,
      inputTokens: 70,
      cachedInputTokens: 20,
      outputTokens: 20,
      latestTimestamp: '2026-04-28T06:19:00.000Z',
    },
  ]);

  assert.deepEqual(
    projectRows.map((project) => ({
      projectName: project.projectName,
      sessions: project.sessions,
      model: project.model,
      requests: project.requests,
      totalTokens: project.totalTokens,
      inputTokens: project.inputTokens,
      cachedInputTokens: project.cachedInputTokens,
      outputTokens: project.outputTokens,
    })),
    [
      {
        projectName: 'GetTokens',
        sessions: 2,
        model: 'gpt-5-codex,*',
        requests: 3,
        totalTokens: 540,
        inputTokens: 450,
        cachedInputTokens: 160,
        outputTokens: 90,
      },
      {
        projectName: '未知项目',
        sessions: 1,
        model: 'gpt-5-codex',
        requests: 1,
        totalTokens: 90,
        inputTokens: 70,
        cachedInputTokens: 20,
        outputTokens: 20,
      },
    ],
  );
});

test('buildUsageDeskProjectedSnapshot formats minute-row values with chinese compact units', () => {
  const snapshot = buildUsageDeskProjectedSnapshot({
    details: [
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
        sourceKind: 'local_projected',
        model: 'gpt-5-codex',
        inputTokens: 5800000,
        cachedInputTokens: 1200000,
        outputTokens: 200000,
        requestCount: 1,
      },
    ],
  });

  assert.equal(snapshot.minuteRows[0].value, '6 百万');
  assert.equal(snapshot.minuteRows[0].requests, '1 次');
  assert.equal(snapshot.minuteRows[0].inputTokens, '5.8 百万');
  assert.equal(snapshot.minuteRows[0].cachedInputTokens, '1.2 百万');
  assert.equal(snapshot.minuteRows[0].outputTokens, '20 万');
});

test('buildUsageDeskObservedSummaryItems uses the full selected day in minute view', () => {
  const snapshot = buildUsageDeskObservedSnapshot(
    {
      apis: {
        codex: {
          models: {
            'gpt-5': {
              details: [
                { timestamp: '2026-04-28T06:18:00.000Z', failed: false, latency_ms: 180 },
                { timestamp: '2026-04-28T06:20:00.000Z', failed: true, latency_ms: 2200 },
                { timestamp: '2026-04-28T06:20:10.000Z', failed: false, latency_ms: 140 },
              ],
            },
          },
        },
      },
    },
    '2026-04-28',
  );
  const visibleMinutePoint = snapshot.minutePoints.find((point) => point.label === '14:18');

  assert.deepEqual(
    buildUsageDeskObservedSummaryItems({
      drilldownDayKey: '2026-04-28',
      dailyPoints: snapshot.dailyPoints,
      visibleDailyPoints: visibleMinutePoint
        ? [{
            dayKey: '2026-04-28',
            label: visibleMinutePoint.label,
            requests: 3,
            success: 2,
            failure: 1,
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          }]
        : [],
    }),
    ['全天请求 3 次', '全天失败 1 次', '全天 Token 0', '全天输入 0', '全天输出 0'],
  );
});

test('buildUsageDeskProjectedSummaryItems uses the full selected day in minute view', () => {
  const snapshot = buildUsageDeskProjectedSnapshot(
    {
      details: [
        {
          timestamp: '2026-04-28T06:18:00.000Z',
          provider: 'codex',
          sourceKind: 'local_projected',
          model: 'gpt-5-codex',
          inputTokens: 100,
          cachedInputTokens: 10,
          outputTokens: 20,
          requestCount: 1,
        },
        {
          timestamp: '2026-04-28T06:20:00.000Z',
          provider: 'codex',
          sourceKind: 'local_projected',
          model: 'gpt-5-codex',
          inputTokens: 300,
          cachedInputTokens: 120,
          outputTokens: 60,
          requestCount: 1,
        },
      ],
    },
    '2026-04-28',
  );
  const visibleMinutePoint = snapshot.minutePoints.find((point) => point.label === '14:18');

  assert.deepEqual(
    buildUsageDeskProjectedSummaryItems({
      drilldownDayKey: '2026-04-28',
      dailyPoints: snapshot.dailyPoints,
      visibleDailyPoints: visibleMinutePoint
        ? [
            {
              dayKey: '2026-04-28',
              label: visibleMinutePoint.label,
              requests: visibleMinutePoint.requests,
              totalTokens: visibleMinutePoint.totalTokens,
              inputTokens: 100,
              cachedInputTokens: 10,
              outputTokens: 20,
            },
          ]
        : [],
    }),
    ['全天请求 2 次', '全天 Token(含缓存) 480', '全天非缓存估算 350', '全天输入 400', '全天缓存 130', '全天输出 80'],
  );
});

test('readUsageDeskProjectedStats reads sqlite index refresh counters', () => {
  const stats = readUsageDeskProjectedStats({
    scannedFiles: 12,
    cacheHitFiles: 7,
    deltaAppendFiles: 3,
    fullRebuildFiles: 1,
    fileMissingFiles: 1,
  });

  assert.deepEqual(stats, {
    scannedFiles: 12,
    cacheHitFiles: 7,
    deltaAppendFiles: 3,
    fullRebuildFiles: 1,
    fileMissingFiles: 1,
  });
});

test('formatUsageDeskChartValue appends the expected unit label', () => {
  assert.equal(formatUsageDeskChartValue(1284, 'count'), '1,284 次');
  assert.equal(formatUsageDeskChartValue(25800, 'count'), '2.6 万次');
  assert.equal(formatUsageDeskChartValue(5800000, 'count'), '5.8 百万次');
  assert.equal(formatUsageDeskChartValue(126000000, 'count'), '1.3 亿次');
  assert.equal(formatUsageDeskChartValue(5800, 'tokens'), '5,800');
  assert.equal(formatUsageDeskChartValue(25800, 'tokens'), '2.6 万');
  assert.equal(formatUsageDeskChartValue(5800000, 'tokens'), '5.8 百万');
  assert.equal(formatUsageDeskChartValue(126000000, 'tokens'), '1.3 亿');
});

test('resolveUsageDeskRangeDrilldownDayKey only drills into the latest day for TODAY', () => {
  assert.equal(resolveUsageDeskRangeDrilldownDayKey('TODAY', '2026-04-29'), '2026-04-29');
  assert.equal(resolveUsageDeskRangeDrilldownDayKey('TODAY', null), null);
  assert.equal(resolveUsageDeskRangeDrilldownDayKey('7D', '2026-04-29'), null);
  assert.equal(resolveUsageDeskRangeDrilldownDayKey('全部', '2026-04-29'), null);
});

test('resolveUsageDeskChartSelectionKey uses the row time label for chart-table linking', () => {
  assert.equal(resolveUsageDeskChartSelectionKey({ timeLabel: '04-28' }), '04-28');
  assert.equal(resolveUsageDeskChartSelectionKey({ timeLabel: '14:20' }), '14:20');
  assert.equal(resolveUsageDeskChartSelectionKey(null), '');
});

test('resolveUsageDeskLinkedRowKey finds the first row that matches the clicked chart bucket', () => {
  const rows = [
    { timeLabel: '14:18', value: '1', note: '延迟 300ms' },
    { timeLabel: '14:20', value: '360', requests: '1 次', inputTokens: '300', cachedInputTokens: '120', outputTokens: '60' },
    { timeLabel: '14:20', value: '420', requests: '1 次', inputTokens: '360', cachedInputTokens: '140', outputTokens: '60' },
  ];

  assert.equal(resolveUsageDeskLinkedRowKey(rows, '14:20'), '14:20|360||1 次|300|120|60');
  assert.equal(resolveUsageDeskLinkedRowKey(rows, '14:19'), '');
  assert.equal(resolveUsageDeskLinkedRowKey(rows, ''), '');
});
