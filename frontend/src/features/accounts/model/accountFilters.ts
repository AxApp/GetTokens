import type { CredentialSource } from '../../../types';
import type { AccountsFilterState } from './types';

export const ACCOUNTS_FILTERS_STORAGE_KEY = 'gettokens.accountsFilters';

export interface AccountsFilterSummaryPart {
  kind: 'source' | 'resource' | 'status' | 'plan';
  label: string;
}

export interface AccountsEmptyState {
  kind: 'empty' | 'filtered';
  title: string;
  body: string;
  showClearSearch: boolean;
  showResetFilters: boolean;
}

interface ResolveAccountsEmptyStateArgs {
  accountCount: number;
  filteredAccountCount: number;
  searchTerm: string;
  filters: AccountsFilterState;
  availablePlanTypes?: readonly string[];
  availableRequestStatusCodes?: readonly string[];
}

type AccountsFilterGroupSelection<T extends string> = Record<T, boolean>;

type AccountsFilterStatePatch = {
  source?: Partial<AccountsFilterState['source']>;
  resource?: Partial<AccountsFilterState['resource']>;
  status?: Partial<AccountsFilterState['status']>;
  plan?: Partial<AccountsFilterState['plan']>;
};

const SOURCE_KEYS = ['authFile', 'apiKey'] as const;
const RESOURCE_KEYS = ['hasQuota', 'noQuota', 'hasBalance', 'noBalance', 'hasUsageToday', 'noUsageToday'] as const;
const STATUS_KEYS = ['error', 'disabled', 'requestable'] as const;

export const defaultAccountsFilterState: AccountsFilterState = {
  source: {
    authFile: true,
    apiKey: true,
  },
  resource: {
    hasQuota: true,
    noQuota: true,
    hasBalance: true,
    noBalance: true,
    hasUsageToday: true,
    noUsageToday: true,
  },
  status: {
    error: true,
    disabled: true,
    requestable: true,
    requestStatusCodes: {},
  },
  plan: {},
};

export function normalizeAccountsFilterState(value: unknown): AccountsFilterState {
  if (!value || typeof value !== 'object') {
    return defaultAccountsFilterState;
  }

  const candidate = value as Partial<AccountsFilterState> & Record<string, unknown>;

  return {
    source: normalizeSourceSelection(candidate.source),
    resource: normalizeResourceSelection(candidate.resource ?? candidate),
    status: normalizeStatusSelection(candidate.status ?? candidate),
    plan: normalizePlanSelection(candidate.plan),
  };
}

export const resolveAccountsFilterState = normalizeAccountsFilterState;

export function applyAccountsFilterState(base: AccountsFilterState, patch: AccountsFilterStatePatch): AccountsFilterState {
  const patchStatusIncludesRequestCodes = Object.prototype.hasOwnProperty.call(patch.status || {}, 'requestStatusCodes');
  return normalizeAccountsFilterState({
    source: {
      ...base.source,
      ...patch.source,
    },
    resource: {
      ...base.resource,
      ...patch.resource,
    },
    status: {
      ...base.status,
      ...patch.status,
      requestStatusCodes: patchStatusIncludesRequestCodes ? patch.status?.requestStatusCodes || {} : base.status.requestStatusCodes,
    },
    plan: {
      ...base.plan,
      ...patch.plan,
    },
  });
}

export function buildAccountsRiskFilterState(base: AccountsFilterState = defaultAccountsFilterState): AccountsFilterState {
  return applyAccountsFilterState(base, {
    status: {
      error: true,
      disabled: true,
      requestable: false,
      requestStatusCodes: {},
    },
  });
}

export function resolveAccountsFilterStateFromHash(
  hash: string | null | undefined,
  fallback: AccountsFilterState = defaultAccountsFilterState,
): AccountsFilterState {
  const rawHash = String(hash || '');
  const normalized = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const params = new URLSearchParams(normalized);
  if (params.get('frame') === 'accounts' && params.get('filter') === 'risk') {
    return buildAccountsRiskFilterState(defaultAccountsFilterState);
  }
  return fallback;
}

