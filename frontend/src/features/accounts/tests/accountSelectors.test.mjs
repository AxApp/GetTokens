import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountsView,
  filterAccounts,
  groupAccountsByVendor,
} from '../model/accountSelectors.ts';
import {
  beginQuotaRefreshState,
  buildQuotaDisplay,
  failQuotaRefreshState,
  resolveAccountCardValueSection,
} from '../model/accountQuota.ts';
import { defaultAccountsFilterState } from '../model/accountFilters.ts';

const t = (key) => key;

const quotaAccount = {
  id: 'auth-file:quota',
  provider: 'codex',
  credentialSource: 'auth-file',
  displayName: 'Quota Account',
  status: 'ACTIVE',
  quotaKey: 'quota',
};

const quotaState = {
  status: 'success',
  quota: {
    planType: 'plus',
    windows: [
      { id: 'five-hour', label: '5H', remainingPercent: 72, resetLabel: '05/20 18:00', resetAtUnix: 1 },
      { id: 'weekly', label: '7D', remainingPercent: 31, resetLabel: '05/27 18:00', resetAtUnix: 2 },
    ],
  },
};

test('quota refresh keeps existing windows visible while marking internal refresh state', () => {
  const refreshingState = beginQuotaRefreshState(quotaState);
  const quotaDisplay = buildQuotaDisplay(quotaAccount, refreshingState);

  assert.equal(refreshingState.status, 'success');
  assert.equal(refreshingState.refreshing, true);
  assert.equal(quotaDisplay.status, 'success');
  assert.equal(quotaDisplay.refreshing, true);
  assert.deepEqual(
    quotaDisplay.windows.map((window) => [window.id, window.remainingPercent]),
    [
      ['five-hour', 72],
      ['weekly', 31],
    ],
  );
});

test('quota refresh falls back to full loading only before the first quota payload exists', () => {
  const refreshingState = beginQuotaRefreshState(undefined);
  const quotaDisplay = buildQuotaDisplay(quotaAccount, refreshingState);

  assert.deepEqual(refreshingState, { status: 'loading' });
  assert.deepEqual(quotaDisplay, {
    status: 'loading',
    planType: '',
    windows: [],
  });
});

test('failed quota refresh preserves the last successful quota payload', () => {
  const refreshingState = beginQuotaRefreshState(quotaState);
  const failedState = failQuotaRefreshState(refreshingState);
  const quotaDisplay = buildQuotaDisplay(quotaAccount, failedState);

  assert.equal(failedState.status, 'success');
  assert.equal(failedState.refreshing, false);
  assert.equal(quotaDisplay.status, 'success');
  assert.deepEqual(
    quotaDisplay.windows.map((window) => [window.id, window.remainingPercent]),
    [
      ['five-hour', 72],
      ['weekly', 31],
    ],
  );
});

test('compact account cards prefer quota over billing and fall back to balance when quota has no windows', () => {
  const quotaDisplay = buildQuotaDisplay(quotaAccount, quotaState);
  const billing = {
    isAvailable: true,
    balances: [{ currency: 'USD', totalBalance: '12.00', grantedBalance: '0', toppedUpBalance: '12.00' }],
  };

  assert.equal(resolveAccountCardValueSection(quotaDisplay, billing), 'quota');
  assert.equal(
    resolveAccountCardValueSection({ status: 'empty', planType: '', windows: [] }, billing),
    'billing',
  );
  assert.equal(
    resolveAccountCardValueSection({ status: 'unsupported', planType: '', windows: [] }, undefined),
    'placeholder',
  );
});

test('compact account cards ignore unavailable or empty billing payloads', () => {
  const emptyQuotaDisplay = { status: 'empty', planType: '', windows: [] };

  assert.equal(
    resolveAccountCardValueSection(emptyQuotaDisplay, {
      isAvailable: false,
      balances: [{ currency: 'USD', totalBalance: '1', grantedBalance: '0', toppedUpBalance: '1' }],
    }),
    'placeholder',
  );
  assert.equal(
    resolveAccountCardValueSection(emptyQuotaDisplay, { isAvailable: true, balances: [] }),
    'placeholder',
  );
});

