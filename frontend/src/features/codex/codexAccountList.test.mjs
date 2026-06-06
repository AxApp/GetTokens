import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  applyCodexAccountPriorities,
  buildCodexAccountDetailModulePlan,
  buildCodexAuthFileModelMappings,
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  buildCodexAccountRows,
  buildCodexQuotaSummaryAccount,
  buildCodexAccountSummary,
  buildCodexRoutingProbeModelOptions,
  buildCodexRoutingProbeStreamLines,
  canEditCodexModelMappings,
  buildCodexRoutePolicyPreview,
  buildCodexRoutePolicyRowStates,
  buildCodexRoutePolicySummary,
  buildOpenAICompatibleModelMappings,
  mergeCodexAuthFileModelMappings,
  moveCodexAccountRowToEdge,
  normalizeCodexModelMappingsForProvider,
  patchCodexAccountRowDisabled,
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
  applyCodexAccountOrderFilter,
  chooseCodexOrderSectionActionLayout,
  filterCodexAccountOrderRows,
  getCodexAccountOrderGridClass,
  normalizeCodexAccountOrderFilter,
  parseCodexAccountOrderDisplayMode,
  summarizeCodexAccountOrderFilter,
  shouldUseCodexOrderSectionActionMenu,
} from './model/codexAccountOrderSectionLayout.ts';
import { getCodexAccountListPreviewRows } from './previewData.ts';
import { buildQuotaDisplay, supportsQuota } from '../accounts/model/accountQuota.ts';

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
    ['deepseek', 'codex-api-key:stable', 'auth-file:pro.json'],
  );
  assert.equal(rows[0].sourceKind, 'openai-compatible');
  assert.equal(rows[0].requestable, true);
  assert.deepEqual(rows[0].supportedFormats, ['openai_chat']);
});

test('buildCodexAccountRows keeps codex api key model mappings from stored account models', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'codex-api-key:relay',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Relay Key',
        status: 'configured',
        models: [
          { name: 'deepseek-chat', alias: 'gpt-5.4' },
          { name: 'deepseek-reasoner', alias: '' },
        ],
      },
    ],
    providers: [],
  });

  assert.deepEqual(rows[0].modelMappings, [
    { realModel: 'deepseek-chat', codexModel: 'gpt-5.4' },
    { realModel: 'deepseek-reasoner', codexModel: 'deepseek-reasoner' },
  ]);
});

test('canEditCodexModelMappings allows codex api key mappings in detail modal editor', () => {
  assert.equal(canEditCodexModelMappings('openai-compatible'), true);
  assert.equal(canEditCodexModelMappings('codex-auth-file'), true);
  assert.equal(canEditCodexModelMappings('codex-api-key'), true);
});

test('buildCodexAccountDetailModulePlan merges account detail modules with model routing by account type', () => {
  assert.deepEqual(
    buildCodexAccountDetailModulePlan({ sourceKind: 'openai-compatible' }),
    ['credentials', 'rate-limit', 'quota', 'billing', 'model-routing'],
  );
  assert.deepEqual(
    buildCodexAccountDetailModulePlan({ sourceKind: 'codex-api-key' }),
    ['credentials', 'rate-limit', 'quota', 'billing', 'model-routing'],
  );
  assert.deepEqual(
    buildCodexAccountDetailModulePlan({ sourceKind: 'codex-auth-file' }),
    ['auth-file-actions', 'models', 'rate-limit', 'quota', 'billing', 'model-routing'],
  );
});

test('codex account detail header keeps labeled identity and metadata blocks', async () => {
  const source = await readFile(new URL('./components/CodexAccountDetailModal.tsx', import.meta.url), 'utf8');
  const summaryBlock = source.match(/<dl[\s\S]*?data-codex-account-detail-header="summary"[\s\S]*?<\/dl>/)?.[0] ?? '';
  const metaBlock = source.match(/function AccountDetailHeaderMeta[\s\S]*?\n}\n\nexport function CodexAccountDetailModal/)?.[0] ?? '';

  assert.match(source, /export function CodexAccountDetailHeader/);
  assert.match(source, /sourceKindLabel\(t, row\.sourceKind\)/);
  assert.match(source, /data-codex-account-detail-header="summary"/);
  assert.match(summaryBlock, /flex min-w-0 flex-wrap/);
  assert.doesNotMatch(summaryBlock, /grid/);
  assert.doesNotMatch(summaryBlock, /sm:grid-cols/);
  assert.match(metaBlock, /inline-flex max-w-full items-center/);
  assert.match(metaBlock, /<dt/);
  assert.match(metaBlock, /<dd/);
  assert.doesNotMatch(metaBlock, /mt-1/);
  assert.match(source, /t\('common\.type'\)/);
  assert.match(source, /t\('common\.status'\)/);
  assert.match(source, /t\('codex\.account_list_route'\)/);
  assert.match(source, /t\('codex\.account_list_priority'\)/);
  assert.match(source, /t\('common\.enable'\)/);
});

