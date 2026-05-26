import type { AccountRecord } from '../../../types';

export interface AccountDisabledChange {
  id: string;
  disabled: boolean;
}

export interface AccountDisabledSyncEvent extends AccountDisabledChange {
  source?: string;
  updatedAt: number;
}

const ACCOUNT_DISABLED_SYNC_EVENT = 'gettokens:account-disabled-changed';
const ACCOUNT_DISABLED_SYNC_STORAGE_KEY = 'gettokens.account-disabled-sync-event';
const ACCOUNT_DISABLED_OVERRIDES_STORAGE_KEY = 'gettokens.account-disabled-overrides';

type DisabledSyncStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function normalizeAccountDisabledChange(input: unknown): AccountDisabledChange | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const id = String((input as { id?: unknown }).id || '').trim();
  if (!isCanonicalAccountID(id)) {
    return null;
  }
  const disabled = (input as { disabled?: unknown }).disabled;
  if (typeof disabled !== 'boolean') {
    return null;
  }
  return {
    id,
    disabled,
  };
}

export function applyAccountDisabledChangeToRecord<T extends Pick<AccountRecord, 'id' | 'status' | 'disabled'>>(
  account: T,
  change: AccountDisabledChange,
): T {
  if (account.id !== change.id) {
    return account;
  }
  return {
    ...account,
    disabled: change.disabled,
    status: resolveNextAccountDisabledStatus(account.status, change.disabled),
  };
}

export function publishAccountDisabledChange(change: AccountDisabledChange, source: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = normalizeAccountDisabledChange(change);
  if (!normalized) {
    return;
  }
  const event: AccountDisabledSyncEvent = {
    ...normalized,
    source,
    updatedAt: Date.now(),
  };
  rememberAccountDisabledChange(normalized);
  window.dispatchEvent(new CustomEvent<AccountDisabledSyncEvent>(ACCOUNT_DISABLED_SYNC_EVENT, { detail: event }));
  try {
    window.localStorage.setItem(ACCOUNT_DISABLED_SYNC_STORAGE_KEY, JSON.stringify(event));
  } catch {
    // Cross-tab sync is best-effort; the same-tab event already updated local state.
  }
}

export function rememberAccountDisabledChange(change: AccountDisabledChange, storage: DisabledSyncStorage | null = readBrowserStorage()) {
  if (!storage) {
    return;
  }
  const normalized = normalizeAccountDisabledChange(change);
  if (!normalized) {
    return;
  }
  const overrides = readAccountDisabledOverrides(storage);
  overrides[normalized.id] = normalized.disabled;
  try {
    storage.setItem(ACCOUNT_DISABLED_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Preview overrides are best-effort.
  }
}

export function readAccountDisabledOverrides(storage: Pick<Storage, 'getItem'> | null = readBrowserStorage()) {
  if (!storage) {
    return {};
  }
  try {
    const parsed = JSON.parse(storage.getItem(ACCOUNT_DISABLED_OVERRIDES_STORAGE_KEY) || '{}') as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, boolean>>((overrides, [id, disabled]) => {
      const normalized = normalizeAccountDisabledChange({ id, disabled });
      if (normalized) {
        overrides[normalized.id] = normalized.disabled;
      }
      return overrides;
    }, {});
  } catch {
    return {};
  }
}

export function subscribeAccountDisabledChanges(listener: (event: AccountDisabledSyncEvent) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleLocalEvent = (event: Event) => {
    const detail = (event as CustomEvent<AccountDisabledSyncEvent>).detail;
    const normalized = normalizeAccountDisabledChange(detail);
    if (!normalized) {
      return;
    }
    listener({
      ...normalized,
      source: detail?.source,
      updatedAt: Number(detail?.updatedAt || Date.now()),
    });
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== ACCOUNT_DISABLED_SYNC_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as AccountDisabledSyncEvent;
      const normalized = normalizeAccountDisabledChange(parsed);
      if (!normalized) {
        return;
      }
      listener({
        ...normalized,
        source: parsed.source,
        updatedAt: Number(parsed.updatedAt || Date.now()),
      });
    } catch {
      // Ignore malformed cross-tab payloads.
    }
  };

  window.addEventListener(ACCOUNT_DISABLED_SYNC_EVENT, handleLocalEvent);
  window.addEventListener('storage', handleStorageEvent);
  return () => {
    window.removeEventListener(ACCOUNT_DISABLED_SYNC_EVENT, handleLocalEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

function isCanonicalAccountID(id: string) {
  return id.startsWith('auth-file:') || id.startsWith('codex-api-key:') || id.startsWith('openai-compatible:');
}

function readBrowserStorage(): DisabledSyncStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function resolveNextAccountDisabledStatus(status: string, disabled: boolean) {
  if (disabled) {
    return 'disabled';
  }
  const normalized = String(status || '').trim().toUpperCase();
  return normalized === 'DISABLED' ? 'configured' : status;
}
