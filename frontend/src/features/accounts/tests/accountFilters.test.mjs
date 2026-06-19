import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNTS_FILTERS_STORAGE_KEY,
  applyAccountsFilterState,
  buildAccountsFilterPresetState,
  buildAccountsRiskFilterState,
  defaultAccountsFilterState,
  removeAccountsFilterSummaryPart,
  normalizeAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
  resolveAccountsFilterStateFromHash,
  resolveAccountsEmptyState,
  summarizeAccountsFilterState,
} from '../model/accountFilters.ts';
import { filterAccounts } from '../model/accountSelectors.ts';

const t = (key) => key;

test('readStoredAccountsFilterState restores the grouped filter state with request status codes', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNTS_FILTERS_STORAGE_KEY);
      return JSON.stringify({
        source: { authFile: true, apiKey: false },
        resource: { hasQuota: false, noQuota: true, hasBalance: true, noBalance: false, hasUsageToday: false, noUsageToday: true },
        status: { error: true, disabled: false, requestable: false, requestStatusCodes: { 401: true } },
        plan: { free: true, plus: false, team: true },
      });
    },
  };

  assert.deepEqual(readStoredAccountsFilterState(storage), {
    source: { authFile: true, apiKey: false },
    resource: { hasQuota: false, noQuota: true, hasBalance: true, noBalance: false, hasUsageToday: false, noUsageToday: true },
    status: { error: true, disabled: false, requestable: false, requestStatusCodes: { 401: true } },
    plan: { free: true, plus: false, team: true },
  });
});

test('normalizeAccountsFilterState migrates legacy flat quota and balance fields into independent facets', () => {
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
      resource: { hasQuota: false, noQuota: true, hasBalance: true, noBalance: false, hasUsageToday: true, noUsageToday: true },
      status: { error: false, disabled: true, requestable: true, requestStatusCodes: {} },
      plan: {},
    },
  );
});

test('normalizeAccountsFilterState migrates legacy combined resource filters into independent facets', () => {
  assert.deepEqual(
    normalizeAccountsFilterState({
      resource: {
        quotaAndBalance: false,
        noQuotaAndBalance: true,
        noQuotaNoBalance: false,
        hasUsageToday: false,
        noUsageToday: true,
      },
    }).resource,
    {
      hasQuota: false,
      noQuota: true,
      hasBalance: true,
      noBalance: false,
      hasUsageToday: false,
      noUsageToday: true,
    },
  );
});

test('resolveAccountsFilterStateFromHash maps accounts risk filter to diagnostic statuses only', () => {
  assert.deepEqual(
    resolveAccountsFilterStateFromHash('#frame=accounts&workspace=all&filter=risk', {
      ...defaultAccountsFilterState,
      source: { authFile: false, apiKey: true },
      resource: { hasQuota: false, noQuota: true, hasBalance: true, noBalance: false, hasUsageToday: false, noUsageToday: true },
      status: { error: false, disabled: false, requestable: true, requestStatusCodes: { 401: true } },
      plan: { plus: false, team: true },
    }),
    {
      source: { authFile: true, apiKey: true },
      resource: { hasQuota: true, noQuota: true, hasBalance: true, noBalance: true, hasUsageToday: true, noUsageToday: true },
      status: { error: true, disabled: true, requestable: false, requestStatusCodes: {} },
      plan: {},
    },
  );
});

test('resolveAccountsFilterStateFromHash falls back to stored filters outside accounts risk routes', () => {
  const stored = {
    ...defaultAccountsFilterState,
    source: { authFile: false, apiKey: true },
    resource: { hasQuota: false, noQuota: true, hasBalance: true, noBalance: false, hasUsageToday: false, noUsageToday: true },
    status: { error: false, disabled: false, requestable: true, requestStatusCodes: { 401: true } },
    plan: { plus: false },
  };

  assert.deepEqual(resolveAccountsFilterStateFromHash('#frame=accounts', stored), stored);
  assert.deepEqual(resolveAccountsFilterStateFromHash('#frame=accounts&filter=unknown', stored), stored);
  assert.deepEqual(resolveAccountsFilterStateFromHash('#frame=codex&filter=risk', stored), stored);
});