test('codex account detail folds proxy route into credential section', async () => {
  const modalSource = await readFile(new URL('./components/CodexAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(modalSource, /import AccountProxyRouteSection/);
  assert.doesNotMatch(modalSource, /case 'proxy-route':/);
  assert.match(modalSource, /<AccountCredentialVerifySection[\s\S]*?span="wide"[\s\S]*?onProxyValidityChange=\{setProxyRouteError\}/);
});

test('codex oauth detail renders quota and billing as read-only resource modules', async () => {
  const modalSource = await readFile(new URL('./components/CodexAccountDetailModal.tsx', import.meta.url), 'utf8');
  const detailSectionsSource = await readFile(new URL('../accounts/components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /const readOnlyQuotaScripts = row\.sourceKind === 'codex-auth-file'/);
  assert.match(modalSource, /<AccountQuotaSection[\s\S]*?readOnlyScripts=\{readOnlyQuotaScripts\}/);
  assert.match(modalSource, /<AccountBillingSection[\s\S]*?readOnlyScripts=\{readOnlyQuotaScripts\}/);
  assert.match(detailSectionsSource, /readOnlyScripts\?: boolean/);
  assert.match(detailSectionsSource, /const quotaActions = readOnlyScripts \? undefined :/);
  assert.match(detailSectionsSource, /const billingActions = readOnlyScripts \? undefined :/);
});

test('codex model routing detail exposes fetch-model action from the account list', async () => {
  const modalSource = await readFile(new URL('./components/CodexAccountDetailModal.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');
  const routingBlock = modalSource.match(/function CodexModelRoutingSection[\s\S]*?\nfunction buildEditableModelMappings/)?.[0] ?? '';

  assert.match(modalSource, /onFetchModelOptions\?: \(\) => void/);
  assert.match(routingBlock, /t\('accounts\.openai_provider_models_fetch'\)/);
  assert.match(routingBlock, /onClick=\{onFetchModelOptions\}/);
  assert.match(featureSource, /async function fetchDetailModelOptions\(row: CodexAccountRow\)/);
  assert.match(featureSource, /onFetchModelOptions=\{\(\) => void fetchDetailModelOptions\(detailRowWithModels\)\}/);
});

test('codex account list route probe modal is hash-routed', async () => {
  const source = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /buildCodexModalFrameHash/);
  assert.match(source, /clearCodexModalFrameHash/);
  assert.match(source, /hashState\?\.page === 'codex' && hashState\.codexWorkspace === 'account-list'/);
  assert.match(source, /hashState\?\.modal === 'route-probe'/);
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
      ['openrouter', false, 'disabled'],
    ],
  );
});

test('patchCodexAccountRowDisabled keeps Codex requestability in sync with account disabled events', () => {
  const row = {
    id: 'codex-api-key:stable',
    label: 'Stable',
    sourceKind: 'codex-api-key',
    provider: 'codex',
    requestable: true,
    blockReason: '',
    status: 'configured',
    baseUrl: 'https://api.openai.com/v1',
    prefix: '',
    keySuffix: '1111',
    modelMappings: [],
  };

  assert.deepEqual(
    patchCodexAccountRowDisabled(row, true),
    {
      ...row,
      disabled: true,
      requestable: false,
      blockReason: 'disabled',
      status: 'disabled',
    },
  );

  assert.deepEqual(
    patchCodexAccountRowDisabled({ ...row, disabled: true, requestable: false, blockReason: 'disabled', status: 'disabled' }, false),
    {
      ...row,
      disabled: false,
      requestable: true,
      blockReason: '',
      status: 'configured',
    },
  );
});

test('buildCodexAccountRows preserves account quota and billing metadata for shared account cards', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'codex-api-key:stable',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Prod Key',
        status: 'configured',
        quotaKey: 'codex-api-key:stable',
        quotaCurl: 'curl https://quota.example.test',
        quotaEnabled: true,
        billingCurl: 'curl https://billing.example.test',
        billingEnabled: true,
      },
    ],
    providers: [],
  });

  const account = buildCodexQuotaSummaryAccount(rows[0]);

  assert.equal(account.quotaCurl, 'curl https://quota.example.test');
  assert.equal(account.quotaEnabled, true);
  assert.equal(account.billingCurl, 'curl https://billing.example.test');
  assert.equal(account.billingEnabled, true);
  assert.equal(supportsQuota(account), true);
  assert.equal(buildQuotaDisplay(account, { status: 'loading' }).status, 'loading');
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

