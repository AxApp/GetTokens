import type { AccountRecord } from './types';

export function findAccountDetailByID(accounts: AccountRecord[], detailID?: string | null) {
  const normalized = String(detailID || '').trim();
  if (!normalized) {
    return null;
  }
  return accounts.find((account) => account.id === normalized) ?? null;
}