export function summarizeAccountsFilterState(
  t: (key: string) => string,
  state: AccountsFilterState,
  availablePlanTypes: readonly string[] = Object.keys(state.plan),
  availableRequestStatusCodes: readonly string[] = Object.keys(state.status.requestStatusCodes || {}),
): AccountsFilterSummaryPart[] {
  const parts: AccountsFilterSummaryPart[] = [];

  if (!isSelectionComplete(state.source, SOURCE_KEYS)) {
    if (state.source.authFile) {
      parts.push({ kind: 'source', label: t('accounts.source_auth_file') });
    }
    if (state.source.apiKey) {
      parts.push({ kind: 'source', label: t('accounts.source_api_key') });
    }
  }

  appendBinaryFacetSummary(parts, [state.resource.hasQuota, state.resource.noQuota], [
    t('accounts.filter_has_quota_match'),
    t('accounts.filter_no_quota_match'),
  ]);
  appendBinaryFacetSummary(parts, [state.resource.hasBalance, state.resource.noBalance], [
    t('accounts.filter_has_balance_match'),
    t('accounts.filter_no_balance_match'),
  ]);
  appendBinaryFacetSummary(parts, [state.resource.hasUsageToday, state.resource.noUsageToday], [
    t('accounts.filter_usage_today_match'),
    t('accounts.filter_no_usage_today_match'),
  ]);

  if (!isSelectionComplete(state.status, STATUS_KEYS)) {
    if (state.status.error) {
      parts.push({ kind: 'status', label: t('accounts.filter_error_match') });
    }
    if (state.status.disabled) {
      parts.push({ kind: 'status', label: t('accounts.filter_disabled_match') });
    }
    if (state.status.requestable) {
      parts.push({ kind: 'status', label: t('accounts.filter_requestable_match') });
    }
  }

  const requestStatusCodes = state.status.requestStatusCodes || {};
  for (const statusCode of normalizeStatusCodeList(availableRequestStatusCodes)) {
    if (requestStatusCodes[statusCode] === true) {
      parts.push({ kind: 'status', label: `HTTP ${statusCode}` });
    }
  }

  if (!isPlanSelectionComplete(state.plan, availablePlanTypes)) {
    for (const planType of availablePlanTypes) {
      if (state.plan[planType] !== false) {
        parts.push({ kind: 'plan', label: formatAccountPlanLabel(planType) });
      }
    }
  }

  return parts;
}

export function resolveAccountsEmptyState(
  t: (key: string) => string,
  {
    accountCount,
    filteredAccountCount,
    searchTerm,
    filters,
    availablePlanTypes = Object.keys(filters.plan),
    availableRequestStatusCodes = Object.keys(filters.status.requestStatusCodes || {}),
  }: ResolveAccountsEmptyStateArgs,
): AccountsEmptyState | null {
  if (filteredAccountCount > 0) {
    return null;
  }

  if (accountCount <= 0) {
    return {
      kind: 'empty',
      title: t('accounts.empty'),
      body: t('accounts.empty_hint'),
      showClearSearch: false,
      showResetFilters: false,
    };
  }

  return {
    kind: 'filtered',
    title: t('accounts.filter_empty_title'),
    body: t('accounts.filter_empty_hint'),
    showClearSearch: searchTerm.trim().length > 0,
    showResetFilters: summarizeAccountsFilterState(t, filters, availablePlanTypes, availableRequestStatusCodes).length > 0,
  };
}

export function readStoredAccountsFilterState(storage: Pick<Storage, 'getItem'> | null | undefined): AccountsFilterState {
  try {
    const raw = storage?.getItem(ACCOUNTS_FILTERS_STORAGE_KEY);
    if (!raw) {
      return defaultAccountsFilterState;
    }
    return normalizeAccountsFilterState(JSON.parse(raw));
  } catch {
    return defaultAccountsFilterState;
  }
}

