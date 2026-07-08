import type { CodexQuota } from '../../../types';
import type { CodexQuotaState } from './types';

export const ACCOUNT_QUOTA_CACHE_STORAGE_KEY = 'gettokens.accounts.quota-cache';

interface StoredAccountQuotaCache {
  version?: number;
  items?: Record<string, StoredAccountQuotaItem>;
}

interface StoredAccountQuotaItem {
  quota?: CodexQuota;
  updatedAt?: number;
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readStoredAccountQuotaStates(
  storage: ReadableStorage | null | undefined,
  allowedKeys?: Iterable<string>,
): Record<string, CodexQuotaState> {
  try {
    const allowedKeySet = allowedKeys ? new Set([...allowedKeys].filter((key) => key.trim())) : null;
    const items = readStoredQuotaItems(storage);
    if (!items || typeof items !== 'object') {
      return {};
    }

    return Object.entries(items).reduce<Record<string, CodexQuotaState>>((result, [key, item]) => {
      if (allowedKeySet && !allowedKeySet.has(key)) {
        return result;
      }
      if (!isStoredQuotaItem(item)) {
        return result;
      }
      result[key] = { status: 'success', quota: item.quota };
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function persistAccountQuotaStates(
  storage: WritableStorage | null | undefined,
  states: Record<string, CodexQuotaState>,
): void {
  try {
    const quotas = Object.entries(states).reduce<Record<string, CodexQuota>>((result, [key, state]) => {
      if (state.quota) {
        result[key] = state.quota;
      }
      return result;
    }, {});
    const previousItems = readStoredQuotaItems(storage);
    if (previousItems && areStoredQuotaItemsEqual(previousItems, quotas)) {
      return;
    }

    const now = Date.now();
    const items = Object.entries(quotas).reduce<Record<string, StoredAccountQuotaItem>>((result, [key, quota]) => {
      const previous = previousItems?.[key];
      result[key] = {
        quota,
        updatedAt: previous && areQuotaPayloadsEqual(previous.quota, quota) ? previous.updatedAt : now,
      };
      return result;
    }, {});
    storage?.setItem(
      ACCOUNT_QUOTA_CACHE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        items,
      } satisfies StoredAccountQuotaCache),
    );
  } catch {
    // Quota data is a convenience cache; failed persistence should not break the account list.
  }
}

function readStoredQuotaItems(storage: ReadableStorage | null | undefined): Record<string, StoredAccountQuotaItem> | null {
  const raw = storage?.getItem(ACCOUNT_QUOTA_CACHE_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as StoredAccountQuotaCache;
  const items = parsed && typeof parsed === 'object' ? parsed.items : null;
  return items && typeof items === 'object' ? items : null;
}

function isStoredQuotaItem(value: unknown): value is StoredAccountQuotaItem & { quota: CodexQuota } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const quota = (value as StoredAccountQuotaItem).quota;
  return Boolean(quota && typeof quota === 'object');
}

function areStoredQuotaItemsEqual(previousItems: Record<string, StoredAccountQuotaItem>, nextQuotas: Record<string, CodexQuota>) {
  const previousKeys = Object.keys(previousItems).filter((key) => isStoredQuotaItem(previousItems[key])).sort();
  const nextKeys = Object.keys(nextQuotas).sort();
  if (previousKeys.length !== nextKeys.length || previousKeys.some((key, index) => key !== nextKeys[index])) {
    return false;
  }
  return nextKeys.every((key) => areQuotaPayloadsEqual(previousItems[key]?.quota, nextQuotas[key]));
}

function areQuotaPayloadsEqual(previous: unknown, next: unknown) {
  return JSON.stringify(previous) === JSON.stringify(next);
}
