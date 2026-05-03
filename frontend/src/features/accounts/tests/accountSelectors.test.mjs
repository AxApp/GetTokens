import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountsView,
  filterAccounts,
  groupAccountsByPlan,
} from '../model/accountSelectors.ts';
import { defaultAccountsFilterState } from '../model/accountFilters.ts';

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
    filterAccounts(accounts, {
      searchTerm: 'relay',
      filters: {
        ...defaultAccountsFilterState,
        source: 'api-key',
      },
      codexQuotaByName: {},
    }).map((item) => item.id),
    ['api-key:beta']
  );
});

test('filterAccounts keeps only auth-file codex accounts with positive longest-window quota when enabled', () => {
  const accounts = [
    {
      id: 'auth-file:weekly-ok',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Weekly OK',
      status: 'ACTIVE',
      quotaKey: 'weekly-ok',
    },
    {
      id: 'auth-file:weekly-empty',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Weekly Empty',
      status: 'ACTIVE',
      quotaKey: 'weekly-empty',
    },
    {
      id: 'auth-file:single-ok',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Single OK',
      status: 'ACTIVE',
      quotaKey: 'single-ok',
    },
    {
      id: 'api-key:beta',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'Beta',
      status: 'ACTIVE',
    },
  ];

  const codexQuotaByName = {
    'weekly-ok': {
      status: 'success',
      quota: {
        planType: 'plus',
        windows: [
          { id: 'five-hour', label: '5H', remainingPercent: 80, resetLabel: '05/01 10:00', resetAtUnix: 1 },
          { id: 'weekly', label: '7D', remainingPercent: 25, resetLabel: '05/07 10:00', resetAtUnix: 2 },
        ],
      },
    },
    'weekly-empty': {
      status: 'success',
      quota: {
        planType: 'plus',
        windows: [
          { id: 'five-hour', label: '5H', remainingPercent: 80, resetLabel: '05/01 10:00', resetAtUnix: 1 },
          { id: 'weekly', label: '7D', remainingPercent: 0, resetLabel: '05/07 10:00', resetAtUnix: 2 },
        ],
      },
    },
    'single-ok': {
      status: 'success',
      quota: {
        planType: 'free',
        windows: [{ id: 'five-hour', label: '5H', remainingPercent: 10, resetLabel: '05/01 10:00', resetAtUnix: 1 }],
      },
    },
  };

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        hasLongestQuota: true,
      },
      codexQuotaByName,
    }).map((item) => item.id),
    ['auth-file:weekly-ok', 'auth-file:single-ok']
  );
});

test('filterAccounts keeps only unavailable or unusable accounts when errorsOnly is enabled', () => {
  const accounts = [
    {
      id: 'auth-file:active',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Active',
      status: 'ACTIVE',
    },
    {
      id: 'auth-file:disabled',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Disabled',
      status: 'DISABLED',
      disabled: true,
    },
    {
      id: 'auth-file:error',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Error',
      status: 'ERROR',
      statusMessage: 'expired',
    },
    {
      id: 'auth-file:unavailable',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Unavailable',
      status: 'ACTIVE',
      rawAuthFile: {
        name: 'unavailable',
        unavailable: true,
      },
    },
  ];

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        errorsOnly: true,
      },
      codexQuotaByName: {},
    }).map((item) => item.id),
    ['auth-file:disabled', 'auth-file:error', 'auth-file:unavailable']
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
    filters: defaultAccountsFilterState,
    selectedAccountIDs: ['auth-file:alpha'],
    t,
  });

  assert.deepEqual(view.accounts.map((item) => item.id), ['auth-file:alpha', 'api-key:beta']);
  assert.deepEqual(view.filteredAccounts.map((item) => item.id), ['auth-file:alpha', 'api-key:beta']);
  assert.equal(view.selectedAccounts.length, 1);
  assert.equal(view.allFilteredSelected, false);
  assert.deepEqual(view.groupedAccounts.map((group) => group.label), ['PRO', 'API KEY']);
});

test('buildAccountsView sorts api keys by priority before display name', () => {
  const view = buildAccountsView({
    authFileRecords: [],
    apiKeyRecords: [
      {
        id: 'api-key:beta',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Alpha',
        status: 'ACTIVE',
        priority: 1,
      },
      {
        id: 'api-key:alpha',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Zulu',
        status: 'ACTIVE',
        priority: 9,
      },
      {
        id: 'api-key:gamma',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'Bravo',
        status: 'ACTIVE',
        priority: 1,
      },
    ],
    codexQuotaByName: {},
    searchTerm: '',
    filters: defaultAccountsFilterState,
    selectedAccountIDs: [],
    t,
  });

  assert.deepEqual(view.accounts.map((item) => item.id), ['api-key:alpha', 'api-key:beta', 'api-key:gamma']);
});
