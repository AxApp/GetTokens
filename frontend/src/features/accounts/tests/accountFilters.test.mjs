import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNTS_FILTERS_STORAGE_KEY,
  defaultAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
} from '../model/accountFilters.ts';

test('readStoredAccountsFilterState restores a valid stored filter state', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNTS_FILTERS_STORAGE_KEY);
      return JSON.stringify({
        source: 'auth-file',
        hasLongestQuota: true,
        errorsOnly: false,
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    source: 'auth-file',
    hasLongestQuota: true,
    errorsOnly: false,
  });
});

test('readStoredAccountsFilterState falls back for invalid or missing storage payloads', () => {
  assert.deepEqual(readStoredAccountsFilterState(null), defaultAccountsFilterState);
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"source":"relay","hasLongestQuota":"yes"}';
      },
    }),
    defaultAccountsFilterState,
  );
});

test('persistAccountsFilterState serializes the full filter state', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistAccountsFilterState(storage, {
    source: 'api-key',
    hasLongestQuota: false,
    errorsOnly: true,
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        source: 'api-key',
        hasLongestQuota: false,
        errorsOnly: true,
      }),
    ],
  ]);
});
