import type { AccountRecord } from './types';

export function findAccountDetailByID(accounts: AccountRecord[], detailID?: string | null) {
  const normalized = String(detailID || '').trim();
  if (!normalized) {
    return null;
  }
  return accounts.find((account) => account.id === normalized) ?? null;
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
