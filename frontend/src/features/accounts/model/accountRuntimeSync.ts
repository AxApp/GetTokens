import type { AccountRecord } from '../../../types';

export const ACCOUNT_RUNTIME_SYNC_INTERVAL_MS = 30000;

export interface AccountRuntimeSyncScheduleState {
  ready: boolean;
  hasRuntimeBindings: boolean;
  accountCount: number;
  documentHidden: boolean;
}

export function shouldScheduleAccountRuntimeSync(state: AccountRuntimeSyncScheduleState) {
  return state.ready && state.hasRuntimeBindings && state.accountCount > 0 && !state.documentHidden;
}

export interface AccountRuntimeSyncVisibilityState {
  wasHidden: boolean;
  documentHidden: boolean;
  canSchedule: boolean;
}

export function normalizeRuntimeSyncDocumentHidden(state: {
  documentHidden: boolean;
  hasRuntimeBindings: boolean;
}) {
  return state.documentHidden && !state.hasRuntimeBindings;
}

export function shouldRunRuntimeSyncOnVisibilityRestore(state: AccountRuntimeSyncVisibilityState) {
  return state.wasHidden && !state.documentHidden && state.canSchedule;
}

export function buildRuntimeSyncAccountKeys(accounts: Array<Pick<AccountRecord, 'id' | 'quotaKey'>>) {
  const keys: string[] = [];
  const seen = new Set<string>();
  accounts.forEach((account) => {
    const key = String(account.quotaKey || '').trim();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    keys.push(key);
  });
  return keys;
}
