import type { AccountRecord } from '../../../types';
import type { AccountGroup, AccountsFilterState, CodexQuotaState, Translator } from './types';
import { buildQuotaDisplay, hasPositiveLongestQuota } from './accountQuota.ts';
import {
  compareAccountRecords,
  isAccountUnavailable,
  planGroupRank,
  resolvePlanGroupLabel,
} from './accountPresentation.ts';

interface FilterAccountsArgs {
  searchTerm: string;
  filters: AccountsFilterState;
  codexQuotaByName: Record<string, CodexQuotaState>;
}

interface BuildAccountsViewArgs {
  authFileRecords: AccountRecord[];
  apiKeyRecords: AccountRecord[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  filters: AccountsFilterState;
  searchTerm: string;
  selectedAccountIDs: string[];
  t: Translator;
}

export function filterAccounts(accounts: AccountRecord[], { searchTerm, filters, codexQuotaByName }: FilterAccountsArgs) {
  const query = searchTerm.trim().toLowerCase();
  return accounts.filter((account) => {
    if (filters.source !== 'all' && account.credentialSource !== filters.source) {
      return false;
    }

    if (filters.hasLongestQuota && !hasPositiveLongestQuota(account, codexQuotaByName[account.quotaKey || ''])) {
      return false;
    }

    if (filters.errorsOnly && !isAccountUnavailable(account)) {
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

export function groupAccountsByPlan(
  accounts: AccountRecord[],
  codexQuotaByName: Record<string, CodexQuotaState>,
  t: Translator
): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();

  for (const account of accounts) {
    const quotaDisplay = buildQuotaDisplay(account, codexQuotaByName[account.quotaKey || '']);
    const label = resolvePlanGroupLabel(account, quotaDisplay, t);
    const id = label.toLowerCase();
    const existing = groups.get(id);
    if (existing) {
      existing.accounts.push(account);
      continue;
    }
    groups.set(id, {
      id,
      label,
      rank: planGroupRank(label),
      accounts: [account],
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
  });
}

export function buildAccountsView({
  authFileRecords,
  apiKeyRecords,
  codexQuotaByName,
  searchTerm,
  filters,
  selectedAccountIDs,
  t,
}: BuildAccountsViewArgs) {
  const accounts = [...authFileRecords, ...apiKeyRecords].sort(compareAccountRecords);
  const filteredAccounts = filterAccounts(accounts, { searchTerm, filters, codexQuotaByName });
  const groupedAccounts = groupAccountsByPlan(filteredAccounts, codexQuotaByName, t);
  const selectedAccountIDSet = new Set(selectedAccountIDs);
  const selectedAccounts = accounts.filter((account) => selectedAccountIDSet.has(account.id));
  const allFilteredSelected =
    filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedAccountIDSet.has(account.id));

  return {
    accounts,
    filteredAccounts,
    groupedAccounts,
    selectedAccountIDSet,
    selectedAccounts,
    allFilteredSelected,
  };
}
