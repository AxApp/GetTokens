import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNTS_FILTERS_STORAGE_KEY,
  applyAccountsFilterState,
  defaultAccountsFilterState,
  isAccountsFilterSourceSelected,
  normalizeAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
  summarizeAccountsFilterState,
  toggleAccountsFilterSource,
} from '../model/accountFilters.ts';

test('readStoredAccountsFilterState restores a valid stored filter state', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNTS_FILTERS_STORAGE_KEY);
      return JSON.stringify({
        source: 'api-key',
        requiresRequestable: true,
        hasBalance: true,
        hasLongestQuota: true,
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    source: 'api-key',
    requiresRequestable: true,
    requiresDisabled: false,
    requiresError: false,
    hasBalance: true,
    hasLongestQuota: true,
  });
});

test('readStoredAccountsFilterState ignores legacy filter fields', () => {
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"hasLongestQuota":true,"errorsOnly":true}';
      },
    }),
    {
      ...defaultAccountsFilterState,
      hasBalance: false,
      hasLongestQuota: true,
    },
  );
});

test('normalizeAccountsFilterState keeps only supported fields and coercions', () => {
  assert.deepEqual(
    normalizeAccountsFilterState({
      source: 'blocked-only',
      requiresRequestable: 1,
      requiresDisabled: true,
      requiresError: 'yes',
      hasBalance: true,
      hasLongestQuota: false,
      legacy: 'ignored',
    }),
    {
      ...defaultAccountsFilterState,
      source: 'all',
      requiresDisabled: true,
      hasBalance: true,
    },
  );
});

test('applyAccountsFilterState normalizes patched filter state', () => {
  assert.deepEqual(
    applyAccountsFilterState(
      {
        ...defaultAccountsFilterState,
        source: 'api-key',
        requiresRequestable: true,
      },
      {
        source: 'none',
        requiresError: true,
        hasLongestQuota: true,
        requiresDisabled: false,
      },
    ),
    {
      ...defaultAccountsFilterState,
      source: 'none',
      requiresRequestable: true,
      requiresDisabled: false,
      requiresError: true,
      hasBalance: false,
      hasLongestQuota: true,
    },
  );
});

test('summarizeAccountsFilterState keeps status, resource, and source parts in a stable order', () => {
  assert.deepEqual(
    summarizeAccountsFilterState((key) => key, {
      source: 'auth-file',
      requiresRequestable: true,
      requiresDisabled: true,
      requiresError: true,
      hasBalance: true,
      hasLongestQuota: true,
    }).map((part) => [part.kind, part.label]),
    [
      ['status', 'accounts.filter_requestable_match'],
      ['status', 'accounts.filter_error_match'],
      ['status', 'accounts.filter_disabled_match'],
      ['resource', 'accounts.filter_longest_quota_match'],
      ['resource', 'accounts.filter_balance_match'],
      ['source', 'accounts.source_auth_file'],
    ],
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

test('AccountsToolbar keeps status, resource, and source filters in the new order', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');
  const assertBefore = (left, right, content = source) => {
    const leftIndex = content.indexOf(left);
    const rightIndex = content.indexOf(right);
    assert.notEqual(leftIndex, -1);
    assert.notEqual(rightIndex, -1);
    assert.ok(leftIndex < rightIndex, `${left} should appear before ${right}`);
  };

  assertBefore('accounts.filter_group_status', 'accounts.filter_group_resource');
  assertBefore('accounts.filter_group_resource', 'accounts.filter_group_source');
  assertBefore("{ key: 'requiresRequestable', label: t('accounts.filter_requestable_match') }", "{ key: 'requiresError', label: t('accounts.filter_error_match') }");
  assertBefore("{ key: 'requiresError', label: t('accounts.filter_error_match') }", "{ key: 'requiresDisabled', label: t('accounts.filter_disabled_match') }");
  assertBefore("t('accounts.filter_longest_quota_match')", "t('accounts.filter_balance_match')");
  assert.equal(source.includes('function FilterCheckbox'), false);
  assert.equal(source.includes('FilterMenuButton'), false);
  assert.equal(source.includes('type="radio"'), false);
  assert.ok((source.match(/<FilterCheckOption/g) || []).length >= 5);
  assert.equal(source.includes('availability'), false);
  assert.equal(source.includes('errorsOnly'), false);
  assert.equal(source.includes('disabledOnly'), false);
  assert.equal(source.includes('requestableOnly'), false);
  assert.equal(source.includes('filter_disabled_only'), false);
  assert.equal(source.includes('errors_only'), false);

  const labelStart = source.indexOf('function buildToolbarFilterLabel');
  assert.notEqual(labelStart, -1);
  const labelSource = source.slice(labelStart);
  assert.match(labelSource, /summarizeAccountsFilterState/);
  assert.match(labelSource, /parts\.map\(\(part\) => part\.label\)/);
  assert.doesNotMatch(labelSource, /parts\.push\(/);
  assert.equal(labelSource.includes('accounts.filter_requestable_match'), false);
  assert.equal(labelSource.includes('accounts.filter_error_match'), false);
  assert.equal(labelSource.includes('accounts.filter_disabled_match'), false);
  assert.equal(labelSource.includes('accounts.filter_longest_quota_match'), false);
  assert.equal(labelSource.includes('accounts.filter_balance_match'), false);
  assert.equal(labelSource.includes('accounts.filter_source_none'), false);
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
    ...defaultAccountsFilterState,
    source: 'none',
    requiresDisabled: true,
    hasBalance: true,
    hasLongestQuota: false,
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        source: 'none',
        requiresRequestable: false,
        requiresDisabled: true,
        requiresError: false,
        hasBalance: true,
        hasLongestQuota: false,
      }),
    ],
  ]);
});
