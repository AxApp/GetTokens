import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountUsageSummary,
  buildAccountUsageSummaryMap,
  buildCandidateUsageSourceIds,
  buildAccountTodayUsageTotals,
  buildFailedAccountUsageSummaryMap,
  shouldScheduleAccountUsageRefresh,
  calculateStatusBarData,
  collectUsageDetails,
  normalizeUsageSourceId,
  resolveResponsiveStatusBarData,
} from '../model/accountUsage.ts';

test('collectUsageDetails normalizes nested usage snapshot details', () => {
  const details = collectUsageDetails({
    apis: {
      codex: {
        models: {
          'gpt-5': {
            details: [
              {
                timestamp: '2026-04-27T10:00:00.000Z',
                source: 'sk-test-1234567890',
                auth_index: 'auth-1',
                latency_ms: 180,
                failed: false,
              },
            ],
          },
        },
      },
    },
  });

  assert.equal(details.length, 1);
  assert.equal(details[0].auth_index, 'auth-1');
  assert.equal(details[0].latency_ms, 180);
  assert.equal(details[0].failed, false);
  assert.equal(details[0].source, normalizeUsageSourceId('sk-test-1234567890'));
});

test('buildAccountUsageSummary prefers authIndex matching for auth-file accounts', () => {
  const usageData = {
    apis: {
      codex: {
        models: {
          'gpt-5': {
            details: [
              {
                timestamp: '2026-04-27T09:50:00.000Z',
                source: 'sk-test-1234567890',
                auth_index: 'auth-42',
                latency_ms: 200,
                failed: false,
              },
              {
                timestamp: '2026-04-27T09:55:00.000Z',
                source: 'sk-test-1234567890',
                auth_index: 'auth-42',
                latency_ms: 260,
                failed: true,
              },
            ],
          },
        },
      },
    },
  };

  const summary = buildAccountUsageSummary(
    {
      id: 'auth-file:alpha',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'alpha',
      status: 'ACTIVE',
      authIndex: 'auth-42',
    },
    usageData,
    Date.parse('2026-04-27T10:00:00.000Z')
  );

  assert.equal(summary.hasData, true);
  assert.equal(summary.success, 1);
  assert.equal(summary.failure, 1);
  assert.equal(summary.successRate, 50);
  assert.equal(summary.averageLatencyMs, 230);
  assert.equal(summary.statusBar.totalSuccess, 1);
  assert.equal(summary.statusBar.totalFailure, 1);
});

test('buildAccountUsageSummary matches api key accounts by normalized source and prefix', () => {
  const apiKey = 'sk-test-abcdef1234567890';
  const normalizedSource = normalizeUsageSourceId(apiKey);
  const candidates = buildCandidateUsageSourceIds({ apiKey, prefix: 'team-a' });

  assert.ok(candidates.includes(normalizedSource));

  const usageData = {
    apis: {
      openai: {
        models: {
          'gpt-5-mini': {
            details: [
              {
                timestamp: '2026-04-27T09:40:00.000Z',
                source: apiKey,
                auth_index: '',
                failed: false,
              },
              {
                timestamp: '2026-04-27T09:58:00.000Z',
                source: 'team-a',
                auth_index: '',
                failed: false,
              },
            ],
          },
        },
      },
    },
  };

  const summary = buildAccountUsageSummary(
    {
      id: 'codex-api-key:1',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'key',
      status: 'ACTIVE',
      apiKey,
      prefix: 'team-a',
    },
    usageData,
    Date.parse('2026-04-27T10:00:00.000Z')
  );

  assert.equal(summary.success, 2);
  assert.equal(summary.failure, 0);
  assert.equal(summary.successRate, 100);
});

test('calculateStatusBarData buckets recent activity into 20 blocks', () => {
  const nowMs = Date.parse('2026-04-27T10:00:00.000Z');
  const statusBar = calculateStatusBarData(
    [
      { timestamp: '2026-04-27T09:59:00.000Z', source: 'a', auth_index: null, failed: false },
      { timestamp: '2026-04-27T09:41:00.000Z', source: 'a', auth_index: null, failed: true },
    ],
    nowMs
  );

  assert.equal(statusBar.blocks.length, 20);
  assert.equal(statusBar.totalSuccess, 1);
  assert.equal(statusBar.totalFailure, 1);
  assert.equal(statusBar.blocks[19], 'success');
});

