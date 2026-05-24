import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNTS_FILTERS_STORAGE_KEY,
  applyAccountsFilterState,
  defaultAccountsFilterState,
  normalizeAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
  summarizeAccountsFilterState,
} from '../model/accountFilters.ts';

test('readStoredAccountsFilterState restores a valid grouped filter state', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNTS_FILTERS_STORAGE_KEY);
      return JSON.stringify({
        source: { authFile: true, apiKey: false },
        resource: { hasLongestQuota: false, hasBalance: true },
        status: { error: true, disabled: false, requestable: false },
        plan: { free: true, plus: false, pro: true },
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    source: { authFile: true, apiKey: false },
    resource: { hasLongestQuota: false, hasBalance: true },
    status: { error: true, disabled: false, requestable: false },
    plan: { free: true, plus: false, pro: true },
  });
});

test('normalizeAccountsFilterState migrates the legacy flat filter payload', () => {
  assert.deepEqual(
    normalizeAccountsFilterState({
      source: 'api-key',
      requiresRequestable: true,
      requiresDisabled: true,
      requiresError: false,
      hasBalance: true,
      hasLongestQuota: false,
      legacy: 'ignored',
    }),
    {
      ...defaultAccountsFilterState,
      source: { authFile: false, apiKey: true },
      resource: { hasLongestQuota: false, hasBalance: true },
      status: { error: false, disabled: true, requestable: true },
      plan: { free: true, plus: true, pro: true },
    },
  );
});

test('applyAccountsFilterState deep merges nested patch objects', () => {
  assert.deepEqual(
    applyAccountsFilterState(
      {
        ...defaultAccountsFilterState,
        source: { authFile: true, apiKey: false },
        resource: { hasLongestQuota: true, hasBalance: false },
        status: { error: true, disabled: false, requestable: true },
        plan: { free: true, plus: false, pro: true },
      },
      {
        source: { apiKey: true },
        resource: { hasBalance: true },
        status: { error: false },
        plan: { plus: true },
      },
    ),
    {
      source: { authFile: true, apiKey: true },
      resource: { hasLongestQuota: true, hasBalance: true },
      status: { error: false, disabled: false, requestable: true },
      plan: { free: true, plus: true, pro: true },
    },
  );
});

test('summarizeAccountsFilterState keeps source, resource, status, and plan parts in a stable order', () => {
  assert.deepEqual(
    summarizeAccountsFilterState((key) => key, {
      source: { authFile: false, apiKey: true },
      resource: { hasLongestQuota: false, hasBalance: true },
      status: { error: true, disabled: true, requestable: false },
      plan: { free: true, plus: false, pro: true },
    }).map((part) => [part.kind, part.label]),
    [
      ['source', 'accounts.source_api_key'],
      ['resource', 'accounts.filter_balance_match'],
      ['status', 'accounts.filter_error_match'],
      ['status', 'accounts.filter_disabled_match'],
      ['plan', 'free'],
      ['plan', 'pro'],
    ],
  );
});

test('summarizeAccountsFilterState omits fully selected groups', () => {
  assert.deepEqual(
    summarizeAccountsFilterState((key) => key, defaultAccountsFilterState),
    [],
  );
});

test('readStoredAccountsFilterState falls back for invalid or missing storage payloads', () => {
  assert.deepEqual(readStoredAccountsFilterState(null), defaultAccountsFilterState);
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"source":{"authFile":"yes"}}';
      },
    }),
    defaultAccountsFilterState,
  );
});

test('persistAccountsFilterState serializes the full grouped filter state', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistAccountsFilterState(storage, {
    source: { authFile: false, apiKey: true },
    resource: { hasLongestQuota: true, hasBalance: false },
    status: { error: true, disabled: false, requestable: true },
    plan: { free: false, plus: true, pro: false },
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        source: { authFile: false, apiKey: true },
        resource: { hasLongestQuota: true, hasBalance: false },
        status: { error: true, disabled: false, requestable: true },
        plan: { free: false, plus: true, pro: false },
      }),
    ],
  ]);
});

test('AccountsToolbar renders the grouped filter sections in the new order', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');
  const assertBefore = (left, right, content = source) => {
    const leftIndex = content.indexOf(left);
    const rightIndex = content.indexOf(right);
    assert.notEqual(leftIndex, -1);
    assert.notEqual(rightIndex, -1);
    assert.ok(leftIndex < rightIndex, `${left} should appear before ${right}`);
  };

  assertBefore('accounts.filter_group_source', 'accounts.filter_group_resource');
  assertBefore('accounts.filter_group_resource', 'accounts.filter_group_status');
  assertBefore('accounts.filter_group_status', 'accounts.filter_group_plan');
  assertBefore("free", "plus");
  assertBefore("plus", "pro");
  assert.equal(source.includes('requiresRequestable'), false);
  assert.equal(source.includes('requiresDisabled'), false);
  assert.equal(source.includes('requiresError'), false);
  assert.equal(source.includes('hasLongestQuota'), true);
  assert.equal(source.includes('accounts.filter_group_plan'), true);
  assert.equal(source.includes('uppercase={false}'), true);
  assert.equal(source.includes('accounts.filter_all'), true);
  assert.equal(source.includes('accounts.group_mode_label'), true);
  assert.equal(source.includes('accounts.group_mode_plan'), true);
  assert.equal(source.includes('accounts.group_mode_source'), true);
  assert.equal(source.includes('accounts.group_mode_status'), true);
  assert.equal(source.includes('accounts.sort_mode_label'), true);
  assert.equal(source.includes('accounts.sort_mode_priority'), true);
  assert.equal(source.includes('accounts.sort_mode_quota'), true);
});
