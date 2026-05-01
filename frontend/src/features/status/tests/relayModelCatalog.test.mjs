import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterRelayModelCatalogByQuery,
  mergeRelayModelCatalog,
  resolveRelayModelReasoningProfile,
  sortRelayModelCatalogByNameDesc,
} from '../model/relayModelCatalog.ts';

test('mergeRelayModelCatalog merges account-pool models with custom local additions', () => {
  const catalog = mergeRelayModelCatalog(
    [
      {
        name: 'gpt-5.5',
        alias: 'GPT 5.5',
        supportedReasoningEfforts: ['low', 'high', 'xhigh'],
        defaultReasoningEffort: 'high',
      },
      {
        name: 'gpt-5.4-mini',
        supportedReasoningEfforts: ['minimal'],
        defaultReasoningEffort: 'minimal',
      },
    ],
    ['gpt-5.5', 'custom-relay-model'],
  );

  assert.deepEqual(catalog, [
    {
      name: 'gpt-5.5',
      alias: 'GPT 5.5',
      supportedReasoningEfforts: ['low', 'high', 'xhigh'],
      defaultReasoningEffort: 'high',
      fromAccountPool: true,
      fromCustom: true,
    },
    {
      name: 'gpt-5.4-mini',
      alias: '',
      supportedReasoningEfforts: ['minimal'],
      defaultReasoningEffort: 'minimal',
      fromAccountPool: true,
      fromCustom: false,
    },
    {
      name: 'custom-relay-model',
      alias: '',
      supportedReasoningEfforts: [],
      defaultReasoningEffort: '',
      fromAccountPool: false,
      fromCustom: true,
    },
  ]);
});

test('resolveRelayModelReasoningProfile prefers model-specific reasoning capabilities', () => {
  const profile = resolveRelayModelReasoningProfile('gpt-5.5', [
    {
      name: 'gpt-5.5',
      alias: '',
      supportedReasoningEfforts: ['minimal', 'high'],
      defaultReasoningEffort: 'high',
      fromAccountPool: true,
      fromCustom: false,
    },
  ]);

  assert.deepEqual(profile, {
    options: ['minimal', 'high'],
    defaultValue: 'high',
  });
});

test('resolveRelayModelReasoningProfile falls back to codex defaults when model metadata is absent', () => {
  const profile = resolveRelayModelReasoningProfile('custom-relay-model', [
    {
      name: 'custom-relay-model',
      alias: '',
      supportedReasoningEfforts: [],
      defaultReasoningEffort: '',
      fromAccountPool: false,
      fromCustom: true,
    },
  ]);

  assert.deepEqual(profile, {
    options: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
    defaultValue: 'high',
  });
});

test('sortRelayModelCatalogByNameDesc orders models by name descending', () => {
  const sorted = sortRelayModelCatalogByNameDesc([
    {
      name: 'gpt-5.4',
      alias: '',
      supportedReasoningEfforts: [],
      defaultReasoningEffort: '',
      fromAccountPool: true,
      fromCustom: false,
    },
    {
      name: 'gpt-5.5',
      alias: '',
      supportedReasoningEfforts: [],
      defaultReasoningEffort: '',
      fromAccountPool: true,
      fromCustom: false,
    },
    {
      name: 'gpt-5.3-codex',
      alias: '',
      supportedReasoningEfforts: [],
      defaultReasoningEffort: '',
      fromAccountPool: true,
      fromCustom: false,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.name),
    ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex'],
  );
});

test('filterRelayModelCatalogByQuery matches name and alias with trimmed lowercase query', () => {
  const filtered = filterRelayModelCatalogByQuery(
    [
      {
        name: 'gpt-5.5',
        alias: 'GPT 5.5 Flagship',
        supportedReasoningEfforts: [],
        defaultReasoningEffort: '',
        fromAccountPool: true,
        fromCustom: false,
      },
      {
        name: 'gpt-5.4-mini',
        alias: 'Fast lane',
        supportedReasoningEfforts: [],
        defaultReasoningEffort: '',
        fromAccountPool: true,
        fromCustom: false,
      },
    ],
    '  FLAG  ',
  );

  assert.deepEqual(
    filtered.map((item) => item.name),
    ['gpt-5.5'],
  );
});
