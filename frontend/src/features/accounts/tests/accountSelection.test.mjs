import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areAllAccountIDsSelected,
  filterSelectedAccountIDs,
  resolveAccountGroupActionAvailability,
  resolveBulkDeleteTargets,
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

test('resolveAccountGroupActionAvailability summarizes large group actions in one model call', () => {
  const groupAccounts = [
    {
      id: 'acct_auth_file',
      accountKind: 'auth-file',
      credentialSource: 'auth-file',
      provider: 'codex',
      name: 'codex.json',
      quotaKey: 'codex.json',
      disabled: false,
    },
    {
      id: 'acct_disabled_provider',
      accountKind: 'openai-compatible',
      credentialSource: 'api-key',
      provider: 'deepseek',
      quotaKey: 'acct_disabled_provider',
      quotaEnabled: true,
      quotaCurl: 'curl https://example.com/quota',
      disabled: true,
    },
    {
      id: 'legacy:skip-delete',
      credentialSource: 'api-key',
      provider: 'codex',
      disabled: false,
    },
  ];

  assert.deepEqual(
    resolveAccountGroupActionAvailability(groupAccounts, new Set(groupAccounts.map((account) => account.id))),
    {
      hasAccounts: true,
      allGroupSelected: true,
      canRefreshGroup: true,
      canEnableGroup: true,
      canDisableGroup: true,
      canDeleteGroup: true,
    },
  );
  assert.equal(resolveAccountGroupActionAvailability(groupAccounts, new Set(['acct_auth_file'])).allGroupSelected, false);
  assert.equal(
    resolveAccountGroupActionAvailability(
      [
        {
          id: 'acct_runtime_only',
          accountKind: 'openai-compatible',
          credentialSource: 'api-key',
          provider: 'deepseek',
        },
      ],
      new Set(),
    ).canRefreshGroup,
    true,
  );
  assert.deepEqual(resolveAccountGroupActionAvailability([], new Set()), {
    hasAccounts: false,
    allGroupSelected: false,
    canRefreshGroup: false,
    canEnableGroup: false,
    canDisableGroup: false,
    canDeleteGroup: false,
  });
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
      id: 'acct_auth_file',
      accountKind: 'auth-file',
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
      id: 'acct_codex_key_legacy_named',
      accountKind: 'codex-api-key',
      credentialSource: 'api-key',
      provider: 'codex',
      disabled: false,
    },
    {
      id: 'acct_deepseek',
      accountKind: 'openai-compatible',
      credentialSource: 'api-key',
      provider: 'deepseek',
      disabled: true,
    },
    {
      id: 'acct_codex_key',
      accountKind: 'codex-api-key',
      credentialSource: 'api-key',
      provider: 'codex',
      disabled: false,
    },
  ];

  const disableResult = resolveBulkSetDisabledTargets(selectedAccounts, true);
  assert.deepEqual(disableResult.targets.map((account) => account.id), ['acct_auth_file', 'acct_codex_key_legacy_named', 'acct_codex_key']);
  assert.deepEqual(disableResult.skipped.map((account) => account.id), ['auth-file:missing-name', 'acct_deepseek']);

  const enableResult = resolveBulkSetDisabledTargets(selectedAccounts, false);
  assert.deepEqual(enableResult.targets.map((account) => account.id), ['acct_deepseek']);
  assert.deepEqual(enableResult.skipped.map((account) => account.id), [
    'acct_auth_file',
    'auth-file:missing-name',
    'acct_codex_key_legacy_named',
    'acct_codex_key',
  ]);
});

test('resolveBulkDeleteTargets only includes unified account ids', () => {
  const selectedAccounts = [
    {
      id: 'acct_12345678-1234-4234-9234-123456789abc',
      accountKind: 'auth-file',
      credentialSource: 'auth-file',
      provider: 'codex',
    },
    {
      id: 'auth-file:legacy.json',
      accountKind: 'auth-file',
      credentialSource: 'auth-file',
      provider: 'codex',
    },
    {
      id: 'codex-api-key:legacy',
      accountKind: 'codex-api-key',
      credentialSource: 'api-key',
      provider: 'codex',
    },
    {
      id: 'acct_abcdefab-1234-4234-9234-abcdefabcdef',
      accountKind: 'openai-compatible',
      credentialSource: 'api-key',
      provider: 'deepseek',
    },
  ];

  const result = resolveBulkDeleteTargets(selectedAccounts);

  assert.deepEqual(result.targets.map((account) => account.id), [
    'acct_12345678-1234-4234-9234-123456789abc',
    'acct_abcdefab-1234-4234-9234-abcdefabcdef',
  ]);
  assert.deepEqual(result.skipped.map((account) => account.id), [
    'auth-file:legacy.json',
    'codex-api-key:legacy',
  ]);
});