test('resolveResponsiveStatusBarData merges status blocks for narrow containers', () => {
  const nowMs = Date.parse('2026-04-27T10:00:00.000Z');
  const statusBar = calculateStatusBarData(
    [
      { timestamp: '2026-04-27T09:59:00.000Z', source: 'a', auth_index: null, failed: false },
      { timestamp: '2026-04-27T09:58:00.000Z', source: 'a', auth_index: null, failed: true },
      { timestamp: '2026-04-27T09:40:00.000Z', source: 'a', auth_index: null, failed: false },
    ],
    nowMs
  );

  const compact = resolveResponsiveStatusBarData(statusBar, 96);

  assert.ok(compact.blocks.length < statusBar.blocks.length);
  assert.equal(compact.totalSuccess, 2);
  assert.equal(compact.totalFailure, 1);
  assert.ok(compact.blocks.includes('mixed'));
  assert.equal(resolveResponsiveStatusBarData(statusBar, 400).blocks.length, 20);
});

test('buildAccountUsageSummaryMap returns per-account summaries', () => {
  const usageData = {
    apis: {
      codex: {
        models: {
          'gpt-5': {
            details: [
              {
                timestamp: '2026-04-27T09:58:00.000Z',
                source: 'sk-test-alpha123456',
                auth_index: 'auth-1',
                failed: false,
              },
            ],
          },
        },
      },
    },
  };

  const summaries = buildAccountUsageSummaryMap(
    [
      {
        id: 'auth-file:alpha',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'alpha',
        status: 'ACTIVE',
        authIndex: 'auth-1',
      },
      {
        id: 'auth-file:beta',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'beta',
        status: 'ACTIVE',
        authIndex: 'auth-2',
      },
    ],
    usageData,
    Date.parse('2026-04-27T10:00:00.000Z')
  );

  assert.equal(summaries['auth-file:alpha'].hasData, true);
  assert.equal(summaries['auth-file:beta'].hasData, false);
});

test('buildFailedAccountUsageSummaryMap keeps stale data on merge failures and marks first load errors', () => {
  const accounts = [
    {
      id: 'acct_with_previous',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'previous',
      status: 'ACTIVE',
    },
    {
      id: 'acct_first_load',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'first',
      status: 'ACTIVE',
    },
  ];
  const previous = {
    acct_with_previous: {
      ...buildAccountUsageSummary(accounts[0], {
        items: [
          {
            accountKey: 'acct_with_previous',
            requestCount: 9,
            failedCount: 1,
            totalTokens: 1200,
          },
        ],
      }),
    },
  };

  const summaries = buildFailedAccountUsageSummaryMap(accounts, previous, new Error('usage endpoint timeout'));

  assert.equal(summaries.acct_with_previous.requestCount, 9);
  assert.equal(summaries.acct_with_previous.loadState, 'stale');
  assert.equal(summaries.acct_with_previous.errorMessage, 'usage endpoint timeout');
  assert.equal(summaries.acct_first_load.hasData, false);
  assert.equal(summaries.acct_first_load.loadState, 'error');
  assert.equal(summaries.acct_first_load.errorMessage, 'usage endpoint timeout');
});

test('buildAccountUsageSummary consumes sidecar attribution items for codex api key local-id', () => {
  const summaries = buildAccountUsageSummaryMap(
    [
      {
        id: 'codex-api-key:local-1',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'local-1',
        status: 'ACTIVE',
      },
    ],
    {
      items: [
        {
          accountKey: 'codex-api-key:local-1',
          attributionKey: 'auth-id:runtime-auth-1',
          requestCount: 12,
          failedCount: 3,
          latencyAverageMs: 245,
          inputTokens: 1200,
          cachedInputTokens: 200,
          outputTokens: 450,
          totalTokens: 1850,
          lastActivityAt: '2026-04-27T09:58:00.000Z',
          buckets: [
            {
              start: '2026-04-27T09:00:00.000Z',
              requestCount: 5,
              failedCount: 1,
              inputTokens: 500,
              cachedInputTokens: 80,
              outputTokens: 160,
              totalTokens: 740,
            },
            {
              start: '2026-04-27T10:00:00.000Z',
              requestCount: 7,
              failedCount: 2,
              inputTokens: 700,
              cachedInputTokens: 120,
              outputTokens: 290,
              totalTokens: 1110,
            },
          ],
        },
      ],
      unresolved: [],
    },
    Date.parse('2026-04-27T10:30:00.000Z')
  );

  const summary = summaries['codex-api-key:local-1'];
  assert.equal(summary.source, 'attribution');
  assert.equal(summary.hasData, true);
  assert.equal(summary.requestCount, 12);
  assert.equal(summary.failedCount, 3);
  assert.equal(summary.success, 9);
  assert.equal(summary.failure, 3);
  assert.equal(summary.averageLatencyMs, 245);
  assert.equal(summary.inputTokens, 1200);
  assert.equal(summary.cachedInputTokens, 200);
  assert.equal(summary.outputTokens, 450);
  assert.equal(summary.totalTokens, 1850);
  assert.equal(summary.statusBar.totalSuccess, 9);
  assert.equal(summary.statusBar.totalFailure, 3);
});

