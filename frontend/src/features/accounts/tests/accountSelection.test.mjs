import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areAllAccountIDsSelected,
  filterSelectedAccountIDs,
  resolveBulkQuotaRefreshTargets,
  resolveBulkSetDisabledTargets,
  toggleAccountGroupSelection,
  toggleAccountIDSelection,
  toggleAllFilteredAccountIDs,
} from '../model/accountSelection.ts';

test('filterSelectedAccountIDs drops ids that no longer exist', () => {
  assert.deepEqual(
    filterSelectedAccountIDs(['a', 'b', 'c'], ['b', 'c', 'd']),
    ['b', 'c']
  );
});

test('toggleAccountIDSelection removes existing id and appends missing id', () => {
  assert.deepEqual(toggleAccountIDSelection(['a', 'b'], 'b'), ['a']);
  assert.deepEqual(toggleAccountIDSelection(['a'], 'b'), ['a', 'b']);
});

test('toggleAllFilteredAccountIDs selects or clears only filtered items', () => {
  const filteredAccounts = [{ id: 'a' }, { id: 'b' }];

  assert.deepEqual(toggleAllFilteredAccountIDs(['x'], filteredAccounts, false), ['x', 'a', 'b']);
  assert.deepEqual(toggleAllFilteredAccountIDs(['x', 'a', 'b'], filteredAccounts, true), ['x']);
});

test('toggleAccountGroupSelection selects or clears one group without touching other selections', () => {
  const groupAccounts = [{ id: 'a' }, { id: 'b' }];

  assert.equal(areAllAccountIDsSelected(['x', 'a', 'b'], groupAccounts), true);
  assert.equal(areAllAccountIDsSelected(['x', 'a'], groupAccounts), false);
  assert.deepEqual(toggleAccountGroupSelection(['x'], groupAccounts), ['x', 'a', 'b']);
  assert.deepEqual(toggleAccountGroupSelection(['x', 'a', 'b'], groupAccounts), ['x']);
});

test('resolveBulkQuotaRefreshTargets only includes accounts with quota telemetry keys', () => {
  const selectedAccounts = [
    {
      id: 'auth-file:codex',
      credentialSource: 'auth-file',
      provider: 'codex',
      quotaKey: 'codex.json',
    },
    {
      id: 'auth-file:other',
      credentialSource: 'auth-file',
      provider: 'claude',
      quotaKey: 'claude.json',
    },
    {
      id: 'codex-api-key:tracked',
      credentialSource: 'api-key',
      provider: 'codex',
      quotaKey: 'codex-api-key:tracked',
      quotaEnabled: true,
      quotaCurl: 'curl https://example.com/quota',
    },
    {
      id: 'codex-api-key:missing-key',
      credentialSource: 'api-key',
      provider: 'codex',
      quotaEnabled: true,
      quotaCurl: 'curl https://example.com/quota',
    },
  ];

  const result = resolveBulkQuotaRefreshTargets(selectedAccounts);

  assert.deepEqual(result.targets.map((account) => account.id), ['auth-file:codex', 'codex-api-key:tracked']);
  assert.deepEqual(result.skipped.map((account) => account.id), ['auth-file:other', 'codex-api-key:missing-key']);
});

test('resolveBulkSetDisabledTargets skips unsupported or already matching accounts', () => {
  const selectedAccounts = [
    {
      id: 'auth-file:codex',
      credentialSource: 'auth-file',
      provider: 'codex',
      name: 'codex.json',
      disabled: false,
    },
    {
      id: 'auth-file:missing-name',
      credentialSource: 'auth-file',
      provider: 'codex',
      disabled: false,
    },
    {
      id: 'codex-api-key:tracked',
      credentialSource: 'api-key',
      provider: 'codex',
      disabled: false,
    },
    {
      id: 'openai-compatible:deepseek',
      credentialSource: 'api-key',
      provider: 'deepseek',
      disabled: true,
    },
  ];

  const disableResult = resolveBulkSetDisabledTargets(selectedAccounts, true);
  assert.deepEqual(disableResult.targets.map((account) => account.id), ['auth-file:codex', 'codex-api-key:tracked']);
  assert.deepEqual(disableResult.skipped.map((account) => account.id), ['auth-file:missing-name', 'openai-compatible:deepseek']);

  const enableResult = resolveBulkSetDisabledTargets(selectedAccounts, false);
  assert.deepEqual(enableResult.targets.map((account) => account.id), ['openai-compatible:deepseek']);
  assert.deepEqual(enableResult.skipped.map((account) => account.id), [
    'auth-file:codex',
    'auth-file:missing-name',
    'codex-api-key:tracked',
  ]);
});
