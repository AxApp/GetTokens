import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout.ts';
import { findAccountDetailByID } from '../model/accountDetailSelection.ts';

test('account detail overview keeps runtime snapshot and evidence as a 50/50 desktop split', async () => {
  const source = await readFile(new URL('../components/AccountDetailPrimitives.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-detail-overview-layout="split-50-50"/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
});

test('account detail keeps auth-file modules lightweight', () => {
  assert.deepEqual(
    buildAccountDetailModulePlan({ credentialSource: 'auth-file' }),
    ['auth-file-actions', 'models', 'rate-limit'],
  );
});

test('auth-file summary keeps raw content hidden and retains model catalog', async () => {
  const source = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /componentName="AuthFileSummarySection"/);
  assert.doesNotMatch(source, /componentName="AuthFileSummarySection"[\s\S]{0,180}span="wide"/);
  assert.match(source, /componentName="CompatibleModelsSection"/);
  assert.doesNotMatch(source, /tReadonlyProxyReason/);
});

test('runtime quota rows use a full-width visible progress track', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /<QuotaBars quotaDisplay=\{quotaDisplay\} t=\{t\} \/>/);
  assert.doesNotMatch(source, /data-account-quota-progress-track/);
  assert.doesNotMatch(source, /data-account-quota-progress-fill/);
});

test('runtime stats render as a compact strip instead of a large stat grid', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-runtime-stat-strip/);
  assert.match(source, /md:grid-cols-3/);
  assert.doesNotMatch(source, /<AccountDetailStatGrid columns=\{6\}>/);
});

test('api key credential fields stack vertically with embedded labels', async () => {
  const source = await readFile(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-credential-fields="stacked"/);
  assert.match(source, /data-account-credential-field-label="embedded"/);
  assert.doesNotMatch(source, /md:grid-cols-2/);
});

test('account detail preserves api-key edit modules', () => {
  assert.deepEqual(
    buildAccountDetailModulePlan({ credentialSource: 'api-key' }),
    ['credentials', 'proxy-route', 'rate-limit', 'verify', 'quota', 'billing'],
  );
});

test('account detail deep link resolves an account by stable id', () => {
  const accounts = [
    { id: 'auth-file:codex-pro.json', credentialSource: 'auth-file', provider: 'codex', displayName: 'Pro', status: 'active' },
    { id: 'codex-api-key:stable-001', credentialSource: 'api-key', provider: 'codex', displayName: 'Stable', status: 'configured' },
  ];

  assert.equal(findAccountDetailByID(accounts, 'auth-file:codex-pro.json')?.displayName, 'Pro');
  assert.equal(findAccountDetailByID(accounts, 'missing'), null);
});

test('account detail close clears local hash state before selected account can rehydrate', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const closeHashBlock = source.match(/const clearAccountDetailInHash = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/)?.[0] ?? '';

  assert.match(closeHashBlock, /setAccountDetailIDFromHash\(''\);/);
  assert.match(closeHashBlock, /clearAccountDetailFrameHash\(window\.location\.hash\)/);
  assert.ok(
    closeHashBlock.indexOf("setAccountDetailIDFromHash('');") < closeHashBlock.indexOf('clearAccountDetailFrameHash(window.location.hash)'),
    'local detail state must be cleared before hashchange can re-run account hydration',
  );
});
