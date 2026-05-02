import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRelayModelProviderSignature,
  resolveAPIKeyModelMenuNames,
} from '../model/apiKeyModelCatalog.ts';

test('resolveAPIKeyModelMenuNames returns the full catalog while browsing', () => {
  const models = ['gpt-5.4-mini', 'deepseek-chat', 'qwen3-plus'];

  assert.deepEqual(resolveAPIKeyModelMenuNames(models, 'gpt-5.4-mini', 'browse'), models);
});

test('resolveAPIKeyModelMenuNames filters only after the user edits the query', () => {
  assert.deepEqual(
    resolveAPIKeyModelMenuNames(['gpt-5.4-mini', 'deepseek-chat', 'qwen3-plus'], 'deep', 'filter'),
    ['deepseek-chat'],
  );
});

test('buildRelayModelProviderSignature changes when provider model catalog changes', () => {
  const previous = buildRelayModelProviderSignature([
    {
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      models: [{ name: 'deepseek-chat' }],
    },
  ]);
  const next = buildRelayModelProviderSignature([
    {
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      models: [{ name: 'deepseek-chat' }, { name: 'deepseek-reasoner' }],
    },
  ]);

  assert.notEqual(next, previous);
});
