import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNTS_FILTERS_STORAGE_KEY,
  defaultAccountsFilterState,
  isAccountsFilterSourceSelected,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
  toggleAccountsFilterSource,
} from '../model/accountFilters.ts';

test('readStoredAccountsFilterState restores a valid stored filter state', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNTS_FILTERS_STORAGE_KEY);
      return JSON.stringify({
        source: 'api-key',
        availability: 'requestable',
        hasBalance: true,
        hasLongestQuota: true,
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    source: 'api-key',
    availability: 'requestable',
    hasBalance: true,
    hasLongestQuota: true,
  });
});

test('readStoredAccountsFilterState migrates legacy stored filter state to availability', () => {
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"hasLongestQuota":true,"errorsOnly":true}';
      },
    }),
    {
      ...defaultAccountsFilterState,
      availability: 'errors',
      hasBalance: false,
      hasLongestQuota: true,
    },
  );
});

test('readStoredAccountsFilterState restores empty source selection', () => {
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"source":"none"}';
      },
    }),
    {
      ...defaultAccountsFilterState,
      source: 'none',
    },
  );
});

test('source filter toggles incrementally and all selected maps to all', () => {
  assert.equal(isAccountsFilterSourceSelected('all', 'auth-file'), true);
  assert.equal(isAccountsFilterSourceSelected('all', 'api-key'), true);

  assert.equal(toggleAccountsFilterSource('all', 'auth-file'), 'api-key');
  assert.equal(toggleAccountsFilterSource('api-key', 'api-key'), 'none');
  assert.equal(toggleAccountsFilterSource('none', 'auth-file'), 'auth-file');
  assert.equal(toggleAccountsFilterSource('auth-file', 'api-key'), 'all');
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
    source: 'none',
    availability: 'disabled',
    hasBalance: true,
    hasLongestQuota: false,
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        source: 'none',
        availability: 'disabled',
        hasBalance: true,
        hasLongestQuota: false,
      }),
    ],
  ]);
});
