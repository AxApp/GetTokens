import type { AccountPlanType, AccountRecord } from '../../../types';
import type { AccountGroup, AccountsFilterState, CodexQuotaState, Translator } from './types';
import type { AccountGroupMode, AccountSortMode } from './accountListLayout';
import type { AccountUsageSummary } from './accountUsage';
import { buildQuotaDisplay, extractBilling, hasDisplayableBilling, hasPositiveLongestQuota, selectLongestQuotaWindow } from './accountQuota.ts';
import {
  compareAccountRecords,
  isAccountUnavailable,
} from './accountPresentation.ts';

interface FilterAccountsArgs {
  searchTerm: string;
  filters: AccountsFilterState;
  codexQuotaByName: Record<string, CodexQuotaState>;
  accountUsageByID?: Record<string, AccountUsageSummary>;
}

interface BuildAccountsViewArgs {
  authFileRecords: AccountRecord[];
  apiKeyRecords: AccountRecord[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  accountUsageByID?: Record<string, AccountUsageSummary>;
  filters: AccountsFilterState;
  groupMode?: AccountGroupMode;
  sortMode?: AccountSortMode;
  searchTerm: string;
  selectedAccountIDs: string[];
  t: Translator;
}

interface GroupAccountsArgs {
  accounts: AccountRecord[];
  groupMode: AccountGroupMode;
  sortMode: AccountSortMode;
  codexQuotaByName: Record<string, CodexQuotaState>;
  t: Translator;
}

interface AccountGroupDescriptor {
  id: string;
  label: string;
  rank: number;
}

type AccountStatusBucket = 'requestable' | 'disabled' | 'error' | 'unknown';

export function filterAccounts(accounts: AccountRecord[], { searchTerm, filters, codexQuotaByName, accountUsageByID = {} }: FilterAccountsArgs) {
  const query = searchTerm.trim().toLowerCase();
  return accounts.filter((account) => {
    if (!matchesSourceSelection(filters.source, account.credentialSource)) {
      return false;
    }

    const quotaState = codexQuotaByName[account.quotaKey || ''];
    if (!matchesResourceSelection(filters.resource, account, quotaState, accountUsageByID[account.id])) {
      return false;
    }

    if (!matchesStatusSelection(filters.status, account)) {
      return false;
    }

    if (!matchesPlanSelection(filters.plan, resolveAccountPlanType(account, quotaState))) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      account.displayName,
      account.provider,
      account.email,
      account.planType,
      account.keyFingerprint,
      account.baseUrl,
      account.prefix,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function hasAccountDisplayableBalance(state?: CodexQuotaState) {
  if (!state?.quota) {
    return false;
  }
  return hasDisplayableBilling(extractBilling(state.quota));
}

function matchesSourceSelection(selection: AccountsFilterState['source'], source: AccountRecord['credentialSource']) {
  if (isSelectionComplete(selection)) {
    return true;
  }
  if (source === 'auth-file') {
    return selection.authFile;
  }
  return selection.apiKey;
}

function matchesResourceSelection(
  selection: AccountsFilterState['resource'],
  account: AccountRecord,
  state?: CodexQuotaState,
  usageSummary?: AccountUsageSummary,
) {
  if (isSelectionComplete(selection)) {
    return true;
  }

  const hasQuota = hasPositiveLongestQuota(account, state);
  const hasBalance = hasAccountDisplayableBalance(state);
  const hasUsageToday = (usageSummary?.requestCount ?? 0) > 0;

  if (selection.quotaAndBalance && hasQuota && hasBalance) {
    return true;
  }
  if (selection.noQuotaAndBalance && !hasQuota && hasBalance) {
    return true;
  }
  if (selection.noQuotaNoBalance && !hasQuota && !hasBalance) {
    return true;
  }
  if (selection.hasUsageToday && hasUsageToday) {
    return true;
  }
  if (selection.noUsageToday && !hasUsageToday) {
    return true;
  }
  return false;
}

function matchesStatusSelection(selection: AccountsFilterState['status'], account: AccountRecord) {
  if (isSelectionComplete(selection)) {
    return true;
  }
  if (selection.error && isAccountError(account)) {
    return true;
  }
  if (selection.disabled && isAccountDisabled(account)) {
    return true;
  }
  if (selection.requestable && isAccountRequestable(account)) {
    return true;
  }
  return false;
}

function matchesPlanSelection(selection: AccountsFilterState['plan'], planType: AccountPlanType | null) {
  if (isPlanSelectionUnrestricted(selection)) {
    return true;
  }
  if (!planType) {
    return false;
  }
  return selection[planType] !== false;
}

function isAccountDisabled(account: AccountRecord) {
  if (account.disabled) {
    return true;
  }
  return String(account.status || '').trim().toUpperCase() === 'DISABLED';
}

function isAccountError(account: AccountRecord) {
  if (isAccountDisabled(account)) {
    return false;
  }
  if (account.rawAuthFile?.unavailable) {
    return true;
  }
  const status = String(account.status || '').trim().toUpperCase();
  return status !== 'ACTIVE' && status !== 'CONFIGURED' && status !== 'LOCAL';
}

function isAccountRequestable(account: AccountRecord) {
  return !isAccountUnavailable(account);
}

function resolveAccountPlanType(account: AccountRecord, state?: CodexQuotaState): AccountPlanType | null {
  const quotaPlanType = normalizeAccountPlanType(state?.quota?.planType);
  if (quotaPlanType) {
    return quotaPlanType;
  }
  return normalizeAccountPlanType(account.planType);
}

function normalizeAccountPlanType(value: string | undefined): AccountPlanType | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const compact = normalized.replace(/[\s_-]+/g, '');
  if (compact === 'free' || compact === 'chatgptfree' || compact === 'freeplan') {
    return 'free';
  }
  if (compact === 'plus' || compact === 'chatgptplus' || compact === 'plusplan' || compact.includes('plus')) {
    return 'plus';
  }
  if (
    compact === 'pro' ||
    compact === 'chatgptpro' ||
    compact === 'proplan' ||
    compact === 'professional' ||
    compact === 'prolite'
  ) {
    return 'pro';
  }
  if (compact === 'team' || compact === 'chatgptteam' || compact === 'teamplan') {
    return 'team';
  }
  return normalized.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || null;
}

function isSelectionComplete(selection: Record<string, boolean>) {
  return Object.values(selection).every(Boolean);
}

function isPlanSelectionUnrestricted(selection: AccountsFilterState['plan']) {
  return Object.values(selection).every((selected) => selected !== false);
}

function formatAccountPlanLabel(planType: string) {
  return planType
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function resolveAccountPlanRank(planType: string) {
  const ranks: Record<string, number> = {
    pro: 10,
    team: 20,
    plus: 30,
    free: 40,
  };
  return ranks[planType] ?? 100;
}

function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase();
}

function buildGroupMeta(accounts: AccountRecord[]): NonNullable<AccountGroup['meta']> {
  return accounts.reduce(
    (meta, account) => {
      if (isAccountDisabled(account)) {
        meta.disabledCount += 1;
      } else if (isAccountError(account)) {
        meta.errorCount += 1;
      } else if (isAccountRequestable(account)) {
        meta.requestableCount += 1;
      }
      return meta;
    },
    {
      requestableCount: 0,
      disabledCount: 0,
      errorCount: 0,
    },
  );
}

function getQuotaStateForAccount(account: AccountRecord, codexQuotaByName: Record<string, CodexQuotaState>) {
  return codexQuotaByName[account.quotaKey || ''];
}

function resolveAccountStatusBucket(account: AccountRecord): AccountStatusBucket {
  if (isAccountDisabled(account)) {
    return 'disabled';
  }
  const normalizedStatus = String(account.status || '').trim().toUpperCase();
  if (!normalizedStatus) {
    return 'unknown';
  }
  if (isAccountError(account)) {
    return 'error';
  }
  return 'requestable';
}

function resolvePlanGroup(
  account: AccountRecord,
  state: CodexQuotaState | undefined,
  t: Translator,
): AccountGroupDescriptor {
  const planType = resolveAccountPlanType(account, state);
  if (planType) {
    return { id: `plan:${planType}`, label: formatAccountPlanLabel(planType), rank: resolveAccountPlanRank(planType) };
  }
  if (account.credentialSource === 'api-key') {
    return { id: 'plan:api-key', label: t('accounts.group_plan_api_key'), rank: 900 };
  }
  return { id: 'plan:unknown', label: t('accounts.group_plan_unknown'), rank: 910 };
}

function resolveSourceGroup(account: AccountRecord, t: Translator): AccountGroupDescriptor {
  if (account.accountKind === 'openai-compatible') {
    return { id: 'source:openai-compatible', label: t('accounts.group_source_openai_compatible'), rank: 30 };
  }
  if (account.credentialSource === 'auth-file') {
    return { id: 'source:auth-file', label: t('accounts.group_source_auth_file'), rank: 10 };
  }
  if (account.credentialSource === 'api-key') {
    return { id: 'source:api-key', label: t('accounts.group_source_api_key'), rank: 20 };
  }
  return { id: 'source:other', label: t('accounts.group_source_other'), rank: 40 };
}

function resolveStatusGroup(account: AccountRecord, t: Translator): AccountGroupDescriptor {
  const bucket = resolveAccountStatusBucket(account);
  if (bucket === 'requestable') {
    return { id: 'status:requestable', label: t('accounts.group_status_requestable'), rank: 10 };
  }
  if (bucket === 'disabled') {
    return { id: 'status:disabled', label: t('accounts.group_status_disabled'), rank: 20 };
  }
  if (bucket === 'error') {
    return { id: 'status:error', label: t('accounts.group_status_error'), rank: 30 };
  }
  return { id: 'status:unknown', label: t('accounts.group_status_unknown'), rank: 40 };
}

function resolveProviderGroup(account: AccountRecord): AccountGroupDescriptor {
  const providerKey = normalizeProviderKey(account.provider);
  const id = providerKey || 'unknown';
  return {
    id: `provider:${id}`,
    label: account.provider.toUpperCase() || 'UNKNOWN',
    rank: 0,
  };
}

function resolveResourceGroup(
  account: AccountRecord,
  state: CodexQuotaState | undefined,
  t: Translator,
): AccountGroupDescriptor {
  if (hasPositiveLongestQuota(account, state)) {
    return { id: 'resource:quota', label: t('accounts.group_resource_quota'), rank: 10 };
  }
  if (hasAccountDisplayableBalance(state)) {
    return { id: 'resource:balance', label: t('accounts.group_resource_balance'), rank: 20 };
  }
  if (state?.status === 'success' && state.quota) {
    return { id: 'resource:empty', label: t('accounts.group_resource_empty'), rank: 30 };
  }
  return { id: 'resource:unknown', label: t('accounts.group_resource_unknown'), rank: 40 };
}

function resolveAccountGroup(
  account: AccountRecord,
  groupMode: AccountGroupMode,
  state: CodexQuotaState | undefined,
  t: Translator,
): AccountGroupDescriptor {
  switch (groupMode) {
    case 'plan':
      return resolvePlanGroup(account, state, t);
    case 'source':
      return resolveSourceGroup(account, t);
    case 'status':
      return resolveStatusGroup(account, t);
    case 'resource':
      return resolveResourceGroup(account, state, t);
    case 'provider':
    default:
      return resolveProviderGroup(account);
  }
}

function resolveLongestQuotaRemainingPercent(account: AccountRecord, state?: CodexQuotaState) {
  const quotaDisplay = buildQuotaDisplay(account, state);
  if (quotaDisplay.status !== 'success') {
    return null;
  }
  const longestWindow = selectLongestQuotaWindow(quotaDisplay.windows);
  return typeof longestWindow?.remainingPercent === 'number' ? longestWindow.remainingPercent : null;
}

function resolveLongestQuotaResetAt(account: AccountRecord, state?: CodexQuotaState) {
  const quotaDisplay = buildQuotaDisplay(account, state);
  if (quotaDisplay.status !== 'success') {
    return null;
  }
  const longestWindow = selectLongestQuotaWindow(quotaDisplay.windows);
  return typeof longestWindow?.resetAtUnix === 'number' && longestWindow.resetAtUnix > 0 ? longestWindow.resetAtUnix : null;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc',
) {
  const leftHasValue = typeof left === 'number' && Number.isFinite(left);
  const rightHasValue = typeof right === 'number' && Number.isFinite(right);
  if (leftHasValue && rightHasValue && left !== right) {
    return direction === 'asc' ? left - right : right - left;
  }
  if (leftHasValue !== rightHasValue) {
    return leftHasValue ? -1 : 1;
  }
  return 0;
}

function compareByName(left: AccountRecord, right: AccountRecord) {
  const leftValues = [left.displayName, left.email, left.id];
  const rightValues = [right.displayName, right.email, right.id];
  for (let index = 0; index < leftValues.length; index += 1) {
    const result = String(leftValues[index] || '').localeCompare(String(rightValues[index] || ''), undefined, {
      sensitivity: 'base',
    });
    if (result !== 0) {
      return result;
    }
  }
  return 0;
}

function compareByStatus(left: AccountRecord, right: AccountRecord) {
  const rank: Record<AccountStatusBucket, number> = {
    error: 10,
    disabled: 20,
    unknown: 30,
    requestable: 40,
  };
  return rank[resolveAccountStatusBucket(left)] - rank[resolveAccountStatusBucket(right)];
}

export function compareAccountsBySortMode(
  left: AccountRecord,
  right: AccountRecord,
  sortMode: AccountSortMode,
  codexQuotaByName: Record<string, CodexQuotaState>,
) {
  let result = 0;
  if (sortMode === 'name') {
    result = compareByName(left, right);
  } else if (sortMode === 'status') {
    result = compareByStatus(left, right);
  } else if (sortMode === 'quota') {
    result = compareNullableNumbers(
      resolveLongestQuotaRemainingPercent(left, getQuotaStateForAccount(left, codexQuotaByName)),
      resolveLongestQuotaRemainingPercent(right, getQuotaStateForAccount(right, codexQuotaByName)),
      'desc',
    );
  } else if (sortMode === 'reset') {
    result = compareNullableNumbers(
      resolveLongestQuotaResetAt(left, getQuotaStateForAccount(left, codexQuotaByName)),
      resolveLongestQuotaResetAt(right, getQuotaStateForAccount(right, codexQuotaByName)),
      'asc',
    );
  }

  if (result !== 0) {
    return result;
  }

  const priorityResult = compareAccountRecords(left, right);
  if (priorityResult !== 0) {
    return priorityResult;
  }
  return left.id.localeCompare(right.id, undefined, { sensitivity: 'base' });
}

export function collectAvailableAccountPlanTypes(
  accounts: AccountRecord[],
  codexQuotaByName: Record<string, CodexQuotaState>,
): AccountPlanType[] {
  const available = new Set<AccountPlanType>();

  for (const account of accounts) {
    const quotaState = codexQuotaByName[account.quotaKey || ''];
    const planType = resolveAccountPlanType(account, quotaState);
    if (planType) {
      available.add(planType);
    }
  }

  return [...available].sort((left, right) => {
    const rankResult = resolveAccountPlanRank(left) - resolveAccountPlanRank(right);
    if (rankResult !== 0) {
      return rankResult;
    }
    return left.localeCompare(right, undefined, { sensitivity: 'base' });
  });
}

export function groupAccountsByVendor(
  accounts: AccountRecord[],
): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();

  for (const account of accounts) {
    const providerKey = normalizeProviderKey(account.provider);
    const id = providerKey || 'unknown';
    const existing = groups.get(id);
    if (existing) {
      existing.accounts.push(account);
      continue;
    }
    groups.set(id, {
      id,
      label: account.provider.toUpperCase() || 'UNKNOWN',
      rank: 0,
      accounts: [account],
    });
  }

  return [...groups.values()].sort((left, right) =>
    left.id.localeCompare(right.id, undefined, { sensitivity: 'base' }),
  );
}

export function groupAccounts({
  accounts,
  groupMode,
  sortMode,
  codexQuotaByName,
  t,
}: GroupAccountsArgs): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();

  for (const account of accounts) {
    const state = getQuotaStateForAccount(account, codexQuotaByName);
    const descriptor = resolveAccountGroup(account, groupMode, state, t);
    const existing = groups.get(descriptor.id);
    if (existing) {
      existing.accounts.push(account);
      existing.meta = buildGroupMeta(existing.accounts);
      continue;
    }
    groups.set(descriptor.id, {
      ...descriptor,
      mode: groupMode,
      accounts: [account],
      meta: buildGroupMeta([account]),
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      accounts: [...group.accounts].sort((left, right) =>
        compareAccountsBySortMode(left, right, sortMode, codexQuotaByName),
      ),
      meta: buildGroupMeta(group.accounts),
    }))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return left.id.localeCompare(right.id, undefined, { sensitivity: 'base' });
    });
}