test('applyAccountsFilterState merges filter facets and replaces request status code selection', () => {
  assert.deepEqual(
    applyAccountsFilterState(
      {
        ...defaultAccountsFilterState,
        source: { authFile: true, apiKey: false },
        resource: { hasQuota: true, noQuota: false, hasBalance: true, noBalance: false, hasUsageToday: true, noUsageToday: false },
        status: { error: true, disabled: false, requestable: true, requestStatusCodes: { 401: true } },
        plan: { free: true, plus: false, team: true },
      },
      {
        source: { apiKey: true },
        resource: { noQuota: true, noBalance: true, noUsageToday: true },
        status: { error: false, requestStatusCodes: { 402: true } },
        plan: { plus: true, team: false },
      },
    ),
    {
      source: { authFile: true, apiKey: true },
      resource: { hasQuota: true, noQuota: true, hasBalance: true, noBalance: true, hasUsageToday: true, noUsageToday: true },
      status: { error: false, disabled: false, requestable: true, requestStatusCodes: { 402: true } },
      plan: { free: true, plus: true, team: false },
    },
  );
});

test('applyAccountsFilterState replaces request status code selection so dynamic codes can be cleared', () => {
  assert.deepEqual(
    applyAccountsFilterState(
      {
        ...defaultAccountsFilterState,
        status: { error: true, disabled: true, requestable: true, requestStatusCodes: { 401: true, 402: true } },
      },
      {
        status: {
          requestStatusCodes: { 402: true },
        },
      },
    ).status.requestStatusCodes,
    { 402: true },
  );

  assert.deepEqual(
    applyAccountsFilterState(
      {
        ...defaultAccountsFilterState,
        status: { error: true, disabled: true, requestable: true, requestStatusCodes: { 401: true } },
      },
      {
        status: {
          requestStatusCodes: {},
        },
      },
    ).status.requestStatusCodes,
    {},
  );
});

