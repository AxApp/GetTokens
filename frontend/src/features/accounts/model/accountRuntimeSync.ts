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

export type AccountRuntimeResource = 'quota' | 'usage' | 'rate-limit' | 'models' | 'route-evidence';

export class AccountRuntimeRefreshCoordinator {
  private readonly inFlightByAccount = new Map<string, Promise<void>>();

  run(
    resource: AccountRuntimeResource,
    accountKeys: string[],
    task: (accountKeys: string[]) => Promise<unknown>,
  ): Promise<void> {
    const normalizedKeys = normalizeAccountRuntimeRefreshKeys(accountKeys);
    if (normalizedKeys.length === 0) {
      return Promise.resolve();
    }

    const requests = new Set<Promise<void>>();
    const missingKeys: string[] = [];
    normalizedKeys.forEach((accountKey) => {
      const existing = this.inFlightByAccount.get(buildAccountRuntimeRefreshAccountKey(resource, accountKey));
      if (existing) {
        requests.add(existing);
        return;
      }
      missingKeys.push(accountKey);
    });

    if (missingKeys.length > 0) {
      let request: Promise<unknown>;
      try {
        request = Promise.resolve(task(missingKeys));
      } catch (error) {
        request = Promise.reject(error);
      }

      const tracked = request.then(() => undefined).finally(() => {
        missingKeys.forEach((accountKey) => {
          const key = buildAccountRuntimeRefreshAccountKey(resource, accountKey);
          if (this.inFlightByAccount.get(key) === tracked) {
            this.inFlightByAccount.delete(key);
          }
        });
      });
      missingKeys.forEach((accountKey) => {
        this.inFlightByAccount.set(buildAccountRuntimeRefreshAccountKey(resource, accountKey), tracked);
      });
      requests.add(tracked);
    }

    return Promise.all(requests).then(() => undefined);
  }
}

function buildAccountRuntimeRefreshAccountKey(resource: AccountRuntimeResource, accountKey: string) {
  return `${resource}:${accountKey}`;
}

function normalizeAccountRuntimeRefreshKeys(accountKeys: string[]) {
  return Array.from(
    new Set(accountKeys.map((key) => String(key || '').trim()).filter(Boolean)),
  ).sort();
}

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
): T[] {
  const targetIDSet = new Set(
    Array.from(targetAccountIDs)
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  );

  if (targetIDSet.size === 0) {
    return [];
  }

  const targets = accounts.filter((account) => targetIDSet.has(account.id));
  if (targets.length > 0) {
    return targets;
  }

  return [];
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