test('filterAccounts applies text query across key fields', () => {
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
      },
      codexQuotaByName: {},
    }).map((item) => item.id),
    ['api-key:beta']
  );
});

test('filterAccounts can narrow accounts by credential source', () => {
  const accounts = [
    {
      id: 'auth-file:alpha',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Alpha',
      status: 'ACTIVE',
    },
    {
      id: 'api-key:beta',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Beta Key',
      status: 'CONFIGURED',
    },
  ];

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        source: 'api-key',
      },
      codexQuotaByName: {},
    }).map((item) => item.id),
    ['api-key:beta']
  );
});

test('filterAccounts can keep only requestable accounts', () => {
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
    },
  ];

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        requestableOnly: true,
      },
      codexQuotaByName: {},
    }).map((item) => item.id),
    ['auth-file:active']
  );
});

test('filterAccounts can keep only accounts with displayable balance', () => {
  const accounts = [
    {
      id: 'api-key:balance',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Balance Key',
      status: 'CONFIGURED',
      quotaKey: 'api-key:balance',
      billingCurl: 'curl https://api.example.com/billing',
      billingEnabled: true,
    },
    {
      id: 'api-key:no-balance',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'No Balance Key',
      status: 'CONFIGURED',
      quotaKey: 'api-key:no-balance',
    },
  ];

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        hasBalance: true,
      },
      codexQuotaByName: {
        'api-key:balance': {
          status: 'success',
          quota: {
            planType: 'paid',
            windows: [],
            billing: {
              isAvailable: true,
              balanceInfos: [
                { currency: 'USD', totalBalance: '12.00', grantedBalance: '0', toppedUpBalance: '12.00' },
              ],
            },
          },
        },
        'api-key:no-balance': {
          status: 'success',
          quota: {
            planType: 'paid',
            windows: [],
            billing: {
              isAvailable: false,
              balanceInfos: [],
            },
          },
        },
      },
    }).map((item) => item.id),
    ['api-key:balance']
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

test('filterAccounts includes codex api keys with configured positive longest quota', () => {
  const accounts = [
    {
      id: 'codex-api-key:ready',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'Codex key',
      status: 'ACTIVE',
      quotaKey: 'codex-api-key:ready',
      quotaCurl: 'curl https://codex.example.com/api/codex/usage',
      quotaEnabled: true,
    },
    {
      id: 'codex-api-key:missing',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'Missing quota',
      status: 'ACTIVE',
    },
  ];

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        hasLongestQuota: true,
      },
      codexQuotaByName: {
        'codex-api-key:ready': {
          status: 'success',
          quota: {
            planType: 'pro',
            windows: [
              { id: 'five-hour', label: '5H', remainingPercent: 12, resetLabel: 'later', resetAtUnix: 1 },
              { id: 'weekly', label: '7D', remainingPercent: 88, resetLabel: 'later', resetAtUnix: 1 },
            ],
          },
        },
      },
    }).map((item) => item.id),
    ['codex-api-key:ready']
  );
});

test('filterAccounts separates disabled accounts from unavailable error accounts', () => {
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
    ['auth-file:error', 'auth-file:unavailable']
  );
  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: {
        ...defaultAccountsFilterState,
        disabledOnly: true,
      },
      codexQuotaByName: {},
    }).map((item) => item.id),
    ['auth-file:disabled']
  );
});

test('groupAccountsByVendor groups by normalized provider', () => {
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

  const groups = groupAccountsByVendor(accounts);

  assert.deepEqual(
    groups.map((group) => group.label),
    ['CODEX', 'OPENAI']
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
  assert.deepEqual(view.groupedAccounts.map((group) => group.label), ['CODEX', 'OPENAI']);
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
