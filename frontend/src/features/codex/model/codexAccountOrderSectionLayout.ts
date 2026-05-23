import type { AccountRecord } from '../../../types';
import { extractBilling, hasDisplayableBilling, hasPositiveLongestQuota } from '../../accounts/model/accountQuota.ts';
import type { CodexQuotaState } from '../../accounts/model/types';

export const CODEX_ORDER_SECTION_ACTION_MENU_GAP = 24;
export const CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY = 'gettokens.codex.account-order-display-mode';

export type CodexAccountOrderDisplayMode = 'full' | 'compact' | 'list';
export const DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE: CodexAccountOrderDisplayMode = 'compact';
export type CodexAccountOrderFilterSource = 'all' | 'codex-auth-file' | 'codex-api-key' | 'openai-compatible';
export interface CodexAccountOrderFilter {
  source: CodexAccountOrderFilterSource;
  requiresRequestable: boolean;
  requiresBlocked: boolean;
  requiresDisabled: boolean;
  hasBalance: boolean;
  hasLongestQuota: boolean;
  requiresError: boolean;
}
export const DEFAULT_CODEX_ACCOUNT_ORDER_FILTER: CodexAccountOrderFilter = {
  source: 'all',
  requiresRequestable: false,
  requiresBlocked: false,
  requiresDisabled: false,
  hasBalance: false,
  hasLongestQuota: false,
  requiresError: false,
};

interface CodexAccountOrderFilterableRow {
  id: string;
  label?: string;
  sourceKind?: CodexAccountOrderFilterSource;
  provider?: string;
  requestable?: boolean;
  disabled?: boolean;
  status?: string;
  quotaKey?: string;
}

export function shouldUseCodexOrderSectionActionMenu(containerWidth: number, inlineActionsWidth: number) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return false;
  }
  if (!Number.isFinite(inlineActionsWidth) || inlineActionsWidth <= 0) {
    return false;
  }
  return containerWidth < inlineActionsWidth + CODEX_ORDER_SECTION_ACTION_MENU_GAP;
}

export function parseCodexAccountOrderDisplayMode(value: string | null | undefined): CodexAccountOrderDisplayMode {
  if (value === 'compact' || value === 'list') {
    return value;
  }
  if (value === 'full') {
    return value;
  }
  return DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE;
}

export function normalizeCodexAccountOrderFilter(
  filter: CodexAccountOrderFilter | 'all' | null | undefined,
): CodexAccountOrderFilter {
  if (!filter || filter === 'all') {
    return { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER };
  }
  return {
    source: filter.source || DEFAULT_CODEX_ACCOUNT_ORDER_FILTER.source,
    requiresRequestable: filter.requiresRequestable === true,
    requiresBlocked: filter.requiresBlocked === true,
    requiresDisabled: filter.requiresDisabled === true,
    hasBalance: filter.hasBalance === true,
    hasLongestQuota: filter.hasLongestQuota === true,
    requiresError: filter.requiresError === true,
  };
}

export function filterCodexAccountOrderRows<T extends CodexAccountOrderFilterableRow>(
  rows: T[],
  filter: CodexAccountOrderFilter,
  codexQuotaByName: Record<string, CodexQuotaState> = {},
) {
  const normalizedFilter = normalizeCodexAccountOrderFilter(filter);
  return rows.filter((row) => {
    if (normalizedFilter.source !== 'all' && row.sourceKind !== normalizedFilter.source) {
      return false;
    }
    if (normalizedFilter.requiresRequestable && row.requestable === false) {
      return false;
    }
    if (normalizedFilter.requiresBlocked && row.requestable !== false) {
      return false;
    }
    if (normalizedFilter.requiresDisabled && !isCodexOrderRowDisabled(row)) {
      return false;
    }
    if (normalizedFilter.requiresError && !isCodexOrderRowError(row)) {
      return false;
    }
    if (normalizedFilter.hasBalance && !hasCodexOrderRowDisplayableBalance(row, codexQuotaByName)) {
      return false;
    }
    if (normalizedFilter.hasLongestQuota && !hasCodexOrderRowLongestQuota(row, codexQuotaByName)) {
      return false;
    }
    return true;
  });
}

export function getCodexAccountOrderGridClass(density: CodexAccountOrderDisplayMode) {
  if (density === 'list') {
    return 'grid gap-3 p-4';
  }
  if (density === 'full') {
    return 'codex-account-order-card-grid-full grid auto-rows-fr gap-4 p-4 xl:auto-rows-auto xl:gap-x-4 xl:gap-y-4';
  }
  return 'codex-account-order-card-grid-compact grid auto-rows-fr gap-4 p-4';
}

function hasCodexOrderRowDisplayableBalance(
  row: CodexAccountOrderFilterableRow,
  codexQuotaByName: Record<string, CodexQuotaState>,
) {
  const quotaState = codexQuotaByName[row.quotaKey || row.id];
  if (!quotaState?.quota) {
    return false;
  }
  return hasDisplayableBilling(extractBilling(quotaState.quota));
}

function hasCodexOrderRowLongestQuota(
  row: CodexAccountOrderFilterableRow,
  codexQuotaByName: Record<string, CodexQuotaState>,
) {
  if (row.sourceKind !== 'codex-auth-file') {
    return false;
  }
  const quotaState = codexQuotaByName[row.quotaKey || row.id];
  return hasPositiveLongestQuota(
    {
      id: row.id,
      provider: row.provider || 'codex',
      credentialSource: 'auth-file',
      displayName: row.label || row.id,
      status: row.status || '',
      disabled: row.disabled,
      quotaKey: row.quotaKey,
    } satisfies AccountRecord,
    quotaState,
  );
}

function isCodexOrderRowDisabled(row: CodexAccountOrderFilterableRow) {
  if (row.disabled) {
    return true;
  }
  return String(row.status || '').trim().toUpperCase() === 'DISABLED';
}

function isCodexOrderRowError(row: CodexAccountOrderFilterableRow) {
  if (isCodexOrderRowDisabled(row)) {
    return false;
  }
  const status = String(row.status || '').trim().toUpperCase();
  if (!status) {
    return row.requestable === false;
  }
  return status !== 'ACTIVE' && status !== 'CONFIGURED' && status !== 'LOCAL';
}
