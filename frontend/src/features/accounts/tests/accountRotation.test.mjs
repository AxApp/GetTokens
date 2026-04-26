import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPriorityUpdates, reorderPriorityAccounts } from '../model/accountRotation.ts';

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
