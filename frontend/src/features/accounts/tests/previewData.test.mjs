import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAccountsPreviewAPIKeyRecords,
  getAccountsPreviewAuthFileRecords,
  getAccountsPreviewOpenAICompatibleProviders,
  getAccountsPreviewQuotaStateByKey,
  getAccountsPreviewAuthFileContent,
  getAccountsPreviewAuthFileModels,
  getAccountsPreviewRelayModelNames,
  getUsageDeskPreviewObservedUsage,
  getUsageDeskPreviewProjectedUsage,
  getAccountsPreviewUsageByID,
  getAccountsPreviewRateLimitByID,
} from '../previewData.ts';

test('accounts preview quota state only returns requested preview keys', () => {
  const records = [...getAccountsPreviewAuthFileRecords(), ...getAccountsPreviewAPIKeyRecords()].filter((account) =>
    ['auth-file:codex-pro.json', 'codex-api-key:stable-001'].includes(account.id),
  );

  assert.deepEqual(Object.keys(getAccountsPreviewQuotaStateByKey(records)).sort(), [
    'codex-api-key:stable-001',
    'codex-pro.json',
  ]);
});

test('accounts preview usage resolves codex api key attribution to local id', () => {
  const usageByID = getAccountsPreviewUsageByID([
    { id: 'codex-api-key:stable-001' },
    { id: 'openai-compatible:deepseek' },
  ]);

  assert.equal(usageByID['codex-api-key:stable-001'].source, 'attribution');
  assert.equal(usageByID['codex-api-key:stable-001'].attributionKey, 'codex-api-key:stable-001');
  assert.equal(usageByID['openai-compatible:deepseek'].provider, 'deepseek');
  assert.equal(usageByID['openai-compatible:deepseek'].trafficBuckets.length, 8);
});

test('accounts preview rate limit exposes blocked guard state by account id', () => {
  const stateByID = getAccountsPreviewRateLimitByID([
    { id: 'codex-api-key:gray-canary' },
    { id: 'codex-api-key:missing' },
  ]);

  assert.equal(stateByID['codex-api-key:gray-canary'].blocked, true);
  assert.equal(stateByID['codex-api-key:gray-canary'].blockReason, '1h requests 已满');
  assert.equal(stateByID['codex-api-key:missing'].blocked, false);
  assert.deepEqual(stateByID['codex-api-key:missing'].rules, []);
});

test('accounts preview providers remain available for aggregate workspace preview', () => {
  const providers = getAccountsPreviewOpenAICompatibleProviders();

  assert.deepEqual(
    providers.map((provider) => provider.name),
    ['openai', 'deepseek', 'siliconflow', 'zhipu', 'moonshot', 'dashscope', 'openrouter', 'groq', 'together', 'doubao'],
  );
});

test('accounts preview detail data covers api-key verification and auth-file metadata', () => {
  const relayModels = getAccountsPreviewRelayModelNames();
  const authContent = getAccountsPreviewAuthFileContent('codex-pro.json');
  const authModels = getAccountsPreviewAuthFileModels('codex-pro.json');

  assert.ok(relayModels.includes('gpt-5.4-mini'));
  assert.ok(relayModels.includes('o4-mini'));
  assert.match(authContent, /ops-pro@example\.com/);
  assert.ok(authModels.some((model) => model.name === 'gpt-5.4'));
  assert.ok(authModels.some((model) => model.display_name === 'GPT 5.4 Mini'));
});

test('accounts preview DeepSeek provider uses automatic v4 model names without aliases', () => {
  const providers = getAccountsPreviewOpenAICompatibleProviders();
  const deepseek = providers.find((provider) => provider.name === 'deepseek');

  assert.ok(deepseek);
  assert.deepEqual(deepseek.models, [
    { alias: '', name: 'deepseek-v4-flash' },
    { alias: '', name: 'deepseek-v4-pro' },
  ]);
});

test('accounts preview inventory covers full account list states and providers', () => {
  const authRecords = getAccountsPreviewAuthFileRecords();
  const apiRecords = getAccountsPreviewAPIKeyRecords();
  const allRecords = [...authRecords, ...apiRecords];
  const ids = allRecords.map((account) => account.id);
  const providers = new Set(allRecords.map((account) => account.provider));
  const statuses = new Set(allRecords.map((account) => String(account.status).toUpperCase()));

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(authRecords.length >= 6);
  assert.ok(apiRecords.length >= 12);
  assert.ok(statuses.has('ACTIVE'));
  assert.ok(statuses.has('CONFIGURED'));
  assert.ok(statuses.has('DISABLED'));
  assert.ok(statuses.has('ERROR'));

  for (const provider of [
    'codex',
    'openai',
    'deepseek',
    'siliconflow',
    'zhipu',
    'moonshot',
    'dashscope',
    'openrouter',
    'groq',
    'together',
    'doubao',
  ]) {
    assert.ok(providers.has(provider), `missing preview provider: ${provider}`);
  }
});

test('usage desk preview observed usage includes attributed and unresolved codex traffic', () => {
  const observed = getUsageDeskPreviewObservedUsage('codex');

  assert.ok(Array.isArray(observed.items));
  assert.ok(observed.items.length >= 3);
  assert.equal(observed.items[0].provider, 'codex');
  assert.ok(Array.isArray(observed.unresolved));
  assert.equal(observed.unresolved[0].accountKey, '');
});

test('usage desk preview projected usage includes local projected detail rows and stats', () => {
  const projected = getUsageDeskPreviewProjectedUsage('codex');

  assert.ok(Array.isArray(projected.details));
  assert.ok(projected.details.length >= 6);
  assert.equal(projected.details[0].provider, 'codex');
  assert.equal(projected.scannedFiles, 48);
  assert.equal(projected.cacheHitFiles, 29);
});

test('usage desk preview projected usage includes Claude local session rows', () => {
  const projected = getUsageDeskPreviewProjectedUsage('claude');

  assert.ok(Array.isArray(projected.details));
  assert.ok(projected.details.length >= 4);
  assert.equal(projected.details[0].provider, 'claude');
  assert.match(projected.details[0].sessionID, /^projects\//);
  assert.equal(projected.scannedFiles, 18);
});
