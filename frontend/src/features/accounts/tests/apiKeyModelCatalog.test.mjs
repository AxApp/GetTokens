import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRelayModelProviderSignature,
  resolveAPIKeyModelMenuNames,
} from '../model/apiKeyModelCatalog.ts';

test('resolveAPIKeyModelMenuNames returns the full catalog while browsing in model-size order', () => {
  const models = ['gpt-5.2', 'gpt-5.4-mini', 'gpt-5.5', 'gpt-5.3-codex', 'gpt-5.4'];

  assert.deepEqual(resolveAPIKeyModelMenuNames(models, 'gpt-5.4-mini', 'browse'), [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
});

test('resolveAPIKeyModelMenuNames filters only after the user edits the query', () => {
  assert.deepEqual(
    resolveAPIKeyModelMenuNames(['gpt-5.2', 'gpt-5.4-mini', 'deepseek-chat', 'gpt-5.4'], 'gpt', 'filter'),
    ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2'],
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