export function buildAccountsView({
  authFileRecords,
  apiKeyRecords,
  codexQuotaByName,
  accountUsageByID,
  searchTerm,
  filters,
  groupMode = 'plan',
  sortMode = 'priority',
  selectedAccountIDs,
  t,
}: BuildAccountsViewArgs) {
  const accounts = [...authFileRecords, ...apiKeyRecords].sort((left, right) =>
    compareAccountsBySortMode(left, right, sortMode, codexQuotaByName),
  );
  const filteredAccounts = filterAccounts(accounts, { searchTerm, filters, codexQuotaByName, accountUsageByID });
  const groupedAccounts = groupAccounts({ accounts: filteredAccounts, groupMode, sortMode, codexQuotaByName, t });
  const availablePlanTypes = collectAvailableAccountPlanTypes(accounts, codexQuotaByName);
  const selectedAccountIDSet = new Set(selectedAccountIDs);
  const selectedAccounts = accounts.filter((account) => selectedAccountIDSet.has(account.id));
  const allFilteredSelected =
    filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedAccountIDSet.has(account.id));

  return {
    accounts,
    filteredAccounts,
    groupedAccounts,
    availablePlanTypes,
    selectedAccountIDSet,
    selectedAccounts,
    allFilteredSelected,
  };
}
