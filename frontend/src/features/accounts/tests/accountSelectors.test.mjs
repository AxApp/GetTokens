import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountsView,
  filterAccounts,
  groupAccountsByPlan,
} from '../model/accountSelectors.ts';

const t = (key) =>
  ({
    accounts: {
      plan_group_api_key: 'API KEY',
      plan_group_none: 'NONE',
    },
  })[key.split('.')[0]]?.[key.split('.')[1]] ?? key;

test('filterAccounts applies source filter and text query across key fields', () => {
  const accounts = [
    {
      id: 'auth-file:alpha',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Alpha',
      status: 'ACTIVE',
      email: 'alpha@example.com',
      planType: 'plus',
      baseUrl: '',
      prefix: '',
    },
    {
      id: 'api-key:beta',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Beta Key',
      status: 'ACTIVE',
      keyFingerprint: 'fp_1234',
      baseUrl: 'https://api.example.com/v1',
      prefix: 'relay',
    },
  ];

  assert.deepEqual(
    filterAccounts(accounts, { searchTerm: 'relay', sourceFilter: 'api-key' }).map((item) => item.id),
    ['api-key:beta']
  );
});

test('groupAccountsByPlan keeps api keys in API KEY bucket and sorts plan groups by rank', () => {
  const accounts = [
    {
      id: 'auth-file:free',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Free User',
      status: 'ACTIVE',
      planType: 'free',
      quotaKey: 'free.json',
    },
    {
      id: 'api-key:one',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Key One',
      status: 'ACTIVE',
    },
    {
      id: 'auth-file:pro',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Pro User',
      status: 'ACTIVE',
      planType: 'pro',
      quotaKey: 'pro.json',
    },
  ];

  const groups = groupAccountsByPlan(accounts, {}, t);

  assert.deepEqual(
    groups.map((group) => group.label),
    ['PRO', 'FREE', 'API KEY']
  );
});

test('buildAccountsView sorts, filters, groups, and resolves selection state together', () => {
  const accounts = [
    {
      id: 'api-key:beta',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Beta',
      status: 'ACTIVE',
    },
    {
      id: 'auth-file:alpha',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Alpha',
      status: 'ACTIVE',
      planType: 'pro',
      quotaKey: 'alpha.json',
    },
  ];

  const view = buildAccountsView({
    authFileRecords: [accounts[1]],
    apiKeyRecords: [accounts[0]],
    codexQuotaByName: {},
    searchTerm: 'a',
    sourceFilter: 'all',
    selectedAccountIDs: ['auth-file:alpha'],
    t,
  });

  assert.deepEqual(view.accounts.map((item) => item.id), ['auth-file:alpha', 'api-key:beta']);
  assert.deepEqual(view.filteredAccounts.map((item) => item.id), ['auth-file:alpha', 'api-key:beta']);
  assert.equal(view.selectedAccounts.length, 1);
  assert.equal(view.allFilteredSelected, false);
  assert.deepEqual(view.groupedAccounts.map((group) => group.label), ['PRO', 'API KEY']);
});
