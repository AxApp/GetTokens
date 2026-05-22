import type { AccountRecord } from '../../../types';
import type { AccountGroup, AccountsFilterState, CodexQuotaState, Translator } from './types';
import { extractBilling, hasDisplayableBilling, hasPositiveLongestQuota } from './accountQuota.ts';
import {
  compareAccountRecords,
  isAccountUnavailable,
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
    if (filters.source === 'none') {
      return false;
    }

    if (filters.source !== 'all' && account.credentialSource !== filters.source) {
      return false;
    }

    if (filters.hasBalance && !hasAccountDisplayableBalance(codexQuotaByName[account.quotaKey || ''])) {
      return false;
    }

    if (filters.hasLongestQuota && !hasPositiveLongestQuota(account, codexQuotaByName[account.quotaKey || ''])) {
      return false;
    }

    if (filters.availability === 'requestable' && isAccountUnavailable(account)) {
      return false;
    }

    if (filters.availability === 'disabled' && !isAccountDisabled(account)) {
      return false;
    }

    if (filters.availability === 'errors' && !isAccountError(account)) {
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

function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase();
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
  const groupedAccounts = groupAccountsByVendor(filteredAccounts);
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
