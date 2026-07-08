import type { AccountRecord } from '../../../types';

export const ACCOUNT_RUNTIME_SYNC_INTERVAL_MS = 30000;
export const ACCOUNT_RUNTIME_SYNC_MEDIUM_POOL_THRESHOLD = 500;
export const ACCOUNT_RUNTIME_SYNC_LARGE_POOL_THRESHOLD = 1000;
export const ACCOUNT_RUNTIME_SYNC_MEDIUM_POOL_INTERVAL_MS = 120000;
export const ACCOUNT_RUNTIME_SYNC_LARGE_POOL_INTERVAL_MS = 300000;
export const ACCOUNT_RUNTIME_SYNC_IMMEDIATE_MAX_ACCOUNT_COUNT = ACCOUNT_RUNTIME_SYNC_MEDIUM_POOL_THRESHOLD;
export const ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY = 6;
export const ACCOUNT_RUNTIME_QUOTA_STATUS_REQUEST_CONCURRENCY = 4;
export const ACCOUNT_RUNTIME_QUOTA_STATUS_CHUNK_SIZE = 200;

export interface AccountRuntimeSyncScheduleState {
  ready: boolean;
  hasRuntimeBindings: boolean;
  accountCount: number;
  documentHidden: boolean;
}

export function shouldScheduleAccountRuntimeSync(state: AccountRuntimeSyncScheduleState) {
  return state.ready && state.hasRuntimeBindings && state.accountCount > 0 && !state.documentHidden;
}

export function resolveAccountRuntimeSyncIntervalMs(accountCount: number) {
  const safeAccountCount = Number.isFinite(accountCount) ? Math.max(0, Math.floor(accountCount)) : 0;
  if (safeAccountCount > ACCOUNT_RUNTIME_SYNC_LARGE_POOL_THRESHOLD) {
    return ACCOUNT_RUNTIME_SYNC_LARGE_POOL_INTERVAL_MS;
  }
  if (safeAccountCount > ACCOUNT_RUNTIME_SYNC_MEDIUM_POOL_THRESHOLD) {
    return ACCOUNT_RUNTIME_SYNC_MEDIUM_POOL_INTERVAL_MS;
  }
  return ACCOUNT_RUNTIME_SYNC_INTERVAL_MS;
}

export function shouldRunImmediateAccountRuntimeSync(accountCount: number) {
  const safeAccountCount = Number.isFinite(accountCount) ? Math.max(0, Math.floor(accountCount)) : 0;
  return safeAccountCount > 0 && safeAccountCount <= ACCOUNT_RUNTIME_SYNC_IMMEDIATE_MAX_ACCOUNT_COUNT;
}

export function resolveAutomaticAccountRuntimeSyncTargets<T extends Pick<AccountRecord, 'id'>>(
  accounts: T[],
  targetAccountIDs: Iterable<string>,
  options: { largePoolThreshold?: number } = {},
): T[] {
  const largePoolThreshold = options.largePoolThreshold ?? ACCOUNT_RUNTIME_SYNC_MEDIUM_POOL_THRESHOLD;
  const targetIDSet = new Set(
    Array.from(targetAccountIDs)
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  );

  if (targetIDSet.size === 0) {
    return accounts.length > largePoolThreshold ? [] : accounts;
  }

  const targets = accounts.filter((account) => targetIDSet.has(account.id));
  if (targets.length > 0) {
    return targets;
  }

  return accounts.length > largePoolThreshold ? [] : accounts;
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

export function chunkRuntimeSyncAccountKeys(
  accountKeys: string[],
  options: { chunkSize?: number } = {},
) {
  const chunkSize = resolveAccountRuntimeQuotaStatusChunkSize(options.chunkSize);
  const chunks: string[][] = [];
  for (let index = 0; index < accountKeys.length; index += chunkSize) {
    chunks.push(accountKeys.slice(index, index + chunkSize));
  }
  return chunks;
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

function resolveAccountRuntimeQuotaStatusChunkSize(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return ACCOUNT_RUNTIME_QUOTA_STATUS_CHUNK_SIZE;
  }
  return Math.max(1, Math.floor(value));
}
