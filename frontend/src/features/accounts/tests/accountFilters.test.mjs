import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNTS_FILTERS_STORAGE_KEY,
  applyAccountsFilterState,
  buildAccountsRiskFilterState,
  defaultAccountsFilterState,
  normalizeAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
  resolveAccountsFilterStateFromHash,
  resolveAccountsEmptyState,
  summarizeAccountsFilterState,
} from '../model/accountFilters.ts';
import { filterAccounts } from '../model/accountSelectors.ts';

const t = (key) => key;

test('readStoredAccountsFilterState restores a valid grouped filter state', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNTS_FILTERS_STORAGE_KEY);
      return JSON.stringify({
        source: { authFile: true, apiKey: false },
        resource: { hasLongestQuota: false, hasBalance: true },
        status: { error: true, disabled: false, requestable: false },
        plan: { free: true, plus: false, team: true },
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    source: { authFile: true, apiKey: false },
    resource: { hasLongestQuota: false, hasBalance: true },
    status: { error: true, disabled: false, requestable: false },
    plan: { free: true, plus: false, team: true },
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
      plan: {},
    },
  );
});

test('resolveAccountsFilterStateFromHash maps accounts risk filter to diagnostic statuses only', () => {
  assert.deepEqual(
    resolveAccountsFilterStateFromHash('#frame=accounts&workspace=all&filter=risk', {
      ...defaultAccountsFilterState,
      source: { authFile: false, apiKey: true },
      resource: { hasLongestQuota: false, hasBalance: true },
      status: { error: false, disabled: false, requestable: true },
      plan: { plus: false, team: true },
    }),
    {
      source: { authFile: true, apiKey: true },
      resource: { hasLongestQuota: true, hasBalance: true },
      status: { error: true, disabled: true, requestable: false },
      plan: {},
    },
  );
});

test('resolveAccountsFilterStateFromHash falls back to stored filters outside accounts risk routes', () => {
  const stored = {
    ...defaultAccountsFilterState,
    source: { authFile: false, apiKey: true },
    resource: { hasLongestQuota: false, hasBalance: true },
    status: { error: false, disabled: false, requestable: true },
    plan: { plus: false },
  };

  assert.deepEqual(resolveAccountsFilterStateFromHash('#frame=accounts', stored), stored);
  assert.deepEqual(resolveAccountsFilterStateFromHash('#frame=accounts&filter=unknown', stored), stored);
  assert.deepEqual(resolveAccountsFilterStateFromHash('#frame=codex&filter=risk', stored), stored);
});

test('applyAccountsFilterState deep merges nested patch objects', () => {
  assert.deepEqual(
    applyAccountsFilterState(
      {
        ...defaultAccountsFilterState,
        source: { authFile: true, apiKey: false },
        resource: { hasLongestQuota: true, hasBalance: false },
        status: { error: true, disabled: false, requestable: true },
        plan: { free: true, plus: false, team: true },
      },
      {
        source: { apiKey: true },
        resource: { hasBalance: true },
        status: { error: false },
        plan: { plus: true, team: false },
      },
    ),
    {
      source: { authFile: true, apiKey: true },
      resource: { hasLongestQuota: true, hasBalance: true },
      status: { error: false, disabled: false, requestable: true },
      plan: { free: true, plus: true, team: false },
    },
  );
});

test('buildAccountsRiskFilterState keeps account dimensions broad and selects disabled or error accounts', () => {
  const riskFilters = buildAccountsRiskFilterState(defaultAccountsFilterState);

  assert.deepEqual(riskFilters, {
    ...defaultAccountsFilterState,
    status: { error: true, disabled: true, requestable: false },
  });

  const accounts = [
    { id: 'ok', displayName: 'OK', provider: 'codex', credentialSource: 'api-key', status: 'ACTIVE' },
    { id: 'disabled', displayName: 'Disabled', provider: 'codex', credentialSource: 'api-key', status: 'ACTIVE', disabled: true },
    { id: 'error', displayName: 'Error', provider: 'codex', credentialSource: 'auth-file', status: 'ERROR' },
  ];

  assert.deepEqual(
    filterAccounts(accounts, {
      searchTerm: '',
      filters: riskFilters,
      codexQuotaByName: {},
    }).map((account) => account.id),
    ['disabled', 'error'],
  );
});

