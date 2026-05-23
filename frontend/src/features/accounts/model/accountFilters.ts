import type { AccountsFilterSource, AccountsFilterState } from './types';
import type { CredentialSource } from '../../../types';

export const ACCOUNTS_FILTERS_STORAGE_KEY = 'gettokens.accountsFilters';

export const defaultAccountsFilterState: AccountsFilterState = {
  source: 'all',
  requiresRequestable: false,
  requiresDisabled: false,
  requiresError: false,
  hasBalance: false,
  hasLongestQuota: false,
};

function resolveAccountsFilterSource(value: unknown): AccountsFilterSource {
  return value === 'all' || value === 'none' || value === 'auth-file' || value === 'api-key' ? value : 'all';
}

export function isAccountsFilterSourceSelected(filterSource: AccountsFilterSource, source: CredentialSource): boolean {
  if (filterSource === 'all') {
    return true;
  }
  if (filterSource === 'none') {
    return false;
  }
  return filterSource === source;
}

export function toggleAccountsFilterSource(
  filterSource: AccountsFilterSource,
  source: CredentialSource,
): AccountsFilterSource {
  const authFileSelected =
    source === 'auth-file'
      ? !isAccountsFilterSourceSelected(filterSource, 'auth-file')
      : isAccountsFilterSourceSelected(filterSource, 'auth-file');
  const apiKeySelected =
    source === 'api-key'
      ? !isAccountsFilterSourceSelected(filterSource, 'api-key')
      : isAccountsFilterSourceSelected(filterSource, 'api-key');

  if (authFileSelected && apiKeySelected) {
    return 'all';
  }
  if (authFileSelected) {
    return 'auth-file';
  }
  if (apiKeySelected) {
    return 'api-key';
  }
  return 'none';
}

export function resolveAccountsFilterState(value: unknown): AccountsFilterState {
  if (!value || typeof value !== 'object') {
    return defaultAccountsFilterState;
  }

  const candidate = value as Partial<AccountsFilterState> & Record<string, unknown>;
  return {
    source: resolveAccountsFilterSource(candidate.source),
    requiresRequestable: candidate.requiresRequestable === true,
    requiresDisabled: candidate.requiresDisabled === true,
    requiresError: candidate.requiresError === true,
    hasBalance: candidate.hasBalance === true,
    hasLongestQuota: candidate.hasLongestQuota === true,
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
