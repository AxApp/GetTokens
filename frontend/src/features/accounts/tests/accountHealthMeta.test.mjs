import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountHealthMetaItems } from '../model/accountHealthMeta.ts';

test('buildAccountHealthMetaItems formats failure and latency for health aside', () => {
  const t = (key) => key;

  assert.deepEqual(
    buildAccountHealthMetaItems(
      {
        hasData: true,
        success: 8,
        failure: 2,
        successRate: 80,
        averageLatencyMs: 842,
        lastActivityAt: 1,
        statusBar: {
          blocks: [],
          blockDetails: [],
          successRate: 80,
          totalSuccess: 8,
          totalFailure: 2,
        },
      },
      t
    ),
    [
      { label: 'accounts.recent_failure', value: '2' },
      { label: 'accounts.average_latency', value: '842 ms' },
    ]
  );
});

test('buildAccountHealthMetaItems falls back to empty values', () => {
  const t = (key) => key;

  assert.deepEqual(buildAccountHealthMetaItems(undefined, t), [
    { label: 'accounts.recent_failure', value: '0' },
    { label: 'accounts.average_latency', value: '—' },
  ]);
});
