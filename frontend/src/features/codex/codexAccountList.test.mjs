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
  buildCodexRoutePolicyExplainPreview,
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
  buildCodexAccountOrderFilterPresetState,
  chooseCodexOrderSectionActionLayout,
  filterCodexAccountOrderRows,
  getCodexAccountOrderGridClass,
  normalizeCodexAccountOrderFilter,
  parseCodexAccountOrderDisplayMode,
  removeCodexAccountOrderFilterSummaryPart,
  summarizeCodexAccountOrderFilter,
  shouldUseCodexOrderSectionActionMenu,
} from './model/codexAccountOrderSectionLayout.ts';
import { getCodexAccountListPreviewRows } from './previewData.ts';
import { buildQuotaDisplay, supportsQuota } from '../accounts/model/accountQuota.ts';

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source block start: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing source block end: ${endMarker}`);
  return source.slice(start, end);
}

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
        requestability: {
          evidence: ['verified'],
        },
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
        requestability: {
          evidence: ['verified'],
        },
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

test('buildCodexAccountRows accepts openai-compatible records from unified Codex inventory', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'acct_openrouter',
        accountKind: 'openai-compatible',
        provider: 'openrouter',
        credentialSource: 'api-key',
        displayName: 'OpenRouter',
        status: 'active',
        priority: 8,
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeys: ['sk-or'],
        models: [{ name: 'deepseek-chat', alias: 'deepseek' }],
      },
    ],
    providers: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'acct_openrouter');
  assert.equal(rows[0].sourceKind, 'openai-compatible');
  assert.equal(rows[0].provider, 'openrouter');
  assert.equal(rows[0].requestable, true);
  assert.deepEqual(rows[0].modelMappings, [{ realModel: 'deepseek-chat', codexModel: 'deepseek' }]);
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
    ['auth-file-actions', 'models', 'model-probe', 'rate-limit', 'quota', 'billing', 'model-routing'],
  );
});

test('codex oauth detail exposes single-account model probe with fallback disabled', async () => {
  const modalSource = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /<OAuthModelProbeSection/);
  assert.match(modalSource, /onOAuthModelProbe/);
  assert.match(featureSource, /async function runDetailOAuthModelProbe\(row: CodexAccountRow, model: string\)/);
  assert.match(featureSource, /ProbeCodexAccountRouting/);
  assert.match(featureSource, /allowAccountIDs:\s*\[row\.id\]/);
  assert.match(featureSource, /orderAccountIDs:\s*\[row\.id\]/);
  assert.match(featureSource, /allowFallback:\s*false/);
});

test('codex account detail header keeps labeled identity and metadata blocks', async () => {
  const source = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const summaryBlock = source.match(/<dl[\s\S]*?data-codex-account-detail-header="summary"[\s\S]*?<\/dl>/)?.[0] ?? '';
  const metaBlock = source.match(/function AccountDetailHeaderMeta[\s\S]*?\n}\n\nexport function CodexAccountDetailHeader/)?.[0] ?? '';

  assert.match(source, /export function CodexAccountDetailHeader/);
  assert.match(source, /sourceKindLabel\(t, row\.sourceKind\)/);
  assert.match(source, /data-codex-account-detail-header="summary"/);
  assert.match(summaryBlock, /flex min-w-0 flex-wrap/);
  assert.doesNotMatch(summaryBlock, /grid/);
  assert.doesNotMatch(summaryBlock, /sm:grid-cols/);
  assert.match(source, /const codexAccountDetailMetaClass =[\s\S]*inline-flex max-w-full items-center/);
  assert.match(metaBlock, /codexAccountDetailMetaClass/);
  assert.match(metaBlock, /<dt/);
  assert.match(metaBlock, /<dd/);
  assert.doesNotMatch(metaBlock, /mt-1/);
  assert.match(source, /t\('common\.type'\)/);
  assert.match(source, /t\('common\.status'\)/);
  assert.match(source, /t\('codex\.account_list_route'\)/);
  assert.match(source, /t\('codex\.account_list_priority'\)/);
  assert.match(source, /t\('common\.enable'\)/);
});

test('CodexAccountDetailModal uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const codexAccountDetailHeaderClass =/);
  assert.match(source, /const codexAccountDetailMetaClass =/);
  assert.match(source, /import \{ Button \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /const codexModelRoutingPanelClass =/);
  assert.match(source, /const codexModelRoutingErrorClass =/);
  assert.match(source, /data-codex-account-detail-header="quiet"/);
  assert.match(source, /data-codex-account-detail-footer/);
  assert.match(source, /data-codex-account-detail-body/);
  assert.match(source, /data-codex-model-routing-section/);
  assert.match(source, /data-codex-model-routing-table/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2/);
  assert.doesNotMatch(source, /border-l-2/);
  assert.doesNotMatch(source, /border-b-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[0\.14em\]|tracking-\[0\.15em\]|tracking-\[0\.16em\]|tracking-\[0\.18em\]/);
  assert.doesNotMatch(source, /shadow-\[/);
});

test('codex account detail folds proxy route into credential section', async () => {
  const modalSource = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(modalSource, /import AccountProxyRouteSection/);
  assert.doesNotMatch(modalSource, /case 'proxy-route':/);
  assert.match(modalSource, /<AccountCredentialVerifySection[\s\S]*?span="wide"[\s\S]*?onProxyValidityChange=\{setProxyRouteError\}/);
});

test('codex oauth detail renders quota and billing as read-only resource modules', async () => {
  const modalSource = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const detailSectionsSource = await readFile(new URL('../accounts/components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /const readOnlyQuotaScripts = row\.sourceKind === 'codex-auth-file'/);
  assert.match(modalSource, /<AccountQuotaSection[\s\S]*?readOnlyScripts=\{readOnlyQuotaScripts\}/);
  assert.match(modalSource, /<AccountBillingSection[\s\S]*?readOnlyScripts=\{readOnlyQuotaScripts\}/);
  assert.match(detailSectionsSource, /readOnlyScripts\?: boolean/);
  assert.match(detailSectionsSource, /const quotaActions = \([\s\S]*?isOpenAIAuthFileQuotaReset \? \([\s\S]*?\) : readOnlyScripts \? null :/);
  assert.match(detailSectionsSource, /const billingActions = \(\s*readOnlyScripts \? null :/);
});

test('codex model routing detail exposes fetch-model action from the account list', async () => {
  const modalSource = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');
  const routingBlock = modalSource.match(/function CodexModelRoutingSection[\s\S]*?\nfunction buildEditableModelMappings/)?.[0] ?? '';

  assert.match(modalSource, /onFetchModelOptions\?: \(\) => void/);
  assert.match(routingBlock, /t\('accounts\.openai_provider_models_fetch'\)/);
  assert.match(routingBlock, /onClick=\{onFetchModelOptions\}/);
  assert.match(featureSource, /async function fetchDetailModelOptions\(row: CodexAccountRow\)/);
  assert.match(featureSource, /onFetchModelOptions=\{\(\) => void fetchDetailModelOptions\(detailRowWithModels\)\}/);
});

test('codex oauth detail shows fetched passthrough model rows without saving them as aliases', async () => {
  const modalSource = await readFile(new URL('../accounts/components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const modelsBlock = modalSource.match(/function CodexAuthFileModelsSection[\s\S]*?\nfunction CodexModelRoutingSection/)?.[0] ?? '';
  const routingSetupBlock = modalSource.match(/const oauthPassthroughMappings[\s\S]*?const modelOptionNames/)?.[0] ?? '';
  const routingBlock = modalSource.match(/function CodexModelRoutingSection[\s\S]*?\nfunction buildEditableModelMappings/)?.[0] ?? '';

  assert.match(modelsBlock, /modelOptions: CodexModelMappingRow\[\]/);
  assert.match(modelsBlock, /uniqueCodexModelNames\(\[[\s\S]*\.\.\.modelOptions,[\s\S]*\.\.\.row\.modelMappings/);
  assert.match(routingSetupBlock, /props\.codexRow\.sourceKind === 'codex-auth-file' && mappingDraft\.length === 0/);
  assert.match(routingSetupBlock, /displayOnlyModelMappings = oauthPassthroughMappings\.length > 0/);
  assert.match(routingBlock, /editableModelMappings && !displayOnlyModelMappings/);
});

test('codex account list modals are hash-routed', async () => {
  const source = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /buildCodexModalFrameHash/);
  assert.match(source, /clearCodexModalFrameHash/);
  assert.match(source, /hashState\?\.page === 'codex' && hashState\.codexWorkspace === 'account-list'/);
  assert.match(source, /accountListModal === 'route-probe'/);
  assert.match(source, /accountListModal === 'project-config'/);
});

test('codex account list loads real accounts from unified Codex inventory API', async () => {
  const source = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');
  const importBlock = source.match(/from '\.\.\/\.\.\/\.\.\/wailsjs\/go\/main\/App';/)?.input ?? source;

  assert.match(source, /ListCodexAccountInventory/);
  assert.match(source, /trackRequest\('ListCodexAccountInventory'/);
  assert.doesNotMatch(importBlock, /\bListAccounts\b/);
  assert.doesNotMatch(importBlock, /\bListOpenAICompatibleProviders\b/);
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

test('buildCodexAccountRows separates waiting check from verified requestability evidence', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'codex-api-key:waiting',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Waiting Key',
        status: 'configured',
      },
      {
        id: 'codex-api-key:verified',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Verified Key',
        status: 'configured',
        requestability: {
          evidence: ['verified'],
        },
      },
      {
        id: 'codex-api-key:manual',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Manual Key',
        status: 'configured',
        requestability: {
          manual: true,
        },
      },
      {
        id: 'codex-api-key:manual-disabled',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Manual Disabled',
        status: 'configured',
        disabled: true,
        requestability: {
          manual: true,
        },
      },
    ],
    providers: [],
  });

  assert.deepEqual(
    Object.fromEntries(rows.map((row) => [row.id, [row.requestable, row.blockReason, row.manualRequestable]])),
    {
      'codex-api-key:waiting': [false, 'waiting-check', false],
      'codex-api-key:verified': [true, '', false],
      'codex-api-key:manual': [true, '', true],
      'codex-api-key:manual-disabled': [false, 'disabled', true],
    },
  );
});

test('buildCodexAccountRows honors runtime routeability before legacy configured status', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'acct_split',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Company 1',
        status: 'configured',
        runtimeStatus: 'applied_not_registered',
        runtimeReason: 'runtime auth missing from registry',
        routeable: false,
        requestability: {
          manual: true,
        },
      },
      {
        id: 'acct_routeable',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Available',
        status: 'configured',
        runtimeStatus: 'registered_routeable',
        routeable: true,
      },
    ],
    providers: [],
  });

  assert.deepEqual(
    Object.fromEntries(rows.map((row) => [row.id, [row.requestable, row.blockReason, row.manualRequestable]])),
    {
      'acct_split': [false, 'runtime auth missing from registry', true],
      'acct_routeable': [true, '', false],
    },
  );
});

test('buildCodexAccountRows accepts manual requestable IDs from channel routing config', () => {
  const rows = buildCodexAccountRows({
    accounts: [
      {
        id: 'codex-api-key:manual-config',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Manual Config',
        status: 'configured',
      },
    ],
    providers: [],
    manualRequestableAccountIDs: [' codex-api-key:manual-config ', 'codex-api-key:manual-config'],
  });

  assert.equal(rows[0].requestable, true);
  assert.equal(rows[0].manualRequestable, true);
  assert.deepEqual(rows[0].requestabilityEvidence, ['manual']);
});

test('patchCodexAccountRowDisabled keeps Codex requestability in sync with account disabled events', () => {
  const row = {
    id: 'codex-api-key:stable',
    label: 'Stable',
    sourceKind: 'codex-api-key',
    provider: 'codex',
    requestable: true,
    blockReason: '',
    requestabilityEvidence: ['manual'],
    manualRequestable: true,
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
      requestabilityEvidence: ['manual'],
      manualRequestable: true,
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
      requestabilityEvidence: ['manual'],
      manualRequestable: true,
      status: 'configured',
    },
  );
});

test('patchCodexAccountRowDisabled returns configured accounts without evidence to waiting check', () => {
  const row = {
    id: 'codex-api-key:waiting',
    label: 'Waiting',
    sourceKind: 'codex-api-key',
    provider: 'codex',
    requestable: false,
    blockReason: 'disabled',
    requestabilityEvidence: [],
    manualRequestable: false,
    disabled: true,
    status: 'disabled',
    baseUrl: 'https://api.openai.com/v1',
    prefix: '',
    keySuffix: '1111',
    modelMappings: [],
  };

  assert.deepEqual(
    patchCodexAccountRowDisabled(row, false),
    {
      ...row,
      disabled: false,
      requestable: false,
      blockReason: 'waiting-check',
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
        requestability: {
          evidence: ['verified'],
        },
        quotaKey: 'codex-api-key:stable',
        quotaCurl: 'curl https://quota.example.test',
        quotaEnabled: true,
        billingCurl: 'curl https://billing.example.test',
        billingEnabled: true,
        statusMessage: 'runtime synced',
        platformCookie: 'cookie-value',
        curlVariables: { account_id: 'stable' },
        modelFetchApiKey: 'model-fetch-key',
        modelFetchBaseUrl: 'https://models.example.test/v1',
      },
    ],
    providers: [],
  });

  const account = buildCodexQuotaSummaryAccount(rows[0]);

  assert.equal(account.quotaCurl, 'curl https://quota.example.test');
  assert.equal(account.quotaEnabled, true);
  assert.equal(account.billingCurl, 'curl https://billing.example.test');
  assert.equal(account.billingEnabled, true);
  assert.equal(account.accountKind, 'codex-api-key');
  assert.equal(account.statusMessage, 'runtime synced');
  assert.equal(account.platformCookie, 'cookie-value');
  assert.deepEqual(account.curlVariables, { account_id: 'stable' });
  assert.equal(account.modelFetchApiKey, 'model-fetch-key');
  assert.equal(account.modelFetchBaseUrl, 'https://models.example.test/v1');
  assert.equal(rows[0].sourceAccount?.id, 'codex-api-key:stable');
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
  assert.equal(DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE, 'full');
  assert.equal(parseCodexAccountOrderDisplayMode('compact'), 'full');
  assert.equal(parseCodexAccountOrderDisplayMode('list'), 'list');
  assert.equal(parseCodexAccountOrderDisplayMode('full'), 'full');
  assert.equal(parseCodexAccountOrderDisplayMode('unknown'), 'full');
  assert.equal(parseCodexAccountOrderDisplayMode(null), 'full');
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

test('Codex account order filter presets mirror account pool quick filters', () => {
  assert.deepEqual(
    buildCodexAccountOrderFilterPresetState('all', {
      ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
      source: 'openai-compatible',
      requiresRequestable: true,
      hasBalance: true,
    }),
    DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
  );
  assert.deepEqual(buildCodexAccountOrderFilterPresetState('participating'), {
    ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
    requiresParticipating: true,
  });
  assert.deepEqual(
    buildCodexAccountOrderFilterPresetState('requestable', {
      ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
      requiresBlocked: true,
      requiresDisabled: true,
      requiresError: true,
    }),
    {
      ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
      requiresRequestable: true,
    },
  );
  assert.deepEqual(buildCodexAccountOrderFilterPresetState('blocked'), {
    ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
    requiresBlocked: true,
  });
  assert.deepEqual(buildCodexAccountOrderFilterPresetState('openai-compatible'), {
    ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
    source: 'openai-compatible',
  });
  assert.deepEqual(buildCodexAccountOrderFilterPresetState('with-balance'), {
    ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
    hasBalance: true,
  });
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

test('removeCodexAccountOrderFilterSummaryPart removes one active chip at a time', () => {
  const filter = {
    ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
    source: 'openai-compatible',
    requiresParticipating: true,
    requiresRequestable: true,
    hasBalance: true,
  };
  const parts = summarizeCodexAccountOrderFilter((key) => key, filter);

  assert.deepEqual(removeCodexAccountOrderFilterSummaryPart(filter, parts[0]), {
    ...filter,
    requiresParticipating: false,
  });
  assert.deepEqual(removeCodexAccountOrderFilterSummaryPart(filter, parts[1]), {
    ...filter,
    requiresRequestable: false,
  });
  assert.deepEqual(removeCodexAccountOrderFilterSummaryPart(filter, parts[2]), {
    ...filter,
    hasBalance: false,
  });
  assert.deepEqual(removeCodexAccountOrderFilterSummaryPart(filter, parts[3]), {
    ...filter,
    source: 'all',
  });
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
  assert.equal(getCodexAccountOrderGridClass('list'), 'grid grid-cols-1 gap-3 pt-4');
  assert.equal(getCodexAccountOrderGridClass('full'), 'account-card-grid-full grid gap-8 pt-4');
  assert.doesNotMatch(getCodexAccountOrderGridClass('full'), /\bp-4\b/);
  assert.doesNotMatch(getCodexAccountOrderGridClass('full'), /codex-account-order-card-grid/);
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
  assert.match(source, /showFooterActions/);
  assert.match(source, /showFooterReauthAction=\{false\}/);
  assert.match(source, /localCliActions=\{manualActions\}/);
  assert.match(source, /onRefreshQuota=\{\(\) => onRefreshQuota\(row\)\}/);
  assert.match(source, /usageRefreshing=\{usageRefreshing\}/);
  assert.match(source, /rateLimitRefreshing=\{rateLimitRefreshing\}/);
  assert.match(source, /type AccountCardLocalCliAction/);
  assert.doesNotMatch(source, /fillHeight=\{false\}/);
  assert.match(source, /draggable/);
  assert.match(source, /onDragStart=\{\(\) => onDragStart\(row\.id\)\}/);
  assert.doesNotMatch(source, /if \(density === 'list'\)/);
  assert.doesNotMatch(source, /row-span-6/);
  assert.doesNotMatch(source, /grid-rows-\[subgrid\]/);
  assert.doesNotMatch(source, /GripVertical/);
  assert.doesNotMatch(source, /ShieldCheck/);
  assert.doesNotMatch(source, /absolute bottom-2 right-2/);
  assert.doesNotMatch(source, /grid min-h-\[4\.25rem\] w-full grid-cols-\[5\.25rem_minmax\(0,1fr\)_9rem\]/);
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
  assert.match(accountCardSource, /showFooterReauthAction = true/);
  assert.match(accountCardSource, /showFooterReauthAction && canReauth/);
  assert.match(accountCardSource, /eyebrowPrefix = ''/);
  assert.match(accountCardFrameSource, /<Card/);
  assert.match(accountCardFrameSource, /classNames=\{\{ body: 'flex h-full flex-col !p-0' \}\}/);
  assert.doesNotMatch(accountCardFrameSource, /styles=\{\{\s*body:/);
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
    /CODEX_ACCOUNT_ORDER_SECTION_TOOLBAR_CLASS =\n  'pt-4';/,
  );
  assert.doesNotMatch(source, /chooseCodexOrderSectionActionLayout/);
  assert.doesNotMatch(source, /actionLayout/);
  assert.doesNotMatch(source, /CODEX_ACCOUNT_ORDER_SECTION_HEADER_CLASS/);
  assert.doesNotMatch(source, /<h2 className=/);
  assert.doesNotMatch(source, /<p className="mt-2 max-w-3xl/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-ink-muted/);
  assert.doesNotMatch(source, /border-t-2/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /\buppercase\b/);
  assert.doesNotMatch(source, /tracking-wide|tracking-wider|tracking-widest|tracking-\[/);
  assert.doesNotMatch(source, /border-t-2 border-\[var\(--gt-border-strong\)\] px-5 py-4/);
  assert.doesNotMatch(source, /CODEX_ACCOUNT_ORDER_SECTION_MESSAGE_CLASS/);
  assert.doesNotMatch(
    source,
    /<section className="border-\[3px\] border-\[var\(--gt-border-strong\)\] bg-\[var\(--gt-surface-canvas\)\] shadow-\[8px_8px_0_var\(--gt-shadow-panel\)\]">/,
  );
});

test('Codex account order card footer refresh uses the account pool refresh strategy', async () => {
  const featureSource = await readFile(new URL('./CodexAccountListFeature.tsx', import.meta.url), 'utf8');
  const sectionSource = await readFile(new URL('./components/CodexAccountOrderSection.tsx', import.meta.url), 'utf8');
  const rowSource = await readFile(new URL('./components/CodexAccountOrderRow.tsx', import.meta.url), 'utf8');

  assert.match(featureSource, /refreshCodexQuota/);
  assert.match(featureSource, /refreshAccountUsage/);
  assert.match(featureSource, /refreshAccountRateLimits/);
  assert.match(featureSource, /function refreshOrderAccount\(row: CodexAccountRow\)/);
  assert.match(featureSource, /const account = codexRowToAccountRecord\(row\)/);
  assert.match(featureSource, /void refreshCodexQuota\(account\)/);
  assert.match(featureSource, /void refreshAccountUsage\(\[account\]\)/);
  assert.match(featureSource, /void refreshAccountRateLimits\(\[account\]\)/);
  assert.match(featureSource, /usageRefreshingAccountIDSet=\{usageRefreshingAccountIDSet\}/);
  assert.match(featureSource, /rateLimitRefreshingAccountIDSet=\{rateLimitRefreshingAccountIDSet\}/);
  assert.match(featureSource, /onRefreshQuota=\{refreshOrderAccount\}/);
  assert.match(sectionSource, /onRefreshQuota\?: \(row: CodexAccountRow\) => void/);
  assert.match(sectionSource, /usageRefreshingAccountIDSet\?: ReadonlySet<string>/);
  assert.match(sectionSource, /rateLimitRefreshingAccountIDSet\?: ReadonlySet<string>/);
  assert.match(rowSource, /onRefreshQuota: \(row: CodexAccountRow\) => void/);
  assert.match(rowSource, /onRefreshQuota=\{\(\) => onRefreshQuota\(row\)\}/);
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
  const toolbarSource = sourceBlock(source, 'function InlineActionControls', 'function buildToolbarFilterLabel');

  assert.match(source, /CODEX_ACCOUNT_ORDER_SECTION_TOOLBAR_CLASS/);
  assert.match(source, /'pt-4'/);
  assert.match(source, /import \{ Button, Checkbox, Segmented \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /const CODEX_ACCOUNT_ORDER_FILTER_MENU_CLASS =/);
  assert.match(source, /const CODEX_ACCOUNT_ORDER_FILTER_TITLE_CLASS =/);
  assert.match(source, /const CODEX_ACCOUNT_ORDER_FILTER_OPTION_CLASS =/);
  assert.match(source, /data-codex-account-order-density-switch="true"/);
  assert.match(source, /<Segmented/);
  assert.match(source, /onChange=\{\(value\) => onDensityChange\(value as CodexAccountOrderDisplayMode\)\}/);
  assert.doesNotMatch(source, /const CODEX_ACCOUNT_ORDER_DISPLAY_SWITCH_CLASS =/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /shadow-sm/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.match(source, /flex w-full flex-wrap items-center gap-2/);
  assert.match(source, /className="min-w-\[18rem\] flex-1"/);
  assert.match(source, /ml-auto flex shrink-0 items-center gap-2/);
  assert.doesNotMatch(source, /max-w-\[24rem\]/);
  assert.doesNotMatch(source, /grid grid-cols-1 gap-4 pt-4/);
  assert.match(source, /RefreshActionButton/);
  assert.match(source, /\biconOnly\b/);
  assert.doesNotMatch(source, /loading \? loadingLabel : refreshLabel/);
  assert.match(refreshButtonSource, /RefreshCw/);
  assert.match(refreshButtonSource, /loading=\{loading\}/);
  assert.match(refreshButtonSource, /!loading && <RefreshCw/);
  assert.match(refreshButtonSource, /iconOnly \? null/);
  assert.doesNotMatch(source, /SegmentedControl/);
  assert.doesNotMatch(source, /fitContent/);
  assert.doesNotMatch(source, /function DisplayModeButton/);
  assert.doesNotMatch(source, /grid h-10 shrink-0 grid-cols-2/);
  assert.doesNotMatch(source, /account_list_density_compact/);
  assert.doesNotMatch(source, /grid-cols-\[minmax\(12rem,17rem\)_5\.75rem_minmax\(12rem,auto\)_12\.5rem\]/);
  assert.match(source, /accounts\.filter_group_presets/);
  assert.match(source, /accounts\.filter_active_conditions/);
  assert.match(source, /removeCodexAccountOrderFilterSummaryPart/);
  assert.match(source, /onRefreshQuota=\{onRefreshQuota\}/);
  assert.match(source, /usageRefreshingAccountIDSet\?\.has\(row\.id\)/);
  assert.match(source, /rateLimitRefreshingAccountIDSet\?\.has\(row\.id\)/);
  assert.match(source, /buildCodexAccountOrderFilterPresetState/);
  assert.match(source, /buildToolbarFilterLabel/);
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
  assert.match(source, /FilterPillOption/);
  assert.match(source, /accounts\.filter_group_plan_source/);
  assert.match(source, /accounts\.filter_group_other/);
  assert.match(source, /function FilterBinaryOptionRow/);
  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /CODEX_ACCOUNT_ORDER_FILTER_OPTION_CLASS/);
  assert.match(source, /function FilterPillOption/);
  assert.doesNotMatch(toolbarSource, /btn-swiss/);
  assert.doesNotMatch(toolbarSource, /border-2/);
  assert.doesNotMatch(toolbarSource, /border-t-2|border-r-2|border-l-2/);
  assert.doesNotMatch(toolbarSource, /border-y border-dashed/);
  assert.doesNotMatch(toolbarSource, /border-t border-dashed/);
  assert.doesNotMatch(toolbarSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(toolbarSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(toolbarSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(toolbarSource, /uppercase/);
  assert.doesNotMatch(toolbarSource, /tracking-\[0\.08em\]|tracking-\[0\.1em\]|tracking-\[0\.16em\]/);
  assert.doesNotMatch(toolbarSource, /shadow-\[/);
  assert.doesNotMatch(source, /function SourceFilterButton/);
  assert.doesNotMatch(source, /function ActionControlCluster/);
});

test('Codex route probe modal uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./components/CodexRouteProbeCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /const codexRouteProbePanelClass =/);
  assert.match(source, /import \{ Button \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /const codexRouteProbeBadgeClass =/);
  assert.match(source, /data-codex-route-probe-shell/);
  assert.match(source, /data-codex-route-probe-control-panel/);
  assert.match(source, /data-codex-route-probe-candidate-queue/);
  assert.match(source, /data-codex-route-probe-terminal/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.match(source, /text-\[length:var\(--gt-font-size-xl\)\]/);
  assert.doesNotMatch(source, /!?text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/);
  assert.match(source, /shadow-sm/);
  assert.doesNotMatch(source, /shadow-(?:lg|xl|2xl)|drop-shadow/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-r-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /xl:border-r-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[0\.16em\]/);
  assert.doesNotMatch(source, /shadow-hard/);
  assert.doesNotMatch(source, /shadow-\[/);
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

test('buildCodexRoutePolicyExplainPreview uses route policy preview as the candidate pool', () => {
  const rows = [
    { id: 'codex-api-key:company', label: '公司 1', provider: 'codex', requestable: true },
    { id: 'auth-file:checker.json', label: 'checker', provider: 'codex', requestable: true },
    { id: 'openai-compatible:deepseek', label: 'DeepSeek', provider: 'deepseek', requestable: true },
    {
      id: 'openai-compatible:disabled',
      label: 'Disabled',
      provider: 'openrouter',
      requestable: false,
      disabled: true,
      blockReason: 'account-disabled',
    },
  ];

  const preview = buildCodexRoutePolicyExplainPreview(
    rows,
    {
      allowAccountIDs: [],
      denyAccountIDs: ['auth-file:checker.json'],
      orderAccountIDs: ['openai-compatible:deepseek', 'codex-api-key:company'],
      allowFallback: true,
    },
    {
      id: 'rule-1',
      projectKey: 'project/a',
      projectName: 'Project A',
      allowAccountIDs: ['codex-api-key:company'],
    },
  );

  assert.deepEqual(
    preview.baseCandidates.map((candidate) => [candidate.id, candidate.routeOrder, candidate.channelOrder]),
    [
      ['openai-compatible:deepseek', 0, 2],
      ['codex-api-key:company', 1, 0],
    ],
  );
  assert.deepEqual(
    preview.candidates.map((candidate) => candidate.id),
    ['codex-api-key:company'],
  );
  assert.deepEqual(
    preview.filtered.map((item) => [item.id, item.reason]),
    [
      ['auth-file:checker.json', 'route-policy-excluded'],
      ['openai-compatible:disabled', 'account-disabled'],
      ['openai-compatible:deepseek', 'project-candidate-pool'],
    ],
  );
  assert.equal(preview.projectCandidatePool?.beforeCandidateCount, 2);
  assert.equal(preview.projectCandidatePool?.afterCandidateCount, 1);
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
  const codexPro = rows.find((row) => row.id === 'acct_preview_codex_pro_json');
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