test('buildAccountTodayUsageTotals excludes previous local-day buckets from 24h attribution summaries', () => {
  const nowMs = new Date(2026, 3, 27, 10, 30, 0).getTime();
  const previousLocalDayBucket = new Date(2026, 3, 26, 12, 0, 0).toISOString();
  const todayBucket = new Date(2026, 3, 27, 9, 0, 0).toISOString();
  const summary = buildAccountUsageSummary(
    {
      id: 'codex-api-key:local-1',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'local-1',
      status: 'ACTIVE',
    },
    {
      items: [
        {
          accountKey: 'codex-api-key:local-1',
          requestCount: 12,
          totalTokens: 1850,
          buckets: [
            {
              start: previousLocalDayBucket,
              requestCount: 5,
              totalTokens: 740,
            },
            {
              start: todayBucket,
              requestCount: 7,
              totalTokens: 1110,
            },
          ],
        },
      ],
    },
    nowMs
  );

  assert.equal(summary.requestCount, 12);
  assert.equal(summary.totalTokens, 1850);
  assert.deepEqual(
    buildAccountTodayUsageTotals(summary, nowMs),
    {
      requestCount: 7,
      totalTokens: 1110,
    }
  );
});

test('buildAccountUsageSummary consumes sidecar attribution items for openai-compatible provider account', () => {
  const summaries = buildAccountUsageSummaryMap(
    [
      {
        id: 'openai-compatible:MI',
        provider: 'mi',
        credentialSource: 'api-key',
        displayName: '兼容 OpenAI · MI',
        status: 'CONFIGURED',
      },
    ],
    {
      items: [
        {
          accountKey: 'openai-compatible:MI',
          attributionKey: 'auth-id:openai-compatibility:mi:4a25ae6b9cc4',
          provider: 'openai-compatible',
          requestCount: 1,
          failedCount: 0,
          cachedInputTokens: 192,
          totalTokens: 259,
          requestedModels: ['gpt-5.4'],
          lastActivityAt: '2026-04-27T09:58:00.000Z',
          buckets: [
            {
              start: '2026-04-27T09:00:00.000Z',
              requestCount: 1,
              failedCount: 0,
              cachedInputTokens: 192,
              totalTokens: 259,
            },
          ],
        },
      ],
      unresolved: [],
    },
    Date.parse('2026-04-27T10:30:00.000Z')
  );

  const summary = summaries['openai-compatible:MI'];
  assert.equal(summary.source, 'attribution');
  assert.equal(summary.hasData, true);
  assert.equal(summary.requestCount, 1);
  assert.equal(summary.cachedInputTokens, 192);
  assert.equal(summary.totalTokens, 259);
});

test('buildAccountUsageSummary reuses local auth index to consume unresolved attribution items', () => {
  const summaries = buildAccountUsageSummaryMap(
    [
      {
        id: 'acct_auth',
        quotaKey: 'acct_auth',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'auth.json',
        status: 'ACTIVE',
        authIndex: 'auth-runtime-1',
      },
    ],
    {
      items: [],
      unresolved: [
        {
          attributionKey: 'auth-index:auth-runtime-1',
          attributionKind: 'auth_index',
          provider: 'codex',
          requestCount: 3,
          failedCount: 1,
          totalTokens: 300,
          buckets: [
            {
              start: '2026-04-27T09:00:00.000Z',
              requestCount: 3,
              failedCount: 1,
              totalTokens: 300,
            },
          ],
        },
      ],
    },
    Date.parse('2026-04-27T10:30:00.000Z')
  );

  const summary = summaries.acct_auth;
  assert.equal(summary.source, 'attribution');
  assert.equal(summary.hasData, true);
  assert.equal(summary.requestCount, 3);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.totalTokens, 300);
});

test('shouldScheduleAccountUsageRefresh only polls live account cards', () => {
  const accounts = [
    {
      id: 'codex-api-key:local-1',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'local-1',
      status: 'ACTIVE',
    },
  ];

  assert.equal(
    shouldScheduleAccountUsageRefresh({
      ready: true,
      hasRuntimeBindings: true,
      accounts,
    }),
    true
  );
  assert.equal(
    shouldScheduleAccountUsageRefresh({
      ready: false,
      hasRuntimeBindings: true,
      accounts,
    }),
    false
  );
  assert.equal(
    shouldScheduleAccountUsageRefresh({
      ready: true,
      hasRuntimeBindings: false,
      accounts,
    }),
    false
  );
  assert.equal(
    shouldScheduleAccountUsageRefresh({
      ready: true,
      hasRuntimeBindings: true,
      accounts: [],
    }),
    false
  );
});
