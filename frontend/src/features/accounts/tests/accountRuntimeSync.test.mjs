import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildRuntimeSyncAccountKeys,
  normalizeRuntimeSyncDocumentHidden,
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

test('quota runtime sync reads sidecar status without triggering active quota refresh', async () => {
  const source = await readFile(new URL('../hooks/useAccountsQuotaState.ts', import.meta.url), 'utf8');
  const syncStart = source.indexOf('const syncCodexQuotaStatuses = useCallback');
  assert.notEqual(syncStart, -1);
  const syncEnd = source.indexOf('const refreshCodexQuota = useCallback', syncStart);
  assert.notEqual(syncEnd, -1);
  const syncSource = source.slice(syncStart, syncEnd);

  assert.match(syncSource, /GetAllQuotaStatuses/);
  assert.doesNotMatch(syncSource, /GetCodexQuota/);

  const refreshSource = source.slice(syncEnd);
  assert.match(refreshSource, /GetCodexQuota/);
});

test('accounts feature owns the unified account runtime sync loop', async () => {
  const source = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');
  const hookSource = await readFile(new URL('../hooks/useAccountsRateLimitState.ts', import.meta.url), 'utf8');

  assert.match(source, /ACCOUNT_RUNTIME_SYNC_INTERVAL_MS/);
  assert.match(source, /normalizeRuntimeSyncDocumentHidden/);
  assert.match(source, /runtimeSyncAccounts/);
  assert.match(source, /syncCodexQuotaStatuses\(runtimeSyncAccounts, \{ replace: false \}\)/);
  assert.match(source, /resolveAccountKeys: false/);
  assert.match(source, /fallbackUsageStatistics: false/);
  assert.match(source, /loadAccountRateLimits\(runtimeSyncAccounts\)/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(hookSource, /setInterval/);
});

test('background usage sync skips backend account resolution', async () => {
  const source = await readFile(new URL('../hooks/useAccountsUsageState.ts', import.meta.url), 'utf8');

  assert.match(source, /resolveAccountKeys\?: boolean/);
  assert.match(source, /fallbackUsageStatistics\?: boolean/);
  assert.match(source, /resolveAccountKeys: options\.resolveAccountKeys !== false/);
  assert.match(source, /options\.fallbackUsageStatistics === false/);
});
