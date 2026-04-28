import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPriorityUpdates,
  buildRotationQuotaSummary,
  buildRoutingDefaultLabel,
  mapOpenAICompatibleProviderToRotationAccount,
  reorderPriorityAccounts,
} from '../model/accountRotation.ts';

test('reorderPriorityAccounts moves dragged account before target account', () => {
  const accounts = [
    { id: 'api-key:1', displayName: 'One', priority: 3 },
    { id: 'api-key:2', displayName: 'Two', priority: 2 },
    { id: 'api-key:3', displayName: 'Three', priority: 1 },
  ];

  const reordered = reorderPriorityAccounts(accounts, 'api-key:3', 'api-key:1');

  assert.deepEqual(
    reordered.map((account) => account.id),
    ['api-key:3', 'api-key:1', 'api-key:2']
  );
});

test('buildPriorityUpdates assigns descending priorities from top to bottom', () => {
  const accounts = [
    { id: 'api-key:3', displayName: 'Three', priority: 1 },
    { id: 'api-key:1', displayName: 'One', priority: 3 },
    { id: 'api-key:2', displayName: 'Two', priority: 2 },
  ];

  const updates = buildPriorityUpdates(accounts);

  assert.deepEqual(updates, [
    { id: 'api-key:3', priority: 3 },
    { id: 'api-key:1', priority: 2 },
    { id: 'api-key:2', priority: 1 },
  ]);
});

test('buildPriorityUpdates omits accounts whose priority does not change', () => {
  const accounts = [
    { id: 'api-key:1', displayName: 'One', priority: 2 },
    { id: 'api-key:2', displayName: 'Two', priority: 1 },
  ];

  const updates = buildPriorityUpdates(accounts);

  assert.deepEqual(updates, []);
});

test('mapOpenAICompatibleProviderToRotationAccount preserves provider priority', () => {
  const account = mapOpenAICompatibleProviderToRotationAccount({
    name: 'deepseek',
    priority: 7,
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'team-a',
    apiKey: 'sk-test',
  });

  assert.deepEqual(account, {
    id: 'openai-compatible:deepseek',
    provider: 'deepseek',
    credentialSource: 'api-key',
    displayName: '兼容 OpenAI · deepseek',
    status: 'CONFIGURED',
    priority: 7,
    name: 'deepseek',
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'team-a',
  });
});

test('buildRoutingDefaultLabel exposes explicit defaults for routing fields', () => {
  const t = (key) =>
    ({
      'status.default_value': '默认',
      'status.routing_strategy_round_robin': '轮询',
      'status.disabled': '关闭',
    })[key] || key;

  assert.equal(buildRoutingDefaultLabel(t, 'strategy'), '默认: 轮询');
  assert.equal(buildRoutingDefaultLabel(t, 'sessionAffinityTTL'), '默认: 1h');
  assert.equal(buildRoutingDefaultLabel(t, 'requestRetry'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'maxRetryCredentials'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'maxRetryInterval'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'sessionAffinity'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'switchProject'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'switchPreviewModel'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'antigravityCredits'), '默认: 关闭');
});

test('buildRotationQuotaSummary prefers the longest quota window for codex auth files', () => {
  const t = (key) =>
    ({
      'accounts.quota_remaining': '剩余',
      'accounts.quota_reset': '重置时间',
      'accounts.quota_syncing': '额度同步中...',
      'accounts.quota_unavailable': '额度暂不可用',
      'accounts.rotation_quota_not_tracked': '当前资产不跟踪额度',
    })[key] || key;

  const summary = buildRotationQuotaSummary(
    {
      id: 'auth-file:pro.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'pro.json',
      quotaKey: 'pro.json',
    },
    {
      status: 'success',
      quota: {
        planType: 'pro',
        windows: [
          { id: 'five-hour', label: '5H', remainingPercent: 80, resetLabel: '05/01 10:00', resetAtUnix: 1 },
          { id: 'weekly', label: '7D', remainingPercent: 25, resetLabel: '05/07 10:00', resetAtUnix: 4102444800 },
        ],
      },
    },
    t
  );

  assert.match(summary, /^7D · 剩余 25% · 重置时间 /);
});

test('buildRotationQuotaSummary returns fallback labels for loading and unsupported assets', () => {
  const t = (key) =>
    ({
      'accounts.quota_remaining': '剩余',
      'accounts.quota_reset': '重置时间',
      'accounts.quota_syncing': '额度同步中...',
      'accounts.quota_unavailable': '额度暂不可用',
      'accounts.rotation_quota_not_tracked': '当前资产不跟踪额度',
    })[key] || key;

  assert.equal(
    buildRotationQuotaSummary(
      {
        id: 'auth-file:syncing.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'syncing.json',
        quotaKey: 'syncing.json',
      },
      undefined,
      t
    ),
    '额度同步中...'
  );

  assert.equal(
    buildRotationQuotaSummary(
      {
        id: 'api-key:1',
        provider: 'openai',
        credentialSource: 'api-key',
        displayName: 'OPENAI API KEY',
      },
      undefined,
      t
    ),
    '当前资产不跟踪额度'
  );
});