test('moveCodexAccountRowToEdge moves rows directly to top or bottom', () => {
  const rows = [
    { id: 'a', label: 'A', priority: 3 },
    { id: 'b', label: 'B', priority: 2 },
    { id: 'c', label: 'C', priority: 1 },
  ];

  assert.deepEqual(
    moveCodexAccountRowToEdge(rows, 'b', 'top').map((row) => row.id),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(
    moveCodexAccountRowToEdge(rows, 'b', 'bottom').map((row) => row.id),
    ['a', 'c', 'b'],
  );
  assert.deepEqual(
    buildCodexAccountPriorityUpdates(moveCodexAccountRowToEdge(rows, 'b', 'top')),
    [
      { id: 'b', priority: 3 },
      { id: 'a', priority: 2 },
    ],
  );
  assert.deepEqual(
    moveCodexAccountRowToEdge(rows, 'missing', 'top').map((row) => row.id),
    ['a', 'b', 'c'],
  );
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

test('chooseCodexOrderSectionActionLayout expands inline, wraps, then falls back to menu', () => {
  assert.equal(
    chooseCodexOrderSectionActionLayout({
      headerWidth: 980,
      titleWidth: 300,
      inlineActionsWidth: 560,
    }),
    'inline',
  );
  assert.equal(
    chooseCodexOrderSectionActionLayout({
      headerWidth: 720,
      titleWidth: 300,
      inlineActionsWidth: 560,
    }),
    'wrapped',
  );
  assert.equal(
    chooseCodexOrderSectionActionLayout({
      headerWidth: 520,
      titleWidth: 300,
      inlineActionsWidth: 560,
    }),
    'menu',
  );
  assert.equal(
    chooseCodexOrderSectionActionLayout({
      headerWidth: 0,
      titleWidth: 300,
      inlineActionsWidth: 560,
    }),
    'menu',
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
    { id: 'auth-file:a.json', sourceKind: 'codex-auth-file', requestable: true, status: 'active' },
    { id: 'auth-file:disabled.json', sourceKind: 'codex-auth-file', requestable: false, disabled: true, status: 'disabled' },
    { id: 'openai-compatible:mi', sourceKind: 'openai-compatible', requestable: true, status: 'configured' },
  ];

  assert.deepEqual(DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, {
    source: 'all',
    requiresParticipating: false,
    requiresSkipped: false,
    requiresRequestable: false,
    requiresBlocked: false,
    requiresDisabled: false,
    hasBalance: false,
    hasLongestQuota: false,
    requiresError: false,
  });
  assert.deepEqual(filterCodexAccountOrderRows(rows, DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, {}).map((row) => row.id), [
    'auth-file:a.json',
    'auth-file:disabled.json',
    'openai-compatible:mi',
  ]);
  assert.deepEqual(filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresRequestable: true }, {}).map((row) => row.id), [
    'auth-file:a.json',
    'openai-compatible:mi',
  ]);
  assert.deepEqual(filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresBlocked: true }, {}).map((row) => row.id), [
    'auth-file:disabled.json',
  ]);
  assert.deepEqual(
    normalizeCodexAccountOrderFilter({ ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresRequestable: true, requiresBlocked: true }),
    { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresRequestable: true, requiresBlocked: true },
  );
  assert.deepEqual(
    normalizeCodexAccountOrderFilter({
      ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
      source: 'blocked-only',
    }),
    DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
  );
});

