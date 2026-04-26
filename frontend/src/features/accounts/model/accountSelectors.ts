import type { AccountRecord } from '../../../types';
import type { AccountGroup, CodexQuotaState, SourceFilter, Translator } from './types';
import { buildQuotaDisplay } from './accountQuota.ts';
import {
  compareAccountRecords,
  planGroupRank,
  resolvePlanGroupLabel,
} from './accountPresentation.ts';

interface FilterAccountsArgs {
  searchTerm: string;
  sourceFilter: SourceFilter;
}

interface BuildAccountsViewArgs extends FilterAccountsArgs {
  authFileRecords: AccountRecord[];
  apiKeyRecords: AccountRecord[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  selectedAccountIDs: string[];
  t: Translator;
}

export function filterAccounts(accounts: AccountRecord[], { searchTerm, sourceFilter }: FilterAccountsArgs) {
  const query = searchTerm.trim().toLowerCase();
  return accounts.filter((account) => {
    if (sourceFilter !== 'all' && account.credentialSource !== sourceFilter) {
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
  sourceFilter,
  selectedAccountIDs,
  t,
}: BuildAccountsViewArgs) {
  const accounts = [...authFileRecords, ...apiKeyRecords].sort(compareAccountRecords);
  const filteredAccounts = filterAccounts(accounts, { searchTerm, sourceFilter });
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
