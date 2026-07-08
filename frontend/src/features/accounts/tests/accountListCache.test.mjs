import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNT_LIST_CACHE_STORAGE_KEY,
  persistStoredAccountRecords,
  readStoredAccountRecords,
} from '../model/accountListCache.ts';

function createMemoryStorage(initial = {}) {
  const values = { ...initial };
  const writes = [];
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
      values[key] = value;
    },
    values,
    writes,
  };
}

test('readStoredAccountRecords restores cached account records for first paint', () => {
  const storage = createMemoryStorage({
    [ACCOUNT_LIST_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      updatedAt: 1781000000000,
      items: [
        {
          id: 'acct_cache_1',
          accountKind: 'codex-api-key',
          provider: 'openai',
          credentialSource: 'api-key',
          displayName: 'Cached API Key',
          status: 'ACTIVE',
          runtimeStatus: 'registered_routeable',
          routeable: true,
          registeredModelCount: 3,
          runtimeFailureClass: '',
          quotaKey: 'acct_cache_1',
          priority: 9,
          supportedFormats: ['openai_responses'],
          formatBaseUrls: { openai_responses: 'https://api.openai.com/v1' },
        },
      ],
    }),
  });

  const records = readStoredAccountRecords(storage);

  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'acct_cache_1');
  assert.equal(records[0].credentialSource, 'api-key');
  assert.equal(records[0].displayName, 'Cached API Key');
  assert.equal(records[0].quotaKey, 'acct_cache_1');
  assert.equal(records[0].runtimeStatus, 'registered_routeable');
  assert.equal(records[0].routeable, true);
  assert.equal(records[0].registeredModelCount, 3);
  assert.equal(records[0].runtimeFailureClass, undefined);
});

test('persistStoredAccountRecords stores display data without account secrets', () => {
  const storage = createMemoryStorage();

  persistStoredAccountRecords(storage, [
    {
      id: 'acct_secret',
      accountKind: 'codex-api-key',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Secret Account',
      status: 'ACTIVE',
      apiKey: 'sk-live-secret',
      apiKeys: ['sk-live-secret-2'],
      headers: { Authorization: 'Bearer hidden' },
      platformCookie: 'session=hidden',
      curlVariables: { platformCookie: 'session=hidden' },
      modelFetchApiKey: 'sk-model-secret',
      modelFetchBaseUrl: 'https://models.example.com',
      rawAuthFile: { access_token: 'hidden' },
      quotaCurl: 'curl https://quota.example.com -b session=hidden',
      quotaEnabled: true,
      quotaKey: 'acct_secret',
      runtimeStatus: 'applied_not_registered',
      runtimeReason: 'runtime auth missing from registry',
      runtimeFailureClass: 'runtime_auth_missing',
      routeable: false,
      registeredModelCount: 0,
      runtimeRepairTriggerClass: 'runtime_auth_missing',
      keySuffix: 'cret',
      baseUrl: 'https://api.openai.com/v1',
    },
  ]);

  const raw = storage.values[ACCOUNT_LIST_CACHE_STORAGE_KEY];
  assert.equal(raw.includes('sk-live-secret'), false);
  assert.equal(raw.includes('session=hidden'), false);
  assert.equal(raw.includes('Authorization'), false);
  assert.equal(raw.includes('access_token'), false);

  const records = readStoredAccountRecords(storage);
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'acct_secret');
  assert.equal(records[0].keySuffix, 'cret');
  assert.equal(records[0].quotaEnabled, true);
  assert.equal(records[0].runtimeStatus, 'applied_not_registered');
  assert.equal(records[0].runtimeReason, 'runtime auth missing from registry');
  assert.equal(records[0].runtimeFailureClass, 'runtime_auth_missing');
  assert.equal(records[0].runtimeRepairTriggerClass, 'runtime_auth_missing');
  assert.equal(records[0].routeable, false);
  assert.equal(records[0].apiKey, undefined);
  assert.equal(records[0].rawAuthFile, undefined);
});

test('persistStoredAccountRecords skips localStorage writes when display data is unchanged', () => {
  const cachedItem = {
    id: 'acct_cache_1',
    accountKind: 'codex-api-key',
    provider: 'openai',
    credentialSource: 'api-key',
    displayName: 'Cached API Key',
    status: 'ACTIVE',
    quotaKey: 'acct_cache_1',
    supportedFormats: ['openai_responses'],
    formatBaseUrls: { openai_responses: 'https://api.openai.com/v1' },
  };
  const storage = createMemoryStorage({
    [ACCOUNT_LIST_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      updatedAt: 1781000000000,
      items: [cachedItem],
    }),
  });

  persistStoredAccountRecords(storage, [cachedItem]);

  assert.equal(storage.writes.length, 0);
});

test('persistStoredAccountRecords writes when display data changes', () => {
  const cachedItem = {
    id: 'acct_cache_1',
    accountKind: 'codex-api-key',
    provider: 'openai',
    credentialSource: 'api-key',
    displayName: 'Cached API Key',
    status: 'ACTIVE',
    quotaKey: 'acct_cache_1',
  };
  const storage = createMemoryStorage({
    [ACCOUNT_LIST_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      updatedAt: 1781000000000,
      items: [cachedItem],
    }),
  });

  persistStoredAccountRecords(storage, [{ ...cachedItem, displayName: 'Renamed API Key' }]);

  assert.equal(storage.writes.length, 1);
  const parsed = JSON.parse(storage.values[ACCOUNT_LIST_CACHE_STORAGE_KEY]);
  assert.equal(parsed.items[0].displayName, 'Renamed API Key');
});

test('useAccountsPageState seeds first paint from account list cache and refreshes it from ListAccounts', async () => {
  const source = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');

  assert.match(source, /readInitialAccountRecordsCache\(\)/);
  assert.match(source, /ListCachedAccounts/);
  assert.match(source, /sqliteSnapshotRequestedRef/);
  assert.match(source, /liveAccountsLoadedRef\.current/);
  assert.match(source, /initialCachedAccounts\.filter\(\(account\) => account\.credentialSource === 'auth-file'\)/);
  assert.match(source, /initialCachedAccounts\.filter\(\(account\) => account\.credentialSource === 'api-key'\)/);
  assert.match(source, /persistAccountRecordsCache\(mappedAccounts\)/);
  assert.match(source, /persistAccountRecordsCache\(\[\.\.\.nextAuthFileRecords, \.\.\.apiKeyAccounts\]\)/);
  const snapshotBlock = source.slice(
    source.indexOf('async function loadSQLiteSnapshot'),
    source.indexOf('void loadSQLiteSnapshot'),
  );
  assert.doesNotMatch(snapshotBlock, /setAccountsLoaded\(true\)/);
});
