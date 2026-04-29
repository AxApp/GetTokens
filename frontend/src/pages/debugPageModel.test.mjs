import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDebugEntryViewModels, formatDebugPayload } from './debugPageModel.ts';

function createEntry(overrides = {}) {
  return {
    id: 'entry-1',
    name: 'GetQuota',
    transport: 'http',
    status: 'success',
    request: { url: '/usage', headers: { authorization: 'Bearer ***' } },
    response: { data: Array.from({ length: 50 }, (_, index) => ({ index, value: `payload-${index}` })) },
    error: undefined,
    startedAt: '2026-04-30T10:00:00.000Z',
    endedAt: '2026-04-30T10:00:01.000Z',
    durationMs: 1000,
    ...overrides,
  };
}

test('buildDebugEntryViewModels keeps entries collapsed by default and skips payload formatting', () => {
  const source = createEntry();
  let formatCalls = 0;

  const models = buildDebugEntryViewModels([source], {
    expandedIDs: [],
    formatPayload: (value) => {
      formatCalls += 1;
      return JSON.stringify(value);
    },
  });

  assert.equal(models.length, 1);
  assert.equal(models[0].isExpanded, false);
  assert.equal(models[0].requestText, null);
  assert.equal(models[0].responseText, null);
  assert.equal(formatCalls, 0);
});

test('buildDebugEntryViewModels formats only expanded entries', () => {
  const first = createEntry({ id: 'entry-1' });
  const second = createEntry({ id: 'entry-2', name: 'Healthz', response: { ok: true } });
  let formatCalls = 0;

  const models = buildDebugEntryViewModels([first, second], {
    expandedIDs: ['entry-2'],
    formatPayload: (value) => {
      formatCalls += 1;
      return JSON.stringify(value);
    },
  });

  assert.equal(models[0].requestText, null);
  assert.equal(models[0].responseText, null);
  assert.equal(models[1].requestText, JSON.stringify(second.request));
  assert.equal(models[1].responseText, JSON.stringify(second.response));
  assert.equal(formatCalls, 2);
});

test('buildDebugEntryViewModels shows error payload when entry failed', () => {
  const entry = createEntry({ status: 'error', error: 'request timeout', response: { ignored: true } });

  const [model] = buildDebugEntryViewModels([entry], {
    expandedIDs: [entry.id],
    formatPayload: (value) => JSON.stringify(value),
  });

  assert.equal(model.responseText, JSON.stringify('request timeout'));
});

test('formatDebugPayload keeps string values intact and renders undefined as dash', () => {
  assert.equal(formatDebugPayload(undefined), '—');
  assert.equal(formatDebugPayload('plain-text'), 'plain-text');
});
