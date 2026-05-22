import type { AccountsFilterSource, AccountsFilterState } from './types';

export const ACCOUNTS_FILTERS_STORAGE_KEY = 'gettokens.accountsFilters';

export const defaultAccountsFilterState: AccountsFilterState = {
  source: 'all',
  requestableOnly: false,
  disabledOnly: false,
  hasBalance: false,
  hasLongestQuota: false,
  errorsOnly: false,
};

function resolveAccountsFilterSource(value: unknown): AccountsFilterSource {
  return value === 'auth-file' || value === 'api-key' ? value : 'all';
}

export function resolveAccountsFilterState(value: unknown): AccountsFilterState {
  if (!value || typeof value !== 'object') {
    return defaultAccountsFilterState;
  }

  const candidate = value as Partial<AccountsFilterState>;
  return {
    source: resolveAccountsFilterSource(candidate.source),
    requestableOnly: candidate.requestableOnly === true,
    disabledOnly: candidate.disabledOnly === true,
    hasBalance: candidate.hasBalance === true,
    hasLongestQuota: candidate.hasLongestQuota === true,
    errorsOnly: candidate.errorsOnly === true,
  };
}

export function readStoredAccountsFilterState(storage: Pick<Storage, 'getItem'> | null | undefined): AccountsFilterState {
  try {
    const raw = storage?.getItem(ACCOUNTS_FILTERS_STORAGE_KEY);
    if (!raw) {
      return defaultAccountsFilterState;
    }
    return resolveAccountsFilterState(JSON.parse(raw));
  } catch {
    return defaultAccountsFilterState;
  }
}

export function persistAccountsFilterState(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  state: AccountsFilterState,
): void {
  storage?.setItem(ACCOUNTS_FILTERS_STORAGE_KEY, JSON.stringify(state));
}
