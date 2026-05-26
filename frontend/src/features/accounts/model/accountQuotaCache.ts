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
type WritableStorage = Pick<Storage, 'setItem'>;

export function readStoredAccountQuotaStates(
  storage: ReadableStorage | null | undefined,
  allowedKeys?: Iterable<string>,
): Record<string, CodexQuotaState> {
  try {
    const raw = storage?.getItem(ACCOUNT_QUOTA_CACHE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const allowedKeySet = allowedKeys ? new Set([...allowedKeys].filter((key) => key.trim())) : null;
    const parsed = JSON.parse(raw) as StoredAccountQuotaCache;
    const items = parsed && typeof parsed === 'object' ? parsed.items : null;
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
    const items = Object.entries(states).reduce<Record<string, StoredAccountQuotaItem>>((result, [key, state]) => {
      if (state.quota) {
        result[key] = {
          quota: state.quota,
          updatedAt: Date.now(),
        };
      }
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

function isStoredQuotaItem(value: unknown): value is StoredAccountQuotaItem & { quota: CodexQuota } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const quota = (value as StoredAccountQuotaItem).quota;
  return Boolean(quota && typeof quota === 'object');
}