export function persistAccountsFilterState(storage: Pick<Storage, 'setItem'> | null | undefined, state: AccountsFilterState): void {
  storage?.setItem(ACCOUNTS_FILTERS_STORAGE_KEY, JSON.stringify(state));
}

function normalizeSourceSelection(value: unknown): AccountsFilterState['source'] {
  if (isSelectionObject(value, SOURCE_KEYS)) {
    return normalizeSelectionObject(value, SOURCE_KEYS, defaultAccountsFilterState.source);
  }

  if (typeof value === 'string') {
    const source = resolveLegacySourceSelection(value);
    if (source === 'auth-file') {
      return { authFile: true, apiKey: false };
    }
    if (source === 'api-key') {
      return { authFile: false, apiKey: true };
    }
    if (source === 'none') {
      return { authFile: false, apiKey: false };
    }
  }

  return { ...defaultAccountsFilterState.source };
}

function normalizeResourceSelection(value: unknown): AccountsFilterState['resource'] {
  if (isSelectionObject(value, RESOURCE_KEYS)) {
    return normalizeResourceFacetSelection(normalizeSelectionObject(value, RESOURCE_KEYS, defaultAccountsFilterState.resource));
  }

  const candidate = isPlainObject(value) ? value : null;
  if (
    candidate &&
    ('quotaAndBalance' in candidate || 'noQuotaAndBalance' in candidate || 'noQuotaNoBalance' in candidate)
  ) {
    return normalizeResourceFacetSelection({
      hasQuota: resolveBoolean(candidate.quotaAndBalance),
      noQuota: resolveBoolean(candidate.noQuotaAndBalance) || resolveBoolean(candidate.noQuotaNoBalance),
      hasBalance: resolveBoolean(candidate.quotaAndBalance) || resolveBoolean(candidate.noQuotaAndBalance),
      noBalance: resolveBoolean(candidate.noQuotaNoBalance),
      hasUsageToday: !('hasUsageToday' in candidate) || resolveBoolean(candidate.hasUsageToday),
      noUsageToday: !('noUsageToday' in candidate) || resolveBoolean(candidate.noUsageToday),
    });
  }

  if (!candidate || (!('hasLongestQuota' in candidate) && !('hasBalance' in candidate))) {
    return { ...defaultAccountsFilterState.resource };
  }

  const hasLongestQuota = resolveBoolean(candidate.hasLongestQuota);
  const hasBalance = resolveBoolean(candidate.hasBalance);
  return normalizeResourceFacetSelection({
    hasQuota: hasLongestQuota,
    noQuota: !hasLongestQuota,
    hasBalance,
    noBalance: !hasBalance,
    hasUsageToday: true,
    noUsageToday: true,
  });
}

function normalizeStatusSelection(value: unknown): AccountsFilterState['status'] {
  const candidate = isPlainObject(value) ? value : null;
  const requestStatusCodes = normalizeRequestStatusCodeSelection(candidate?.requestStatusCodes);

  if (isSelectionObject(value, STATUS_KEYS)) {
    return {
      ...normalizeSelectionObject(value, STATUS_KEYS, defaultAccountsFilterState.status),
      requestStatusCodes,
    };
  }

  if (!candidate || (!('requiresError' in candidate) && !('requiresDisabled' in candidate) && !('requiresRequestable' in candidate))) {
    return {
      ...defaultAccountsFilterState.status,
      requestStatusCodes,
    };
  }

  return {
    error: resolveBoolean(candidate.requiresError),
    disabled: resolveBoolean(candidate.requiresDisabled),
    requestable: resolveBoolean(candidate.requiresRequestable),
    requestStatusCodes,
  };
}

