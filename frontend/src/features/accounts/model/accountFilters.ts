import type { AccountsFilterSource, AccountsFilterState } from './types';

export const ACCOUNTS_FILTERS_STORAGE_KEY = 'gettokens.accountsFilters';

export const defaultAccountsFilterState: AccountsFilterState = {
  source: 'all',
  hasLongestQuota: false,
  errorsOnly: false,
};

export function isAccountsFilterSource(value: string | null | undefined): value is AccountsFilterSource {
  return value === 'all' || value === 'auth-file' || value === 'api-key';
}

export function resolveAccountsFilterState(value: unknown): AccountsFilterState {
  if (!value || typeof value !== 'object') {
    return defaultAccountsFilterState;
  }

  const candidate = value as Partial<AccountsFilterState>;
  if (!isAccountsFilterSource(candidate.source)) {
    return defaultAccountsFilterState;
  }
  if (typeof candidate.hasLongestQuota !== 'boolean' || typeof candidate.errorsOnly !== 'boolean') {
    return defaultAccountsFilterState;
  }

  return {
    source: candidate.source,
    hasLongestQuota: candidate.hasLongestQuota,
    errorsOnly: candidate.errorsOnly,
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