test('applyCodexAccountOrderFilter normalizes patched filter state', () => {
  assert.deepEqual(
    applyCodexAccountOrderFilter(
      {
        ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
        source: 'codex-auth-file',
        requiresRequestable: true,
      },
      {
        source: 'openai-compatible',
        requiresParticipating: true,
        requiresSkipped: true,
        requiresBlocked: true,
        requiresDisabled: true,
        hasBalance: true,
        hasLongestQuota: true,
        requiresError: false,
      },
    ),
    {
      ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
      source: 'openai-compatible',
      requiresParticipating: true,
      requiresSkipped: true,
      requiresRequestable: true,
      requiresBlocked: true,
      requiresDisabled: true,
      hasBalance: true,
      hasLongestQuota: true,
      requiresError: false,
    },
  );
});

test('summarizeCodexAccountOrderFilter keeps status, resource, and source parts in a stable order', () => {
  assert.deepEqual(
    summarizeCodexAccountOrderFilter((key) => key, {
      ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
      source: 'codex-api-key',
      requiresParticipating: true,
      requiresSkipped: true,
      requiresRequestable: true,
      requiresBlocked: true,
      requiresDisabled: true,
      requiresError: true,
      hasBalance: true,
      hasLongestQuota: true,
    }).map((part) => [part.kind, part.label]),
    [
      ['route', 'codex.account_list_filter_participating_match'],
      ['route', 'codex.account_list_filter_skipped_match'],
      ['status', 'codex.account_list_filter_requestable_match'],
      ['status', 'codex.account_list_filter_blocked_match'],
      ['status', 'codex.account_list_filter_disabled_match'],
      ['status', 'codex.account_list_filter_error_match'],
      ['resource', 'codex.account_list_filter_balance_match'],
      ['resource', 'codex.account_list_filter_longest_quota_match'],
      ['source', 'codex.account_list_source_api_key'],
    ],
  );
});

test('filterCodexAccountOrderRows syncs source, balance, disabled, error, and longest quota filters', () => {
  const rows = [
    {
      id: 'auth-file:pro.json',
      label: 'Pro',
      sourceKind: 'codex-auth-file',
      provider: 'codex',
      requestable: true,
      status: 'active',
      quotaKey: 'pro',
    },
    {
      id: 'codex-api-key:balance',
      label: 'Balance',
      sourceKind: 'codex-api-key',
      provider: 'codex',
      requestable: true,
      status: 'configured',
      quotaKey: 'balance',
      quotaEnabled: true,
      billingEnabled: true,
    },
    {
      id: 'openai-compatible:mi',
      label: 'MI',
      sourceKind: 'openai-compatible',
      provider: 'mi',
      requestable: true,
      status: 'configured',
    },
    {
      id: 'auth-file:error.json',
      label: 'Error',
      sourceKind: 'codex-auth-file',
      provider: 'codex',
      requestable: false,
      status: 'error',
    },
    {
      id: 'codex-api-key:disabled',
      label: 'Disabled',
      sourceKind: 'codex-api-key',
      provider: 'codex',
      requestable: false,
      disabled: true,
      status: 'disabled',
      quotaKey: 'disabled',
    },
  ];
  const quotaByName = {
    pro: {
      status: 'success',
      quota: {
        planType: 'pro',
        windows: [
          { id: 'five-hour', label: '5H', remainingPercent: 0, resetLabel: 'later' },
          { id: 'weekly', label: '7D', remainingPercent: 42, resetLabel: 'later' },
        ],
      },
    },
    balance: {
      status: 'success',
      quota: {
        planType: '',
        windows: [{ id: 'custom', label: 'Custom', remainingPercent: 88, resetLabel: 'later' }],
        billing: {
          isAvailable: true,
          balanceInfos: [{ currency: 'USD', totalBalance: '10', grantedBalance: '4', toppedUpBalance: '6' }],
        },
      },
    },
  };

  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, source: 'codex-api-key' }, quotaByName).map((row) => row.id),
    ['codex-api-key:balance', 'codex-api-key:disabled'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, source: 'openai-compatible' }, quotaByName).map((row) => row.id),
    ['openai-compatible:mi'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresDisabled: true }, quotaByName).map((row) => row.id),
    ['codex-api-key:disabled'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresBlocked: true }, quotaByName).map((row) => row.id),
    ['auth-file:error.json', 'codex-api-key:disabled'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresError: true }, quotaByName).map((row) => row.id),
    ['auth-file:error.json'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, hasBalance: true }, quotaByName).map((row) => row.id),
    ['codex-api-key:balance'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, hasLongestQuota: true }, quotaByName).map((row) => row.id),
    ['auth-file:pro.json'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(
      rows,
      { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresParticipating: true },
      quotaByName,
      '',
      {
        'auth-file:pro.json': { participates: true },
        'codex-api-key:balance': { participates: true },
        'openai-compatible:mi': { participates: true },
        'auth-file:error.json': { participates: false },
        'codex-api-key:disabled': { participates: false },
      },
    ).map((row) => row.id),
    ['auth-file:pro.json', 'codex-api-key:balance', 'openai-compatible:mi'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(
      rows,
      { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, requiresSkipped: true },
      quotaByName,
      '',
      {
        'auth-file:pro.json': { participates: true },
        'codex-api-key:balance': { participates: true },
        'openai-compatible:mi': { participates: true },
        'auth-file:error.json': { participates: false },
        'codex-api-key:disabled': { participates: false },
      },
    ).map((row) => row.id),
    ['auth-file:error.json', 'codex-api-key:disabled'],
  );
});

