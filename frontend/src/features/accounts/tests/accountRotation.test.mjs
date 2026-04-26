import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPriorityUpdates, buildRoutingDefaultLabel, reorderPriorityAccounts } from '../model/accountRotation.ts';

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

test('buildRoutingDefaultLabel exposes explicit defaults for routing fields', () => {
  const t = (key) =>
    ({
      'status.default_value': '默认',
      'status.disabled': '关闭',
    })[key] || key;

  assert.equal(buildRoutingDefaultLabel(t, 'strategy'), '默认: round-robin');
  assert.equal(buildRoutingDefaultLabel(t, 'sessionAffinityTTL'), '默认: 1h');
  assert.equal(buildRoutingDefaultLabel(t, 'requestRetry'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'maxRetryCredentials'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'maxRetryInterval'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'sessionAffinity'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'switchProject'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'switchPreviewModel'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'antigravityCredits'), '默认: 关闭');
});