test('buildAccountsRiskFilterState keeps account dimensions broad and selects disabled or error accounts', () => {
  const riskFilters = buildAccountsRiskFilterState(defaultAccountsFilterState);

  assert.deepEqual(riskFilters, {
    ...defaultAccountsFilterState,
    status: { error: true, disabled: true, requestable: false, requestStatusCodes: {} },
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

test('summarizeAccountsFilterState keeps source, resource, status, request code, and plan parts in a stable order', () => {
  assert.deepEqual(
    summarizeAccountsFilterState(
      (key) => key,
      {
        source: { authFile: false, apiKey: true },
        resource: { hasQuota: true, noQuota: false, hasBalance: false, noBalance: true, hasUsageToday: false, noUsageToday: true },
        status: { error: true, disabled: true, requestable: false, requestStatusCodes: { 401: true } },
        plan: { plus: false },
      },
      ['pro', 'team', 'plus', 'free'],
      ['401', '402'],
    ).map((part) => [part.kind, part.label]),
    [
      ['source', 'accounts.source_api_key'],
      ['resource', 'accounts.filter_has_quota_match'],
      ['resource', 'accounts.filter_no_balance_match'],
      ['resource', 'accounts.filter_no_usage_today_match'],
      ['status', 'accounts.filter_error_match'],
      ['status', 'accounts.filter_disabled_match'],
      ['status', 'HTTP 401'],
      ['plan', 'Pro'],
      ['plan', 'Team'],
      ['plan', 'Free'],
    ],
  );
});

test('summarizeAccountsFilterState omits fully selected groups', () => {
  assert.deepEqual(summarizeAccountsFilterState((key) => key, defaultAccountsFilterState), []);
});

test('buildAccountsFilterPresetState maps common toolbar presets to concrete filters', () => {
  assert.deepEqual(
    buildAccountsFilterPresetState('available', defaultAccountsFilterState, ['401', '402']),
    {
      ...defaultAccountsFilterState,
      status: { error: false, disabled: false, requestable: true, requestStatusCodes: {} },
    },
  );

  assert.deepEqual(
    buildAccountsFilterPresetState('attention', defaultAccountsFilterState, ['401', '402']),
    {
      ...defaultAccountsFilterState,
      status: { error: true, disabled: true, requestable: false, requestStatusCodes: { 401: true, 402: true } },
    },
  );

  assert.deepEqual(
    buildAccountsFilterPresetState('http-errors', defaultAccountsFilterState, ['401', '402']),
    {
      ...defaultAccountsFilterState,
      status: { error: true, disabled: false, requestable: false, requestStatusCodes: { 401: true, 402: true } },
    },
  );

  assert.deepEqual(
    buildAccountsFilterPresetState('with-quota', defaultAccountsFilterState, []),
    {
      ...defaultAccountsFilterState,
      resource: { ...defaultAccountsFilterState.resource, hasQuota: true, noQuota: false },
    },
  );

  assert.deepEqual(
    buildAccountsFilterPresetState('api-key', defaultAccountsFilterState, []),
    {
      ...defaultAccountsFilterState,
      source: { authFile: false, apiKey: true },
    },
  );
});

test('removeAccountsFilterSummaryPart clears a single active filter chip back to broad matching', () => {
  const filtered = {
    source: { authFile: false, apiKey: true },
    resource: { hasQuota: true, noQuota: false, hasBalance: false, noBalance: true, hasUsageToday: false, noUsageToday: true },
    status: { error: true, disabled: false, requestable: false, requestStatusCodes: { 401: true, 402: true } },
    plan: { plus: false, team: true },
  };

  assert.deepEqual(
    removeAccountsFilterSummaryPart(filtered, { kind: 'status', label: 'HTTP 401' }, ['pro', 'team', 'plus'], ['401', '402']).status,
    { error: true, disabled: false, requestable: false, requestStatusCodes: { 402: true } },
  );

  assert.deepEqual(
    removeAccountsFilterSummaryPart(filtered, { kind: 'resource', label: 'accounts.filter_has_quota_match' }, ['pro', 'team', 'plus'], ['401', '402']).resource,
    { hasQuota: true, noQuota: true, hasBalance: false, noBalance: true, hasUsageToday: false, noUsageToday: true },
  );

  assert.deepEqual(
    removeAccountsFilterSummaryPart(filtered, { kind: 'source', label: 'accounts.source_api_key' }, ['pro', 'team', 'plus'], ['401', '402']).source,
    { authFile: true, apiKey: true },
  );

  assert.deepEqual(
    removeAccountsFilterSummaryPart(filtered, { kind: 'plan', label: 'Team' }, ['pro', 'team', 'plus'], ['401', '402']).plan,
    { plus: false, team: false },
  );
});

test('readStoredAccountsFilterState falls back for invalid or missing storage payloads', () => {
  assert.deepEqual(readStoredAccountsFilterState(null), defaultAccountsFilterState);
  assert.deepEqual(
    readStoredAccountsFilterState({
      getItem() {
        return '{"resource":{"hasQuota":"yes"}}';
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
    resource: { hasQuota: true, noQuota: false, hasBalance: true, noBalance: false, hasUsageToday: true, noUsageToday: false },
    status: { error: true, disabled: false, requestable: true, requestStatusCodes: { 401: true } },
    plan: { plus: false, team: true },
  });

  assert.deepEqual(writes, [
    [
      ACCOUNTS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        source: { authFile: false, apiKey: true },
        resource: { hasQuota: true, noQuota: false, hasBalance: true, noBalance: false, hasUsageToday: true, noUsageToday: false },
        status: { error: true, disabled: false, requestable: true, requestStatusCodes: { 401: true } },
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

  assertBefore('accounts.filter_group_plan_source', 'accounts.filter_group_status');
  assertBefore('accounts.filter_group_status', 'accounts.filter_group_other');
  assertBefore('accounts.filter_group_source', 'planOptions.map');
  assertBefore('accounts.filter_group_presets', 'accounts.filter_group_plan_source');
  assertBefore('accounts.filter_active_conditions', 'accounts.filter_group_plan_source');
  assert.equal(source.includes('requiresRequestable'), false);
  assert.equal(source.includes('requiresDisabled'), false);
  assert.equal(source.includes('requiresError'), false);
  assert.equal(source.includes('hasLongestQuota'), false);
  assert.equal(source.includes('quotaAndBalance'), false);
  assert.equal(source.includes('accounts.filter_group_plan'), true);
  assert.equal(source.includes('accounts.filter_group_quota'), true);
  assert.equal(source.includes('accounts.filter_group_balance'), true);
  assert.equal(source.includes('accounts.filter_group_today_usage'), true);
  assert.equal(source.includes('accounts.filter_group_request_status'), true);
  assert.equal(source.includes('accounts.filter_preset_available'), true);
  assert.equal(source.includes('accounts.filter_preset_attention'), true);
  assert.equal(source.includes('accounts.filter_preset_http_errors'), true);
  assert.equal(source.includes('accounts.filter_remove_condition'), true);
  assert.equal(source.includes('accounts.filter_group_resource'), false);
  assert.equal(source.includes('accounts.filter_has_quota_match'), true);
  assert.equal(source.includes('accounts.filter_no_quota_match'), true);
  assert.equal(source.includes('accounts.filter_has_balance_match'), true);
  assert.equal(source.includes('accounts.filter_no_balance_match'), true);
  assert.equal(source.includes('accounts.filter_usage_today_match'), true);
  assert.equal(source.includes('accounts.filter_no_usage_today_match'), true);
  assert.equal(source.includes('accounts.filter_quota_and_balance_match'), false);
  assert.equal(source.includes('accounts.filter_no_quota_and_balance_match'), false);
  assert.equal(source.includes('accounts.filter_no_quota_no_balance_match'), false);
  assert.equal(source.includes('uppercase={false}'), true);
  assert.equal(source.includes('accounts.filter_option_all'), true);
  assert.equal(source.includes("const DEFAULT_AVAILABLE_PLAN_TYPES: readonly AccountPlanType[] = []"), true);
  assert.equal(source.includes('accounts.group_mode_label'), true);
  assert.equal(source.includes('accounts.group_mode_plan'), true);
  assert.equal(source.includes('accounts.group_mode_source'), true);
  assert.equal(source.includes('accounts.group_mode_status'), true);
  assert.equal(source.includes('accounts.sort_mode_label'), true);
  assert.equal(source.includes('accounts.sort_mode_priority'), true);
  assert.equal(source.includes('accounts.sort_mode_quota'), true);
  assert.equal(source.includes('disabled={planAvailabilityResolved'), false);
  assert.equal(source.includes('data-accounts-toolbar-controls="true"'), true);
  assert.equal(source.includes("backgroundColor: 'color-mix(in srgb, var(--gt-surface-muted) 54%, transparent)'"), true);
  assert.equal(source.includes('SlidersHorizontal'), true);
  assert.equal(source.includes('className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2.5 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)]"'), true);
  assert.equal(source.includes('className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm-plus)]"'), false);
  assert.equal(source.includes('text-[length:var(--font-size-ui-sm-plus)] font-black uppercase leading-none tracking-[0.12em]'), false);
  assert.equal(source.includes('text-[length:var(--font-size-ui-xs)] font-medium text-[var(--gt-ink-secondary)]'), true);
});

test('AccountsToolbar filter menu keeps options in compact list mode', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');
  const menuPanelClass = 'mt-2 flex min-w-[460px]';
  const pillClass = source.slice(source.indexOf('function FilterPillOption'), source.indexOf('function FilterTernaryOptionRow'));
  const ternaryClass = source.slice(source.indexOf('function FilterTernaryOptionRow'), source.indexOf('function buildToolbarFilterLabel'));

  assert.equal(source.includes(menuPanelClass), true);
  assert.equal(pillClass.includes('h-8 min-w-16'), true);
  assert.equal(pillClass.includes('aria-pressed={active}'), true);
  assert.equal(ternaryClass.includes("mode: 'all' | 'positive' | 'negative'"), true);
  assert.equal(source.includes('function FilterTernaryOptionRow'), true);
  assert.equal(source.includes('function FilterBinaryOptionRow'), false);
  assert.equal(source.includes('removeAccountsFilterSummaryPart'), true);
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
  assert.match(headerSource, /runtimeRefreshing\?: boolean/);
  assert.match(headerSource, /title=\{t\('accounts\.refresh_accounts'\)\}/);
  assert.match(headerSource, /title=\{t\('accounts\.refresh_runtime_hint'\)\}/);
  assert.match(headerSource, /aria-label=\{t\('accounts\.refresh_runtime'\)\}/);
  assert.match(headerSource, /data-accounts-runtime-refreshing=\{runtimeRefreshing \? 'true' : undefined\}/);
  assert.match(featureSource, /runtimeRefreshing=\{runtimeRefreshing\}/);
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
