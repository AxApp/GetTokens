import type { AccountRecord } from '../../../types';
import { ACCOUNT_LIST_CACHE_STORAGE_KEY } from './accountListCache.ts';
import { ACCOUNT_QUOTA_CACHE_STORAGE_KEY } from './accountQuotaCache.ts';
import type { CodexQuotaState } from './types';

export const ACCOUNT_DIAGNOSTICS_VISIBLE_ID_LIMIT = 8;

type ReadableStorage = Pick<Storage, 'getItem'>;

export interface AccountDiagnosticsSnapshot {
  origin: string;
  href: string;
  hasWailsBindings: boolean;
  sidecarCode: string;
  sidecarPort: string;
  accountCount: number;
  filteredAccountCount: number;
  runtimeSyncTargetCount: number;
  visibleRuntimeSyncTargetIDs: string[];
  hiddenRuntimeSyncTargetCount: number;
  quotaStateCount: number;
  quotaCacheCount: number;
  quotaCacheUpdatedAt: number | null;
  listCacheCount: number;
  listCacheUpdatedAt: number | null;
  targetAccountID: string;
  targetAccountName: string;
  targetRuntimeStatus: string;
  targetRuntimeBlocked: boolean;
  targetCacheStatus: string;
  targetCacheBlocked: boolean;
}

export function buildAccountDiagnosticsSnapshot(input: {
  href?: string;
  origin?: string;
  hasWailsBindings: boolean;
  sidecarCode?: string;
  sidecarPort?: number | string;
  accounts: AccountRecord[];
  filteredAccounts: AccountRecord[];
  runtimeSyncTargetAccountIDs: string[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  storage?: ReadableStorage | null;
  targetAccountID?: string;
}): AccountDiagnosticsSnapshot {
  const storageSummary = readAccountDiagnosticsStorage(input.storage);
  const targetAccountID = String(input.targetAccountID || '').trim();
  const targetAccount = targetAccountID
    ? input.accounts.find((account) => account.id === targetAccountID || account.quotaKey === targetAccountID)
    : undefined;
  const targetQuotaKey = String(targetAccount?.quotaKey || targetAccountID).trim();
  const runtimeQuota = targetQuotaKey ? input.codexQuotaByName[targetQuotaKey]?.quota : undefined;
  const cachedQuota = targetQuotaKey ? storageSummary.quotaItems[targetQuotaKey]?.quota : undefined;
  const visibleRuntimeSyncTargetIDs = input.runtimeSyncTargetAccountIDs.slice(0, ACCOUNT_DIAGNOSTICS_VISIBLE_ID_LIMIT);

  return {
    origin: input.origin || originFromHref(input.href),
    href: input.href || '',
    hasWailsBindings: input.hasWailsBindings,
    sidecarCode: String(input.sidecarCode || '').trim() || 'unknown',
    sidecarPort: String(input.sidecarPort || '').trim() || 'unknown',
    accountCount: input.accounts.length,
    filteredAccountCount: input.filteredAccounts.length,
    runtimeSyncTargetCount: input.runtimeSyncTargetAccountIDs.length,
    visibleRuntimeSyncTargetIDs,
    hiddenRuntimeSyncTargetCount: Math.max(0, input.runtimeSyncTargetAccountIDs.length - visibleRuntimeSyncTargetIDs.length),
    quotaStateCount: Object.keys(input.codexQuotaByName).length,
    quotaCacheCount: storageSummary.quotaCacheCount,
    quotaCacheUpdatedAt: storageSummary.quotaCacheUpdatedAt,
    listCacheCount: storageSummary.listCacheCount,
    listCacheUpdatedAt: storageSummary.listCacheUpdatedAt,
    targetAccountID,
    targetAccountName: targetAccount?.displayName || targetAccount?.name || '',
    targetRuntimeStatus: runtimeQuota?.status || input.codexQuotaByName[targetQuotaKey]?.status || '',
    targetRuntimeBlocked: Boolean(runtimeQuota?.blocked),
    targetCacheStatus: cachedQuota?.status || '',
    targetCacheBlocked: Boolean(cachedQuota?.blocked),
  };
}

export function readAccountDiagnosticsStorage(storage?: ReadableStorage | null) {
  const listCache = parseStorageJSON(storage?.getItem(ACCOUNT_LIST_CACHE_STORAGE_KEY));
  const quotaCache = parseStorageJSON(storage?.getItem(ACCOUNT_QUOTA_CACHE_STORAGE_KEY));
  const quotaItems = quotaCache && typeof quotaCache.items === 'object' && quotaCache.items !== null
    ? quotaCache.items as Record<string, { quota?: { status?: string; blocked?: boolean }; updatedAt?: number }>
    : {};
  const quotaUpdatedValues = Object.values(quotaItems)
    .map((item) => Number(item?.updatedAt || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    listCacheCount: Array.isArray(listCache?.items) ? listCache.items.length : 0,
    listCacheUpdatedAt: numberOrNull(listCache?.updatedAt),
    quotaCacheCount: Object.keys(quotaItems).length,
    quotaCacheUpdatedAt: quotaUpdatedValues.length > 0 ? Math.max(...quotaUpdatedValues) : null,
    quotaItems,
  };
}

function parseStorageJSON(raw: string | null | undefined): any {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function originFromHref(href: string | undefined) {
  if (!href) {
    return '';
  }
  try {
    return new URL(href).origin;
  } catch {
    return '';
  }
}
