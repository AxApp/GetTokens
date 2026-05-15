import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountHealthMetaItems } from '../model/accountHealthMeta.ts';

test('buildAccountHealthMetaItems formats failure and latency for health aside', () => {
  const t = (key) => key;

  assert.deepEqual(
    buildAccountHealthMetaItems(
      {
        source: 'attribution',
        hasData: true,
        requestCount: 1284,
        failedCount: 2,
        success: 8,
        failure: 2,
        successRate: 80,
        averageLatencyMs: 842,
        inputTokens: 3000,
        cachedInputTokens: 200,
        outputTokens: 1200,
        totalTokens: 4400,
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
      { label: 'accounts.recent_requests', value: '1,284 次' },
      { label: 'accounts.total_tokens', value: '4,400' },
      { label: 'accounts.average_latency', value: '842 ms' },
    ]
  );
});

test('buildAccountHealthMetaItems falls back to empty values', () => {
  const t = (key) => key;

  assert.deepEqual(buildAccountHealthMetaItems(undefined, t), [
    { label: 'accounts.recent_requests', value: '0 次' },
    { label: 'accounts.total_tokens', value: '0' },
    { label: 'accounts.average_latency', value: '—' },
  ]);
});
