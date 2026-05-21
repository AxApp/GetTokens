import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  applyCodexAccountPriorities,
  buildCodexAuthFileModelMappings,
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  buildCodexAccountRows,
  buildCodexAccountSummary,
  buildCodexRoutingProbeModelOptions,
  buildCodexRoutingProbeStreamLines,
  buildCodexRoutePolicyPreview,
  buildCodexRoutePolicyRowStates,
  buildCodexRoutePolicySummary,
  buildOpenAICompatibleModelMappings,
  mergeCodexAuthFileModelMappings,
  normalizeCodexModelMappingsForProvider,
  reorderCodexAccountRows,
  resolveCodexRoutingProbeDefaultModel,
  summarizeCodexRoutingProbeAttempt,
  buildCodexAccountPriorityUpdates,
} from './model/codexAccountList.ts';
import {
  CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY,
  CODEX_ORDER_SECTION_ACTION_MENU_GAP,
  DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE,
  DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
  filterCodexAccountOrderRows,
  getCodexAccountOrderGridClass,
  parseCodexAccountOrderDisplayMode,
  shouldUseCodexOrderSectionActionMenu,
} from './model/codexAccountOrderSectionLayout.ts';
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
      { name: 'deepseek-chat', alias: 'duplicate' },
    ],
  );
});

test('normalizeCodexModelMappingsForProvider keeps multiple codex aliases for one real model', () => {
  assert.deepEqual(
    normalizeCodexModelMappingsForProvider([
      { realModel: 'mimo-v2.5', codexModel: 'gpt-5.5' },
      { realModel: 'mimo-v2.5', codexModel: 'gpt-5.4' },
      { realModel: 'mimo-v2.5', codexModel: 'gpt-5.4' },
    ]),
    [
      { name: 'mimo-v2.5', alias: 'gpt-5.5' },
      { name: 'mimo-v2.5', alias: 'gpt-5.4' },
    ],
  );
});

