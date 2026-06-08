import type { AccountRecord } from '../../../types';

export const ACCOUNT_RUNTIME_SYNC_INTERVAL_MS = 30000;
export const ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY = 6;

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

export async function runAccountRuntimeRequestPool<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void> | void,
  options: { concurrency?: number } = {},
) {
  if (items.length === 0) {
    return;
  }

  const concurrency = resolveAccountRuntimeRequestPoolConcurrency(options.concurrency);
  let nextIndex = 0;
  const errors: unknown[] = [];

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        await worker(items[index], index);
      } catch (error) {
        errors.push(error);
      }
    }
  });

  await Promise.all(workers);
  if (errors.length > 0) {
    throw errors[0];
  }
}

function resolveAccountRuntimeRequestPoolConcurrency(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY;
  }
  return Math.max(1, Math.floor(value));
}
