import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCodexAccountPriorities,
  buildCodexAccountRows,
  buildCodexAccountSummary,
  buildOpenAICompatibleModelMappings,
  normalizeCodexModelMappingsForProvider,
  reorderCodexAccountRows,
  buildCodexAccountPriorityUpdates,
} from './model/codexAccountList.ts';
import { getCodexAccountListPreviewRows } from './previewData.ts';

test('buildCodexAccountRows merges codex auth files, codex api keys, and openai-compatible providers by priority', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'auth-file:pro.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'pro.json',
        status: 'active',
        priority: 1,
      },
      {
        id: 'codex-api-key:stable',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Prod Key',
        status: 'configured',
        priority: 4,
      },
      {
        id: 'auth-file:claude.json',
        provider: 'claude',
        credentialSource: 'auth-file',
        displayName: 'claude.json',
        status: 'active',
        priority: 99,
      },
    ],
    providers: [
      {
        name: 'deepseek',
        priority: 7,
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        models: [{ alias: 'codex-deepseek', name: 'deepseek-chat' }],
      },
    ],
  });

  assert.deepEqual(
    rows.map((row) => row.id),
    ['openai-compatible:deepseek', 'codex-api-key:stable', 'auth-file:pro.json'],
  );
  assert.equal(rows[0].sourceKind, 'openai-compatible');
  assert.equal(rows[0].requestable, true);
});

test('buildCodexAccountRows keeps disabled or errored accounts in order but marks them not requestable', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'auth-file:expired.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'expired.json',
        status: 'error',
        statusMessage: 'refresh token expired',
        priority: 2,
      },
    ],
    providers: [
      {
        name: 'openrouter',
        priority: 1,
        disabled: true,
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-or-test',
        models: [],
      },
    ],
  });

  assert.deepEqual(
    rows.map((row) => [row.id, row.requestable, row.blockReason]),
    [
      ['auth-file:expired.json', false, 'refresh token expired'],
      ['openai-compatible:openrouter', false, 'disabled'],
    ],
  );
});

test('buildOpenAICompatibleModelMappings exposes real model to codex model mappings with same-name fallback', () => {
  assert.deepEqual(
    buildOpenAICompatibleModelMappings({
      name: 'deepseek',
      models: [
        { alias: 'codex-deepseek', name: 'deepseek-chat' },
        { alias: '', name: 'deepseek-reasoner' },
        { alias: 'blank-name', name: '' },
      ],
    }),
    [
      { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      { realModel: 'deepseek-reasoner', codexModel: 'deepseek-reasoner' },
    ],
  );
});

test('normalizeCodexModelMappingsForProvider stores real model names and codex aliases', () => {
  assert.deepEqual(
    normalizeCodexModelMappingsForProvider([
      { realModel: ' deepseek-chat ', codexModel: ' codex-deepseek ' },
      { realModel: 'deepseek-reasoner', codexModel: 'deepseek-reasoner' },
      { realModel: 'deepseek-chat', codexModel: 'duplicate' },
      { realModel: '', codexModel: 'blank' },
    ]),
    [
      { name: 'deepseek-chat', alias: 'codex-deepseek' },
      { name: 'deepseek-reasoner', alias: '' },
    ],
  );
});

test('reorderCodexAccountRows and buildCodexAccountPriorityUpdates preserve descending request order', () => {
  const rows = [
    { id: 'a', label: 'A', priority: 3 },
    { id: 'b', label: 'B', priority: 2 },
    { id: 'c', label: 'C', priority: 1 },
  ];

  const reordered = reorderCodexAccountRows(rows, 'c', 'a');
  assert.deepEqual(
    reordered.map((row) => row.id),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(buildCodexAccountPriorityUpdates(reordered), [
    { id: 'c', priority: 3 },
    { id: 'a', priority: 2 },
    { id: 'b', priority: 1 },
  ]);
});

test('applyCodexAccountPriorities updates local browser-preview priority values after saving order', () => {
  const rows = [
    { id: 'c', label: 'C', priority: 1 },
    { id: 'a', label: 'A', priority: 3 },
    { id: 'b', label: 'B', priority: 2 },
  ];

  assert.deepEqual(applyCodexAccountPriorities(rows), [
    { id: 'c', label: 'C', priority: 3 },
    { id: 'a', label: 'A', priority: 2 },
    { id: 'b', label: 'B', priority: 1 },
  ]);
});

test('getCodexAccountListPreviewRows provides browser-safe rows with model mappings', () => {
  const rows = getCodexAccountListPreviewRows();
  const deepseek = rows.find((row) => row.id === 'openai-compatible:deepseek');

  assert.ok(rows.length >= 4);
  assert.deepEqual(deepseek?.modelMappings.slice(0, 2), [
    { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
    { realModel: 'deepseek-reasoner', codexModel: 'codex-reasoner' },
  ]);
});

test('buildCodexAccountSummary counts total, requestable, disabled, and openai-compatible rows', () => {
  const summary = buildCodexAccountSummary([
    { id: 'a', sourceKind: 'codex-auth-file', requestable: true },
    { id: 'b', sourceKind: 'codex-api-key', requestable: false, blockReason: 'disabled' },
    { id: 'c', sourceKind: 'openai-compatible', requestable: true },
  ]);

  assert.deepEqual(summary, {
    total: 3,
    requestable: 2,
    blocked: 1,
    openAICompatible: 1,
  });
});