test('reorderCodexAccountRows and buildCodexAccountPriorityUpdates preserve top-to-bottom request order', () => {
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

test('shouldUseCodexOrderSectionActionMenu collapses controls only when inline width no longer fits', () => {
  assert.equal(shouldUseCodexOrderSectionActionMenu(0, 320), false);
  assert.equal(shouldUseCodexOrderSectionActionMenu(320, 0), false);
  assert.equal(
    shouldUseCodexOrderSectionActionMenu(320 + CODEX_ORDER_SECTION_ACTION_MENU_GAP, 320),
    false,
  );
  assert.equal(
    shouldUseCodexOrderSectionActionMenu(320 + CODEX_ORDER_SECTION_ACTION_MENU_GAP - 1, 320),
    true,
  );
});

test('parseCodexAccountOrderDisplayMode supports persisted list sorting mode', () => {
  assert.equal(CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY, 'gettokens.codex.account-order-display-mode');
  assert.equal(DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE, 'compact');
  assert.equal(parseCodexAccountOrderDisplayMode('compact'), 'compact');
  assert.equal(parseCodexAccountOrderDisplayMode('list'), 'list');
  assert.equal(parseCodexAccountOrderDisplayMode('full'), 'full');
  assert.equal(parseCodexAccountOrderDisplayMode('unknown'), 'compact');
  assert.equal(parseCodexAccountOrderDisplayMode(null), 'compact');
});

test('filterCodexAccountOrderRows hides blocked accounts without reordering visible rows', () => {
  const rows = [
    { id: 'auth-file:a.json', requestable: true },
    { id: 'auth-file:disabled.json', requestable: false },
    { id: 'openai-compatible:mi', requestable: true },
  ];

  assert.equal(DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, 'all');
  assert.deepEqual(filterCodexAccountOrderRows(rows, 'all').map((row) => row.id), [
    'auth-file:a.json',
    'auth-file:disabled.json',
    'openai-compatible:mi',
  ]);
  assert.deepEqual(filterCodexAccountOrderRows(rows, 'requestable').map((row) => row.id), [
    'auth-file:a.json',
    'openai-compatible:mi',
  ]);
});

test('getCodexAccountOrderGridClass keeps list single-column and card modes adaptive', () => {
  assert.equal(getCodexAccountOrderGridClass('list'), 'grid gap-3 p-4');
  assert.match(getCodexAccountOrderGridClass('compact'), /codex-account-order-card-grid-compact/);
  assert.match(getCodexAccountOrderGridClass('full'), /codex-account-order-card-grid-full/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('compact'), /xl:grid-cols-3/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('full'), /xl:grid-cols-3/);
});

test('Codex account order cards reuse the account attribution card and keep custom controls in the footer', async () => {
  const source = await readFile(new URL('./components/CodexAccountOrderRow.tsx', import.meta.url), 'utf8');

  assert.match(source, /<AttributionCard/);
  assert.doesNotMatch(source, /customBody=\{/);
  assert.match(source, /footer=\{/);
  assert.match(source, /CodexAccountSpecialActionBar/);
});

test('routing probe model helpers prefer configured codex aliases and keep fallback', () => {
  const rows = [
    {
      modelMappings: [
        { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
        { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      ],
    },
    {
      modelMappings: [{ realModel: 'gpt-5.4-mini', codexModel: '' }],
    },
  ];

  assert.deepEqual(buildCodexRoutingProbeModelOptions(rows), ['codex-deepseek', 'deepseek-chat', 'gpt-5.4-mini', 'gpt-5.4']);
  assert.equal(resolveCodexRoutingProbeDefaultModel(rows), 'codex-deepseek');
});

test('summarizeCodexRoutingProbeAttempt shows landed account and evidence', () => {
  assert.equal(
    summarizeCodexRoutingProbeAttempt({
      index: 1,
      success: true,
      statusCode: 200,
      accountLabel: 'MI',
      evidence: 'recent requests +1',
    }),
    'MI · HTTP 200 · recent requests +1',
  );
});

test('buildCodexRoutingProbeStreamLines exposes candidate order and live attempt state', () => {
  const rows = [
    { id: 'openai-compatible:mi', label: 'MI', provider: 'MI', sourceKind: 'openai-compatible' },
    { id: 'auth-file:company.json', label: '公司', provider: 'codex', sourceKind: 'codex-auth-file' },
  ];

  assert.deepEqual(
    buildCodexRoutingProbeStreamLines(rows, [], {
      model: 'gpt-5.4',
      requestedAttempts: 3,
      running: true,
    }).map((line) => [line.marker, line.label, line.status]),
    [
      ['$', 'probe --model gpt-5.4 --attempts 3', 'command'],
      ['01', 'MI', 'running'],
      ['02', '公司', 'queued'],
      ['...', 'attempt 1 running', 'running'],
    ],
  );

  assert.deepEqual(
    buildCodexRoutingProbeStreamLines(
      rows,
      [
        {
          index: 1,
          success: true,
          statusCode: 200,
          accountID: 'auth-file:company.json',
          accountLabel: '公司',
          evidence: 'recent requests +1',
        },
      ],
      {
        model: 'gpt-5.4',
        requestedAttempts: 1,
        running: false,
      },
    ).map((line) => [line.marker, line.label, line.status]),
    [
      ['$', 'probe --model gpt-5.4 --attempts 1', 'command'],
      ['01', 'MI', 'passed'],
      ['02', '公司', 'hit'],
      ['#01', '公司 · HTTP 200 · recent requests +1', 'hit'],
    ],
  );
});

test('buildCodexRoutePolicyPreview applies deny, custom order, and strict fallback', () => {
  const rows = [
    { id: 'auth-file:a.json', label: 'A', requestable: true },
    { id: 'openai-compatible:mi', label: 'MI', requestable: true },
    { id: 'codex-api-key:local', label: 'Local', requestable: true },
    { id: 'auth-file:disabled.json', label: 'Disabled', requestable: false },
  ];

  assert.deepEqual(
    buildCodexRoutePolicyPreview(rows, {
      allowAccountIDs: ['openai-compatible:mi'],
      denyAccountIDs: ['codex-api-key:local'],
      orderAccountIDs: ['codex-api-key:local', 'openai-compatible:mi', 'auth-file:a.json'],
      allowFallback: false,
    }).map((row) => row.id),
    ['openai-compatible:mi'],
  );

  assert.deepEqual(
    buildCodexRoutePolicyPreview(rows, {
      allowAccountIDs: [],
      denyAccountIDs: ['codex-api-key:local'],
      orderAccountIDs: ['openai-compatible:mi'],
      allowFallback: true,
    }).map((row) => row.id),
    ['openai-compatible:mi', 'auth-file:a.json'],
  );
});

test('buildCodexRoutePolicyRowStates gives each account one policy mode and preview rank', () => {
  const rows = [
    { id: 'auth-file:a.json', label: 'A', requestable: true },
    { id: 'openai-compatible:mi', label: 'MI', requestable: true },
    { id: 'codex-api-key:local', label: 'Local', requestable: true },
    { id: 'auth-file:disabled.json', label: 'Disabled', requestable: false },
  ];
  const policy = {
    allowAccountIDs: ['openai-compatible:mi'],
    denyAccountIDs: ['codex-api-key:local'],
    orderAccountIDs: ['openai-compatible:mi', 'auth-file:a.json'],
    allowFallback: true,
  };

  const states = buildCodexRoutePolicyRowStates(rows, policy);
  assert.deepEqual(states['openai-compatible:mi'], { mode: 'allow', previewRank: 1, participates: true });
  assert.deepEqual(states['auth-file:a.json'], { mode: 'default', previewRank: 2, participates: true });
  assert.deepEqual(states['codex-api-key:local'], { mode: 'deny', previewRank: 0, participates: false });
  assert.deepEqual(states['auth-file:disabled.json'], { mode: 'blocked', previewRank: 0, participates: false });

  assert.deepEqual(buildCodexRoutePolicySummary(rows, policy), {
    allowCount: 1,
    denyCount: 1,
    orderedCount: 2,
    previewCount: 2,
    fallbackEnabled: true,
  });
});

test('buildCodexAuthFileModelMappings exposes auth-file web models as same-name passthrough rows', () => {
  assert.deepEqual(
    buildCodexAuthFileModelMappings([
      { id: 'gpt-5.4', display_name: 'GPT 5.4' },
      { name: 'gpt-5.4-mini' },
      { id: 'gpt-5.4' },
      { display_name: 'legacy-display-only' },
      { id: '' },
    ]),
    [
      { realModel: 'gpt-5.4', codexModel: 'gpt-5.4' },
      { realModel: 'gpt-5.4-mini', codexModel: 'gpt-5.4-mini' },
      { realModel: 'legacy-display-only', codexModel: 'legacy-display-only' },
    ],
  );
});

test('mergeCodexAuthFileModelMappings returns only explicit oauth aliases and leaves passthrough implicit', () => {
  assert.deepEqual(
    mergeCodexAuthFileModelMappings(
      [
        { id: 'gpt-5.4' },
        { id: 'gpt-5.4-mini' },
        { id: 'gpt-5.5' },
      ],
      [
        { name: 'gpt-5.4-mini', alias: 'gpt-5.4' },
        { name: 'gpt-5.4-mini', alias: 'gpt-5.5' },
        { name: 'gpt-5.4-mini', alias: 'gpt-5.5' },
        { name: 'gpt-5.4', alias: 'gpt-5.4' },
        { name: '', alias: 'ignored' },
      ],
    ),
    [
      { realModel: 'gpt-5.4-mini', codexModel: 'gpt-5.4' },
      { realModel: 'gpt-5.4-mini', codexModel: 'gpt-5.5' },
    ],
  );
});

test('buildCodexModelOptionNames returns unique real model names for dropdowns', () => {
  assert.deepEqual(
    buildCodexModelOptionNames([
      { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      { realModel: ' deepseek-reasoner ', codexModel: 'codex-reasoner' },
      { realModel: 'deepseek-chat', codexModel: 'duplicate' },
      { realModel: '', codexModel: 'empty' },
    ]),
    ['deepseek-chat', 'deepseek-reasoner'],
  );
});

test('buildCodexModelAliasOptionNames returns alias and real names for editable codex model dropdowns', () => {
  assert.deepEqual(
    buildCodexModelAliasOptionNames([
      { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      { realModel: 'deepseek-reasoner', codexModel: 'deepseek-reasoner' },
      { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      { realModel: 'custom-real', codexModel: '' },
    ]),
    ['codex-deepseek', 'deepseek-chat', 'deepseek-reasoner', 'custom-real'],
  );
});

test('getCodexAccountListPreviewRows provides browser-safe rows with model mappings', () => {
  const rows = getCodexAccountListPreviewRows();
  const codexPro = rows.find((row) => row.id === 'auth-file:codex-pro.json');
  const deepseek = rows.find((row) => row.id === 'openai-compatible:deepseek');

  assert.ok(rows.length >= 4);
  assert.deepEqual(codexPro?.modelMappings, []);
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
