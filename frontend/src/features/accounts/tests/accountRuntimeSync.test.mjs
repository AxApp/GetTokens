import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY,
  buildRuntimeSyncAccountKeys,
  normalizeRuntimeSyncDocumentHidden,
  runAccountRuntimeRequestPool,
  shouldRunRuntimeSyncOnVisibilityRestore,
  shouldScheduleAccountRuntimeSync,
} from '../model/accountRuntimeSync.ts';

test('runtime sync waits for ready Wails accounts and visible page', () => {
  assert.equal(shouldScheduleAccountRuntimeSync({
    ready: false,
    hasRuntimeBindings: true,
    accountCount: 1,
    documentHidden: false,
  }), false);
  assert.equal(shouldScheduleAccountRuntimeSync({
    ready: true,
    hasRuntimeBindings: false,
    accountCount: 1,
    documentHidden: false,
  }), false);
  assert.equal(shouldScheduleAccountRuntimeSync({
    ready: true,
    hasRuntimeBindings: true,
    accountCount: 0,
    documentHidden: false,
  }), false);
  assert.equal(shouldScheduleAccountRuntimeSync({
    ready: true,
    hasRuntimeBindings: true,
    accountCount: 1,
    documentHidden: true,
  }), false);
  assert.equal(shouldScheduleAccountRuntimeSync({
    ready: true,
    hasRuntimeBindings: true,
    accountCount: 1,
    documentHidden: false,
  }), true);
});

test('runtime sync does not let Wails document visibility quirks block desktop sync', () => {
  assert.equal(normalizeRuntimeSyncDocumentHidden({
    documentHidden: true,
    hasRuntimeBindings: false,
  }), true);
  assert.equal(normalizeRuntimeSyncDocumentHidden({
    documentHidden: true,
    hasRuntimeBindings: true,
  }), false);
  assert.equal(normalizeRuntimeSyncDocumentHidden({
    documentHidden: false,
    hasRuntimeBindings: true,
  }), false);
});

test('runtime sync runs once when the accounts page becomes visible again', () => {
  assert.equal(shouldRunRuntimeSyncOnVisibilityRestore({
    wasHidden: true,
    documentHidden: false,
    canSchedule: true,
  }), true);
  assert.equal(shouldRunRuntimeSyncOnVisibilityRestore({
    wasHidden: false,
    documentHidden: false,
    canSchedule: true,
  }), false);
  assert.equal(shouldRunRuntimeSyncOnVisibilityRestore({
    wasHidden: true,
    documentHidden: true,
    canSchedule: true,
  }), false);
  assert.equal(shouldRunRuntimeSyncOnVisibilityRestore({
    wasHidden: true,
    documentHidden: false,
    canSchedule: false,
  }), false);
});

test('runtime sync account keys are stable and deduplicated by account key', () => {
  const accounts = [
    { id: 'auth-file:legacy', quotaKey: 'acct-a' },
    { id: 'acct-b', quotaKey: 'acct-b' },
    { id: 'display-only' },
    { id: 'acct-a', quotaKey: 'acct-a' },
    { id: 'api-key:old', quotaKey: 'codex-api-key:stable-001' },
    { id: '', quotaKey: '' },
  ];

  assert.deepEqual(buildRuntimeSyncAccountKeys(accounts), [
    'acct-a',
    'acct-b',
    'codex-api-key:stable-001',
  ]);
});

test('runtime request pool caps concurrent account refreshes', async () => {
  const items = Array.from({ length: 23 }, (_, index) => index);
  let active = 0;
  let maxActive = 0;
  const visited = [];

  await runAccountRuntimeRequestPool(items, async (item, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    visited.push([item, index]);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
  }, { concurrency: 5 });

  assert.equal(maxActive, 5);
  assert.deepEqual(
    visited.map(([item]) => item).sort((a, b) => a - b),
    items,
  );
  assert.deepEqual(
    visited.map(([, index]) => index).sort((a, b) => a - b),
    items,
  );
});

test('runtime quota refresh uses a conservative request pool size', () => {
  assert.equal(ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY, 6);
});

test('quota runtime sync reads sidecar status without triggering active quota refresh', async () => {
  const source = await readFile(new URL('../hooks/useAccountsQuotaState.ts', import.meta.url), 'utf8');
  const syncStart = source.indexOf('const syncCodexQuotaStatuses = useCallback');
  assert.notEqual(syncStart, -1);
  const syncEnd = source.indexOf('const refreshCodexQuota = useCallback', syncStart);
  assert.notEqual(syncEnd, -1);
  const syncSource = source.slice(syncStart, syncEnd);

  assert.match(syncSource, /GetQuotaStatuses/);
  assert.match(syncSource, /accountKeys: quotaKeys/);
  assert.match(syncSource, /GetAllQuotaStatuses/);
  assert.match(syncSource, /fallback: true/);
  assert.doesNotMatch(syncSource, /GetCodexQuota/);

  const refreshSource = source.slice(syncEnd);
  assert.match(refreshSource, /GetCodexQuota/);
  assert.match(refreshSource, /RefreshCodexQuotasBatch/);
});