test('filterCodexAccountOrderRows applies text search across account identity and model mapping fields', () => {
  const rows = [
    {
      id: 'auth-file:pro.json',
      label: 'Pro Account',
      sourceKind: 'codex-auth-file',
      provider: 'codex',
      requestable: true,
      status: 'active',
      email: 'pro@example.com',
      baseUrl: 'https://chatgpt.com/backend-api',
      modelMappings: [{ realModel: 'gpt-5.4', codexModel: 'gpt-5.4-codex' }],
    },
    {
      id: 'codex-api-key:relay',
      label: 'Relay Key',
      sourceKind: 'codex-api-key',
      provider: 'codex',
      requestable: true,
      status: 'configured',
      keySuffix: 'abcd',
      baseUrl: 'https://relay.example.test/v1',
      modelMappings: [{ realModel: 'deepseek-chat', codexModel: 'codex-deepseek' }],
    },
    {
      id: 'openai-compatible:mi',
      label: 'MI Provider',
      sourceKind: 'openai-compatible',
      provider: 'mi',
      requestable: true,
      status: 'configured',
      modelMappings: [{ realModel: 'kimi-k2', codexModel: 'codex-kimi' }],
    },
  ];

  assert.deepEqual(
    filterCodexAccountOrderRows(rows, DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, {}, 'relay.example').map((row) => row.id),
    ['codex-api-key:relay'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, {}, 'GPT-5.4-CODEX').map((row) => row.id),
    ['auth-file:pro.json'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, source: 'openai-compatible' }, {}, 'codex').map((row) => row.id),
    ['openai-compatible:mi'],
  );
  assert.deepEqual(
    filterCodexAccountOrderRows(rows, { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER, source: 'codex-api-key' }, {}, 'pro account').map((row) => row.id),
    [],
  );
});

test('getCodexAccountOrderGridClass keeps list single-column and card modes adaptive', () => {
  assert.equal(getCodexAccountOrderGridClass('list'), 'grid gap-3 pt-4');
  assert.match(getCodexAccountOrderGridClass('compact'), /codex-account-order-card-grid-compact/);
  assert.match(getCodexAccountOrderGridClass('full'), /codex-account-order-card-grid-full/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('compact'), /\bp-4\b/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('full'), /\bp-4\b/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('compact'), /xl:grid-cols-3/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('full'), /xl:grid-cols-3/);
});

test('Codex account list switches routing mode through immediate config persistence', async () => {
  const source = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /async function persistChannelRoutingConfig/);
  assert.match(source, /updateChannelMode\(mode: ChannelRouteMode\)/);
  assert.match(source, /void persistChannelRoutingConfig\(nextConfig/);
  assert.doesNotMatch(source, /onSave=\{\(\) => void saveOrder\(\)\}/);
});