function normalizePlanSelection(value: unknown): AccountsFilterState['plan'] {
  if (isPlainObject(value)) {
    return Object.entries(value).reduce<AccountsFilterState['plan']>((selection, [rawKey, rawValue]) => {
      const key = normalizePlanFilterKey(rawKey);
      if (key && typeof rawValue === 'boolean') {
        selection[key] = rawValue;
      }
      return selection;
    }, {});
  }

  return { ...defaultAccountsFilterState.plan };
}

function normalizeSelectionObject<T extends string>(
  value: unknown,
  keys: readonly T[],
  fallback: AccountsFilterGroupSelection<T>,
): AccountsFilterGroupSelection<T> {
  const candidate = isPlainObject(value) ? (value as Record<string, unknown>) : null;
  return keys.reduce((result, key) => {
    result[key] = typeof candidate?.[key] === 'boolean' ? candidate[key] === true : fallback[key];
    return result;
  }, {} as AccountsFilterGroupSelection<T>);
}

function isSelectionObject<T extends string>(value: unknown, keys: readonly T[]) {
  if (!isPlainObject(value)) {
    return false;
  }
  return keys.every((key) => key in value);
}

function isSelectionComplete<T extends string>(selection: AccountsFilterGroupSelection<T>, keys: readonly T[]) {
  return keys.every((key) => selection[key] === true);
}

function isPlanSelectionComplete(selection: AccountsFilterState['plan'], availablePlanTypes: readonly string[]) {
  if (availablePlanTypes.length === 0) {
    return true;
  }
  return availablePlanTypes.every((planType) => selection[planType] !== false);
}

function appendBinaryFacetSummary(
  parts: AccountsFilterSummaryPart[],
  selection: [boolean, boolean],
  labels: [string, string],
) {
  const [positiveSelected, negativeSelected] = selection;
  const [positiveLabel, negativeLabel] = labels;
  if (positiveSelected && negativeSelected) {
    return;
  }
  if (positiveSelected) {
    parts.push({ kind: 'resource', label: positiveLabel });
  }
  if (negativeSelected) {
    parts.push({ kind: 'resource', label: negativeLabel });
  }
}

function normalizePlanFilterKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeResourceFacetSelection(value: AccountsFilterState['resource']): AccountsFilterState['resource'] {
  const [hasQuota, noQuota] = normalizeBinaryFacet(value.hasQuota, value.noQuota);
  const [hasBalance, noBalance] = normalizeBinaryFacet(value.hasBalance, value.noBalance);
  const [hasUsageToday, noUsageToday] = normalizeBinaryFacet(value.hasUsageToday, value.noUsageToday);
  return {
    hasQuota,
    noQuota,
    hasBalance,
    noBalance,
    hasUsageToday,
    noUsageToday,
  };
}

function normalizeBinaryFacet(positiveSelected: boolean, negativeSelected: boolean): [boolean, boolean] {
  if (!positiveSelected && !negativeSelected) {
    return [true, true];
  }
  return [positiveSelected, negativeSelected];
}

function normalizeRequestStatusCodeSelection(value: unknown): AccountsFilterState['status']['requestStatusCodes'] {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<AccountsFilterState['status']['requestStatusCodes']>((selection, [rawCode, rawSelected]) => {
    const statusCode = normalizeStatusCode(rawCode);
    if (statusCode && rawSelected === true) {
      selection[statusCode] = true;
    }
    return selection;
  }, {});
}

function normalizeStatusCodeList(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => normalizeStatusCode(value)).filter(Boolean) as string[])).sort();
}

function normalizeStatusCode(value: unknown) {
  const normalized = String(value || '').trim();
  return /^[1-5]\d{2}$/.test(normalized) ? normalized : '';
}

function formatAccountPlanLabel(planType: string) {
  const normalized = planType.trim();
  if (!normalized) {
    return '';
  }
  return normalized
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function resolveLegacySourceSelection(value: unknown): CredentialSource | 'all' | 'none' {
  return value === 'all' || value === 'none' || value === 'auth-file' || value === 'api-key' ? value : 'all';
}

function resolveBoolean(value: unknown): boolean {
  return value === true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
