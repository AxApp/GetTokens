import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_DIAGNOSTICS_VISIBLE_ID_LIMIT,
  buildAccountDiagnosticsSnapshot,
  readAccountDiagnosticsStorage,
} from '../model/accountDiagnostics.ts';
import { ACCOUNT_LIST_CACHE_STORAGE_KEY } from '../model/accountListCache.ts';
import { ACCOUNT_QUOTA_CACHE_STORAGE_KEY } from '../model/accountQuotaCache.ts';

function createStorage(values) {
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
  };
}

test('readAccountDiagnosticsStorage summarizes account list and quota cache safely', () => {
  const storage = createStorage({
    [ACCOUNT_LIST_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      updatedAt: 1783481000000,
      items: [{ id: 'acct-a' }, { id: 'acct-b' }],
    }),
    [ACCOUNT_QUOTA_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      items: {
        'acct-a': { quota: { status: 'stale', blocked: true }, updatedAt: 1783481000100 },
        'acct-b': { quota: { status: 'success', blocked: false }, updatedAt: 1783481000200 },
      },
    }),
  });

  const summary = readAccountDiagnosticsStorage(storage);

  assert.equal(summary.listCacheCount, 2);
  assert.equal(summary.listCacheUpdatedAt, 1783481000000);
  assert.equal(summary.quotaCacheCount, 2);
  assert.equal(summary.quotaCacheUpdatedAt, 1783481000200);
  assert.equal(summary.quotaItems['acct-a'].quota.blocked, true);
});

test('buildAccountDiagnosticsSnapshot exposes source, visible sync, and target account comparison', () => {
  const targetIDs = Array.from({ length: ACCOUNT_DIAGNOSTICS_VISIBLE_ID_LIMIT + 2 }, (_, index) => `acct-${index}`);
  const snapshot = buildAccountDiagnosticsSnapshot({
    href: 'http://127.0.0.1:34115/#frame=accounts',
    hasWailsBindings: true,
    sidecarCode: 'ready',
    sidecarPort: 18317,
    accounts: [
      { id: 'acct-live', displayName: 'Live Account', provider: 'codex', credentialSource: 'auth-file', quotaKey: 'quota-live' },
      { id: 'acct-other', displayName: 'Other Account', provider: 'codex', credentialSource: 'auth-file', quotaKey: 'quota-other' },
    ],
    filteredAccounts: [
      { id: 'acct-live', displayName: 'Live Account', provider: 'codex', credentialSource: 'auth-file', quotaKey: 'quota-live' },
    ],
    runtimeSyncTargetAccountIDs: targetIDs,
    codexQuotaByName: {
      'quota-live': {
        status: 'success',
        quota: { accountKey: 'quota-live', status: 'stale', blocked: true, windows: [] },
      },
    },
    storage: createStorage({
      [ACCOUNT_QUOTA_CACHE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        items: {
          'quota-live': { quota: { accountKey: 'quota-live', status: 'success', blocked: false, windows: [] }, updatedAt: 1783481000100 },
        },
      }),
    }),
    targetAccountID: 'acct-live',
  });

  assert.equal(snapshot.origin, 'http://127.0.0.1:34115');
  assert.equal(snapshot.hasWailsBindings, true);
  assert.equal(snapshot.sidecarCode, 'ready');
  assert.equal(snapshot.sidecarPort, '18317');
  assert.equal(snapshot.accountCount, 2);
  assert.equal(snapshot.filteredAccountCount, 1);
  assert.equal(snapshot.runtimeSyncTargetCount, ACCOUNT_DIAGNOSTICS_VISIBLE_ID_LIMIT + 2);
  assert.deepEqual(snapshot.visibleRuntimeSyncTargetIDs, targetIDs.slice(0, ACCOUNT_DIAGNOSTICS_VISIBLE_ID_LIMIT));
  assert.equal(snapshot.hiddenRuntimeSyncTargetCount, 2);
  assert.equal(snapshot.quotaStateCount, 1);
  assert.equal(snapshot.quotaCacheCount, 1);
  assert.equal(snapshot.targetAccountName, 'Live Account');
  assert.equal(snapshot.targetRuntimeStatus, 'stale');
  assert.equal(snapshot.targetRuntimeBlocked, true);
  assert.equal(snapshot.targetCacheStatus, 'success');
  assert.equal(snapshot.targetCacheBlocked, false);
});
