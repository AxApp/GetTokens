import type { AccountRecord } from './types';

export function findAccountDetailByID(accounts: AccountRecord[], detailID?: string | null) {
  const normalized = String(detailID || '').trim();
  if (!normalized) {
    return null;
  }
  const direct = accounts.find((account) => account.id === normalized);
  if (direct) {
    return direct;
  }
  return (
    accounts.find((account) => {
      if (account.credentialSource !== 'auth-file') {
        return false;
      }
      return String(account.name || '').trim() === normalized;
    }) ?? null
  );
}

export function resolveAccountDetailSelection(
  accounts: AccountRecord[],
  detailID: string | null | undefined,
  selectedAccount: AccountRecord | null,
  accountsLoaded: boolean,
) {
  const normalized = String(detailID || '').trim();
  if (!normalized) {
    return selectedAccount;
  }
  if (selectedAccount?.id === normalized) {
    return selectedAccount;
  }
  const account = findAccountDetailByID(accounts, normalized);
  if (account) {
    return account;
  }
  return accountsLoaded ? null : selectedAccount;
}

export function patchAccountDetailByID(
  accounts: AccountRecord[],
  detailID: string,
  patch: Partial<AccountRecord>,
) {
  const normalized = String(detailID || '').trim();
  if (!normalized) {
    return accounts;
  }
  return accounts.map((account) =>
    account.id === normalized
      ? {
          ...account,
          ...patch,
          id: account.id,
        }
      : account,
  );
}
