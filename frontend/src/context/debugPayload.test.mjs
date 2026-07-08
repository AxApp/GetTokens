import assert from 'node:assert/strict';
import test from 'node:test';

import { DEBUG_ENTRY_LIMIT, limitDebugEntries, summarizeDebugPayload } from './debugPayload.ts';

test('summarizeDebugPayload stores array metadata without retaining every item', () => {
  const payload = {
    accounts: Array.from({ length: 4000 }, (_, index) => ({
      id: `account-${index}`,
      apiKey: `sk-secret-${index}`,
    })),
  };

  const summary = summarizeDebugPayload(payload);

  assert.deepEqual(summary.accounts, {
    type: 'array',
    length: 4000,
  });
  assert.doesNotMatch(JSON.stringify(summary), /sk-secret-/);
});

test('summarizeDebugPayload redacts sensitive keys and truncates long strings', () => {
  const summary = summarizeDebugPayload({
    authorization: 'Bearer live-token',
    refreshToken: 'refresh-token',
    message: 'x'.repeat(700),
  });

  assert.equal(summary.authorization, '[redacted]');
  assert.equal(summary.refreshToken, '[redacted]');
  assert.match(summary.message, /\[truncated 200 chars\]$/);
  assert.equal(summary.message.length < 700, true);
});

test('limitDebugEntries keeps the latest bounded request entries', () => {
  const entries = Array.from({ length: DEBUG_ENTRY_LIMIT + 5 }, (_, index) => ({
    id: String(index),
    name: 'ListAccounts',
    transport: 'wails',
    status: 'success',
    request: {},
    startedAt: '2026-07-08T00:00:00.000Z',
  }));

  const limited = limitDebugEntries(entries);

  assert.equal(limited.length, DEBUG_ENTRY_LIMIT);
  assert.equal(limited[0].id, '0');
  assert.equal(limited.at(-1).id, String(DEBUG_ENTRY_LIMIT - 1));
});