test('Codex browser mock mode keeps the account-list chrome aligned with desktop mode', async () => {
  const source = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /preview=\{browserMode\}/);
  assert.doesNotMatch(source, /account_list_browser_hint/);
  assert.doesNotMatch(source, /account_list_preview_loaded/);
  assert.doesNotMatch(source, /account_list_preview_saved/);
  assert.doesNotMatch(source, /account_list_preview_status_updated/);
  assert.match(source, /setMessage\(messageOverride \|\| t\('codex\.account_list_loaded'\)\)/);
  assert.match(source, /setMessage\(t\('codex\.account_list_saved'\)\)/);
  assert.match(source, /hint=\{ready \? t\('codex\.account_list_order_hint'\) : t\('codex\.account_list_waiting_ready'\)\}/);
});

test('Codex account order cards reuse the account pool card and drag the whole card', async () => {
  const source = await readFile(new URL('./components/CodexAccountOrderRow.tsx', import.meta.url), 'utf8');
  const accountCardSource = await readFile(new URL('../accounts/components/AccountCard.tsx', import.meta.url), 'utf8');
  const accountCardFrameSource = await readFile(new URL('../accounts/components/AccountCardFrame.tsx', import.meta.url), 'utf8');

  assert.match(source, /<AccountCard/);
  assert.match(source, /account=\{quotaSummaryAccount\}/);
  assert.match(source, /quotaState=\{quotaState\}/);
  assert.match(source, /onToggleDisabled=\{onToggle\}/);
  assert.match(source, /extraBadges=\{badges\}/);
  assert.match(source, /eyebrowPrefix=\{`#\$\{index \+ 1\}`\}/);
  assert.match(source, /showDeleteAction=\{false\}/);
  assert.match(source, /showFooterActions=\{false\}/);
  assert.doesNotMatch(source, /fillHeight=\{false\}/);
  assert.match(source, /draggable/);
  assert.match(source, /onDragStart=\{\(\) => onDragStart\(row\.id\)\}/);
  assert.doesNotMatch(source, /<AttributionCard/);
  assert.doesNotMatch(source, /customBody=\{/);
  assert.doesNotMatch(source, /footerPlacement="flow"/);
  assert.doesNotMatch(source, /leadingAction=\{/);
  assert.doesNotMatch(source, /topActions=\{/);
  assert.doesNotMatch(source, /OrderCardActionMenu/);
  assert.doesNotMatch(source, /function OrderCardTopActions/);
  assert.doesNotMatch(source, /CodexAccountSpecialActionBar/);
  assert.doesNotMatch(source, /function RegionHead/);
  assert.match(accountCardSource, /showDeleteAction = true/);
  assert.match(accountCardSource, /showFooterActions = true/);
  assert.match(accountCardSource, /eyebrowPrefix = ''/);
  assert.match(accountCardFrameSource, /flex h-full w-full/);
  assert.match(accountCardSource, /extraBadges = \[\]/);
  assert.match(accountCardSource, /onToggleDisabled\(account\)/);
});

test('Codex account order section uses a lighter shell instead of a nested card shell', async () => {
  const source = await readFile(new URL('./components/CodexAccountOrderSection.tsx', import.meta.url), 'utf8');

  assert.match(
    source,
    /CODEX_ACCOUNT_ORDER_SECTION_SHELL_CLASS =\n  'min-w-0';/,
  );
  assert.match(
    source,
    /CODEX_ACCOUNT_ORDER_SECTION_HEADER_CLASS =\n  'relative flex flex-wrap items-start justify-between gap-3 border-b-2 border-\[var\(--border-color\)\] pb-4';/,
  );
  assert.match(source, /chooseCodexOrderSectionActionLayout/);
  assert.match(source, /actionLayout === 'wrapped'/);
  assert.match(source, /actionLayout === 'inline'/);
  assert.match(source, /actionLayout === 'wrapped' \? 'w-full justify-start'/);
  assert.doesNotMatch(source, /w-full justify-start sm:justify-end/);
  assert.match(source, /className=\{`min-w-0 \$\{actionLayout === 'wrapped' \? 'w-full' : 'flex-1'\}`\}/);
  assert.doesNotMatch(source, /border-t-2 border-\[var\(--border-color\)\] px-5 py-4/);
  assert.doesNotMatch(source, /CODEX_ACCOUNT_ORDER_SECTION_MESSAGE_CLASS/);
  assert.doesNotMatch(
    source,
    /<section className="border-\[3px\] border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] shadow-\[8px_8px_0_var\(--shadow-color\)\]">/,
  );
});

test('Codex account order row no longer exposes separate top and bottom card actions', async () => {
  const source = await readFile(new URL('./components/CodexAccountOrderRow.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /onMoveToTop/);
  assert.doesNotMatch(source, /onMoveToBottom/);
  assert.doesNotMatch(source, /codex\.account_list_move_top/);
  assert.doesNotMatch(source, /codex\.account_list_move_bottom/);
});

test('Codex account order toolbar uses the unified filter menu instead of separate scope clusters', async () => {
  const source = await readFile(new URL('./components/CodexAccountOrderSection.tsx', import.meta.url), 'utf8');
  const refreshButtonSource = await readFile(new URL('../../components/ui/RefreshActionButton.tsx', import.meta.url), 'utf8');

  assert.match(source, /flex w-full flex-wrap items-center gap-2/);
  assert.match(source, /min-w-\[18rem\] flex-\[1_1_18rem\]/);
  assert.doesNotMatch(source, /max-w-\[24rem\]/);
  assert.match(source, /RefreshActionButton/);
  assert.match(source, /iconOnly=\{!stacked\}/);
  assert.doesNotMatch(source, /loading \? loadingLabel : refreshLabel/);
  assert.match(refreshButtonSource, /RefreshCw/);
  assert.match(refreshButtonSource, /loading \? 'animate-spin' : ''/);
  assert.match(refreshButtonSource, /iconOnly \? null/);
  assert.match(source, /fitContent=\{!stacked\}/);
  assert.doesNotMatch(source, /grid-cols-\[minmax\(12rem,17rem\)_5\.75rem_minmax\(12rem,auto\)_12\.5rem\]/);
  assert.match(source, /account_list_filter_balance_match/);
  assert.match(source, /account_list_filter_group_route/);
  assert.match(source, /account_list_filter_participating_match/);
  assert.match(source, /account_list_filter_skipped_match/);
  assert.match(source, /requiresParticipating/);
  assert.match(source, /requiresSkipped/);
  assert.match(source, /requiresBlocked/);
  assert.match(source, /applyCodexAccountOrderFilter/);
  assert.match(source, /summarizeCodexAccountOrderFilter/);
  assert.doesNotMatch(source, /blockedOnly/);
  assert.doesNotMatch(source, /requestableOnly/);
  assert.doesNotMatch(source, /disabledOnly/);
  assert.doesNotMatch(source, /errorsOnly/);
  assert.match(source, /account_list_source_openai_compatible/);
  assert.match(source, /FilterCheckOption/);
  assert.doesNotMatch(source, /function SourceFilterButton/);
  assert.doesNotMatch(source, /function ActionControlCluster/);
});

test('routing probe model helpers prefer configured codex aliases, hide aliased real names, and keep fallback', () => {
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

  assert.deepEqual(
    buildCodexRoutingProbeModelOptions(rows, [
      { realModel: 'deepseek-v4-flash', codexModel: 'deepseek-v4-flash' },
      { realModel: 'deepseek-v4-pro', codexModel: 'deepseek-v4-pro' },
    ]),
    ['codex-deepseek', 'gpt-5.4-mini', 'deepseek-v4-flash', 'deepseek-v4-pro', 'gpt-5.4'],
  );
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

test('buildCodexModelAliasOptionNames returns only alias when configured and real names otherwise', () => {
  assert.deepEqual(
    buildCodexModelAliasOptionNames([
      { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      { realModel: 'deepseek-reasoner', codexModel: 'deepseek-reasoner' },
      { realModel: 'deepseek-chat', codexModel: 'codex-deepseek' },
      { realModel: 'custom-real', codexModel: '' },
    ]),
    ['codex-deepseek', 'deepseek-reasoner', 'custom-real'],
  );
});

test('getCodexAccountListPreviewRows provides browser-safe rows with model mappings', () => {
  const rows = getCodexAccountListPreviewRows();
  const codexPro = rows.find((row) => row.id === 'auth-file:codex-pro.json');
  const deepseek = rows.find((row) => row.id === 'acct_deepseek');

  assert.ok(rows.length >= 4);
  assert.deepEqual(codexPro?.modelMappings, []);
  assert.deepEqual(deepseek?.modelMappings.slice(0, 2), [
    { realModel: 'deepseek-v4-flash', codexModel: 'deepseek-v4-flash' },
    { realModel: 'deepseek-v4-pro', codexModel: 'deepseek-v4-pro' },
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
