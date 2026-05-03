import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountUsageSummary,
  buildAccountUsageSummaryMap,
  buildCandidateUsageSourceIds,
  calculateStatusBarData,
  collectUsageDetails,
  normalizeUsageSourceId,
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
