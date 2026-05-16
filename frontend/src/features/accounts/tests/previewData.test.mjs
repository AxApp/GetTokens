import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAccountsPreviewAPIKeyRecords,
  getAccountsPreviewAuthFileRecords,
  getAccountsPreviewOpenAICompatibleProviders,
  getAccountsPreviewQuotaStateByKey,
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
  assert.equal(stateByID['codex-api-key:missing'], undefined);
});

test('accounts preview providers remain available for aggregate workspace preview', () => {
  const providers = getAccountsPreviewOpenAICompatibleProviders();

  assert.deepEqual(
    providers.map((provider) => provider.name),
    ['deepseek', 'openrouter'],
  );
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