test('summarizeAccountsFilterState keeps source, resource, status, and plan parts in a stable order', () => {
  assert.deepEqual(
    summarizeAccountsFilterState((key) => key, {
      source: { authFile: false, apiKey: true },
      resource: { hasLongestQuota: false, hasBalance: true },
      status: { error: true, disabled: true, requestable: false },
      plan: { plus: false },
    }, ['pro', 'team', 'plus', 'free']).map((part) => [part.kind, part.label]),
    [
      ['source', 'accounts.source_api_key'],
      ['resource', 'accounts.filter_balance_match'],
      ['status', 'accounts.filter_error_match'],
      ['status', 'accounts.filter_disabled_match'],
      ['plan', 'Pro'],
      ['plan', 'Team'],
      ['plan', 'Free'],
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
    plan: { plus: false, team: true },
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        source: { authFile: false, apiKey: true },
        resource: { hasLongestQuota: true, hasBalance: false },
        status: { error: true, disabled: false, requestable: true },
        plan: { plus: false, team: true },
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
  assertBefore('planOptions.map', 'formatAccountPlanLabel(planType)');
  assert.equal(source.includes('requiresRequestable'), false);
  assert.equal(source.includes('requiresDisabled'), false);
  assert.equal(source.includes('requiresError'), false);
  assert.equal(source.includes('hasLongestQuota'), true);
  assert.equal(source.includes('accounts.filter_group_plan'), true);
  assert.equal(source.includes('uppercase={false}'), true);
  assert.equal(source.includes('accounts.filter_all'), true);
  assert.equal(source.includes("const DEFAULT_AVAILABLE_PLAN_TYPES: readonly AccountPlanType[] = []"), true);
  assert.equal(source.includes('accounts.group_mode_label'), true);
  assert.equal(source.includes('accounts.group_mode_plan'), true);
  assert.equal(source.includes('accounts.group_mode_source'), true);
  assert.equal(source.includes('accounts.group_mode_status'), true);
  assert.equal(source.includes('accounts.sort_mode_label'), true);
  assert.equal(source.includes('accounts.sort_mode_priority'), true);
  assert.equal(source.includes('accounts.sort_mode_quota'), true);
  assert.equal(source.includes('disabled={planAvailabilityResolved'), false);
  assert.equal(source.includes('className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm-plus)]"'), true);
  assert.equal(source.includes('text-[length:var(--font-size-ui-sm-plus)] font-black uppercase leading-none tracking-[0.12em]'), true);
});

test('AccountsToolbar filter menu keeps options in compact list mode', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');
  const menuPanelClass = 'mt-2 flex min-w-[360px] flex-col gap-3.5';
  const optionClass = source.slice(source.indexOf('function FilterCheckOption'), source.indexOf('function buildToolbarFilterLabel'));

  assert.equal(source.includes(menuPanelClass), true);
  assert.equal(optionClass.includes('min-h-9'), true);
  assert.equal(optionClass.includes('text-[length:var(--font-size-ui-md-compact)]'), true);
  assert.equal(optionClass.includes('border-2 border-[var(--border-color)]'), false);
});

test('AccountsToolbar design-system default story starts with all filters selected', async () => {
  const source = await readFile(new URL('../components/AccountsToolbarComponents.stories.tsx', import.meta.url), 'utf8');

  assert.equal(source.includes('initialFilters = defaultAccountsFilterState'), true);
  assert.equal(source.includes('initialFilters = emptyFilters'), false);
});

test('AccountsHeader splits account list refresh from runtime refresh', async () => {
  const headerSource = await readFile(new URL('../components/AccountsHeader.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(headerSource, /onRefreshAccounts: \(\) => void/);
  assert.match(headerSource, /onRefreshRuntime: \(\) => void/);
  assert.match(headerSource, /title=\{t\('accounts\.refresh_accounts'\)\}/);
  assert.match(headerSource, /title=\{t\('accounts\.refresh_runtime_hint'\)\}/);
  assert.match(headerSource, /aria-label=\{t\('accounts\.refresh_runtime'\)\}/);
  assert.match(featureSource, /onRefreshAccounts=\{\(\) => void loadAccounts\(\{ refreshSupplementalData: false \}\)\}/);
  assert.match(featureSource, /onRefreshRuntime=\{\(\) => void refreshAccountsRuntime\(\)\}/);
});

test('resolveAccountsEmptyState distinguishes no accounts from filtered empty results', () => {
  assert.deepEqual(
    resolveAccountsEmptyState(t, {
      accountCount: 0,
      filteredAccountCount: 0,
      searchTerm: '',
      filters: defaultAccountsFilterState,
      availablePlanTypes: [],
    }),
    {
      kind: 'empty',
      title: 'accounts.empty',
      body: 'accounts.empty_hint',
      showClearSearch: false,
      showResetFilters: false,
    },
  );

  assert.deepEqual(
    resolveAccountsEmptyState(t, {
      accountCount: 4,
      filteredAccountCount: 0,
      searchTerm: 'missing-account',
      filters: applyAccountsFilterState(defaultAccountsFilterState, {
        source: { apiKey: false },
      }),
      availablePlanTypes: [],
    }),
    {
      kind: 'filtered',
      title: 'accounts.filter_empty_title',
      body: 'accounts.filter_empty_hint',
      showClearSearch: true,
      showResetFilters: true,
    },
  );

  assert.equal(
    resolveAccountsEmptyState(t, {
      accountCount: 4,
      filteredAccountCount: 2,
      searchTerm: '',
      filters: defaultAccountsFilterState,
      availablePlanTypes: [],
    }),
    null,
  );
});
