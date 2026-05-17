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
        hasLongestQuota: true,
        errorsOnly: false,
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    hasLongestQuota: true,
    errorsOnly: false,
  });
});

test('readStoredAccountsFilterState falls back for invalid or missing storage payloads', () => {
  assert.deepEqual(readStoredAccountsFilterState(null), defaultAccountsFilterState);
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"hasLongestQuota":"yes"}';
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
    hasLongestQuota: false,
    errorsOnly: true,
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        hasLongestQuota: false,
        errorsOnly: true,
      }),
    ],
  ]);
});