test('accounts feature owns the unified account runtime sync loop', async () => {
  const source = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');
  const hookSource = await readFile(new URL('../hooks/useAccountsRateLimitState.ts', import.meta.url), 'utf8');

  assert.match(source, /ACCOUNT_RUNTIME_SYNC_INTERVAL_MS/);
  assert.match(source, /normalizeRuntimeSyncDocumentHidden/);
  assert.match(source, /runtimeSyncAccounts/);
  assert.match(source, /syncCodexQuotaStatuses\(runtimeSyncAccounts, \{ replace: false \}\)/);
  assert.doesNotMatch(source, /runAccountRuntimeRequestPool\(runtimeSyncAccounts,\s*refreshCodexQuota/);
  assert.doesNotMatch(source, /ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY/);
  assert.doesNotMatch(source, /Promise\.all\(runtimeSyncAccounts\.map\(\(account\) => refreshCodexQuota\(account\)\)\)/);
  assert.match(source, /resolveAccountKeys: false/);
  assert.match(source, /loadAccountRateLimits\(runtimeSyncAccounts\)/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(hookSource, /setInterval/);
});

test('selected bulk quota refresh uses the sidecar batch job endpoint with sync fallback', async () => {
  const actionsSource = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const quotaHookSource = await readFile(new URL('../hooks/useAccountsQuotaState.ts', import.meta.url), 'utf8');
  const bulkRefreshStart = actionsSource.indexOf('const runSelectedBulkRefresh = useCallback');
  assert.notEqual(bulkRefreshStart, -1);
  const bulkRefreshEnd = actionsSource.indexOf('const runAccountsBulkSetDisabled = useCallback', bulkRefreshStart);
  assert.notEqual(bulkRefreshEnd, -1);
  const bulkRefreshSource = actionsSource.slice(bulkRefreshStart, bulkRefreshEnd);

  assert.match(bulkRefreshSource, /refreshAccountQuotasBatch\(resolution\.targets\)/);
  assert.doesNotMatch(bulkRefreshSource, /for \(const account of resolution\.targets\)/);
  assert.match(quotaHookSource, /StartCodexQuotasBatchRefreshJob/);
  assert.match(quotaHookSource, /GetCodexQuotaBatchRefreshJob/);
  assert.match(quotaHookSource, /RefreshCodexQuotasBatch/);
  assert.match(quotaHookSource, /fallback: true/);
  assert.match(quotaHookSource, /main\.CodexQuotaBatchRefreshInput\.createFrom/);
  assert.match(quotaHookSource, /errors \|\| \[\]/);
  assert.match(quotaHookSource, /status === 'canceled'/);
});

test('selected bulk delete uses the sidecar batch endpoint', async () => {
  const actionsSource = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');
  const bulkDeleteStart = actionsSource.indexOf('const runSelectedBulkDelete = useCallback');
  assert.notEqual(bulkDeleteStart, -1);
  const bulkDeleteEnd = actionsSource.indexOf('const runSelectedBulkRefresh = useCallback', bulkDeleteStart);
  assert.notEqual(bulkDeleteEnd, -1);
  const bulkDeleteSource = actionsSource.slice(bulkDeleteStart, bulkDeleteEnd);

  assert.match(actionsSource, /const runAccountsBulkDelete = useCallback/);
  assert.match(actionsSource, /resolveBulkDeleteTargets\(targetAccounts\)/);
  assert.match(bulkDeleteSource, /runAccountsBulkDelete\(selectedAccounts/);
  assert.match(actionsSource, /DeleteAccountsBatch/);
  assert.match(actionsSource, /main\.DeleteAccountsBatchInput\.createFrom/);
  assert.doesNotMatch(bulkDeleteSource, /executeDeleteAccount/);
  assert.doesNotMatch(bulkDeleteSource, /for \(const account of selectedAccounts\)/);
});

test('background usage sync skips backend account resolution', async () => {
  const source = await readFile(new URL('../hooks/useAccountsUsageState.ts', import.meta.url), 'utf8');

  assert.match(source, /resolveAccountKeys\?: boolean/);
  assert.match(source, /resolveAccountKeys: options\.resolveAccountKeys !== false/);
  assert.doesNotMatch(source, /GetUsageStatistics/);
});
