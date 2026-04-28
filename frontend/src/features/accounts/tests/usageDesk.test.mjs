import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUsageDeskObservedSnapshot,
  buildUsageDeskProjectedSnapshot,
  collectUsageDeskObservedDetails,
  collectUsageDeskProjectedDetails,
  formatUsageDeskChartValue,
  readUsageDeskProjectedStats,
  resolveUsageDeskChartSelectionKey,
  resolveUsageDeskLinkedRowKey,
  resolveUsageDeskRangeDrilldownDayKey,
} from '../model/usageDesk.ts';

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
  assert.equal(snapshot.dailyPoints[1].success, 2);
  assert.equal(snapshot.dailyPoints[1].failure, 1);
  assert.equal(snapshot.minutePoints.length, 2);
  assert.equal(snapshot.minuteRows.length, 2);
  assert.equal(snapshot.minuteRows[0].timeLabel, '14:20');
  assert.equal(snapshot.minuteRows[0].provider, 'mixed');
  assert.equal(snapshot.minuteRows[0].value, '2 / 0');
  assert.equal(snapshot.minuteRows[0].note, '总请求 2 次');
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

test('collectUsageDeskProjectedDetails keeps provider and token fields from local projected payload', () => {
  const details = collectUsageDeskProjectedDetails({
    details: [
      {
        timestamp: '2026-04-28T06:20:00.000Z',
        provider: 'codex',
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

test('buildUsageDeskProjectedSnapshot merges multiple details from the same minute into one table row', () => {
  const snapshot = buildUsageDeskProjectedSnapshot({
    details: [
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
