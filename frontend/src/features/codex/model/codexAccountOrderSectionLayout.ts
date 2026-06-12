import type { AccountRecord } from '../../../types';
import { extractBilling, hasDisplayableBilling, hasPositiveLongestQuota } from '../../accounts/model/accountQuota.ts';
import type { CodexQuotaState } from '../../accounts/model/types';

export const CODEX_ORDER_SECTION_ACTION_MENU_GAP = 24;
export const CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY = 'gettokens.codex.account-order-display-mode';

export type CodexAccountOrderDisplayMode = 'full' | 'list';
export type CodexOrderSectionActionLayout = 'inline' | 'wrapped' | 'menu';
export const DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE: CodexAccountOrderDisplayMode = 'full';
export type CodexAccountOrderFilterSource = 'all' | 'codex-auth-file' | 'codex-api-key' | 'openai-compatible';
export type CodexAccountOrderFilterPresetID =
  | 'all'
  | 'participating'
  | 'requestable'
  | 'blocked'
  | 'openai-compatible'
  | 'with-balance';
export interface CodexAccountOrderFilterSummaryPart {
  kind: 'route' | 'status' | 'resource' | 'source';
  id:
    | 'participating'
    | 'skipped'
    | 'requestable'
    | 'blocked'
    | 'disabled'
    | 'error'
    | 'balance'
    | 'longest-quota'
    | CodexAccountOrderFilterSource;
  label: string;
}
export interface CodexAccountOrderFilter {
  source: CodexAccountOrderFilterSource;
  requiresParticipating: boolean;
  requiresSkipped: boolean;
  requiresRequestable: boolean;
  requiresBlocked: boolean;
  requiresDisabled: boolean;
  hasBalance: boolean;
  hasLongestQuota: boolean;
  requiresError: boolean;
}
export const DEFAULT_CODEX_ACCOUNT_ORDER_FILTER: CodexAccountOrderFilter = {
  source: 'all',
  requiresParticipating: false,
  requiresSkipped: false,
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
  baseUrl?: string;
  prefix?: string;
  keySuffix?: string;
  name?: string;
  email?: string;
  planType?: string;
  proxyUrl?: string;
  supportedFormats?: readonly string[];
  apiKeys?: readonly string[];
  headers?: Record<string, string>;
  modelMappings?: readonly { realModel?: string; codexModel?: string }[];
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

export function chooseCodexOrderSectionActionLayout({
  headerWidth,
  titleWidth,
  inlineActionsWidth,
}: {
  headerWidth: number;
  titleWidth: number;
  inlineActionsWidth: number;
}): CodexOrderSectionActionLayout {
  if (
    !Number.isFinite(headerWidth) ||
    headerWidth <= 0 ||
    !Number.isFinite(inlineActionsWidth) ||
    inlineActionsWidth <= 0
  ) {
    return 'menu';
  }
  const safeTitleWidth = Number.isFinite(titleWidth) && titleWidth > 0 ? titleWidth : 0;
  const spacing = CODEX_ORDER_SECTION_ACTION_MENU_GAP;
  if (headerWidth >= safeTitleWidth + inlineActionsWidth + spacing) {
    return 'inline';
  }
  if (headerWidth >= inlineActionsWidth + spacing) {
    return 'wrapped';
  }
  return 'menu';
}

export function parseCodexAccountOrderDisplayMode(value: string | null | undefined): CodexAccountOrderDisplayMode {
  if (value === 'list') {
    return value;
  }
  if (value === 'full') {
    return value;
  }
  return DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE;
}

function resolveCodexAccountOrderFilterSource(
  value: unknown,
): CodexAccountOrderFilterSource {
  return value === 'all' || value === 'codex-auth-file' || value === 'codex-api-key' || value === 'openai-compatible'
    ? value
    : 'all';
}

export function normalizeCodexAccountOrderFilter(
  filter: CodexAccountOrderFilter | 'all' | null | undefined,
): CodexAccountOrderFilter {
  if (!filter || filter === 'all') {
    return { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER };
  }
  return {
    source: resolveCodexAccountOrderFilterSource(filter.source),
    requiresParticipating: filter.requiresParticipating === true,
    requiresSkipped: filter.requiresSkipped === true,
    requiresRequestable: filter.requiresRequestable === true,
    requiresBlocked: filter.requiresBlocked === true,
    requiresDisabled: filter.requiresDisabled === true,
    hasBalance: filter.hasBalance === true,
    hasLongestQuota: filter.hasLongestQuota === true,
    requiresError: filter.requiresError === true,
  };
}

export function applyCodexAccountOrderFilter(
  base: CodexAccountOrderFilter,
  patch: Partial<CodexAccountOrderFilter>,
): CodexAccountOrderFilter {
  return normalizeCodexAccountOrderFilter({
    ...base,
    ...patch,
  });
}

export function buildCodexAccountOrderFilterPresetState(
  preset: CodexAccountOrderFilterPresetID,
  current: CodexAccountOrderFilter = DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
): CodexAccountOrderFilter {
  const normalizedFilter = normalizeCodexAccountOrderFilter(current);
  if (preset === 'all') {
    return { ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER };
  }
  if (preset === 'participating') {
    return applyCodexAccountOrderFilter(normalizedFilter, {
      requiresParticipating: true,
      requiresSkipped: false,
    });
  }
  if (preset === 'requestable') {
    return applyCodexAccountOrderFilter(normalizedFilter, {
      requiresRequestable: true,
      requiresBlocked: false,
      requiresDisabled: false,
      requiresError: false,
    });
  }
  if (preset === 'blocked') {
    return applyCodexAccountOrderFilter(normalizedFilter, {
      requiresRequestable: false,
      requiresBlocked: true,
    });
  }
  if (preset === 'openai-compatible') {
    return applyCodexAccountOrderFilter(normalizedFilter, {
      source: 'openai-compatible',
    });
  }
  return applyCodexAccountOrderFilter(normalizedFilter, {
    hasBalance: true,
  });
}

export function removeCodexAccountOrderFilterSummaryPart(
  filter: CodexAccountOrderFilter,
  part: CodexAccountOrderFilterSummaryPart,
): CodexAccountOrderFilter {
  if (part.kind === 'source') {
    return applyCodexAccountOrderFilter(filter, { source: 'all' });
  }

  if (part.id === 'participating') {
    return applyCodexAccountOrderFilter(filter, { requiresParticipating: false });
  }
  if (part.id === 'skipped') {
    return applyCodexAccountOrderFilter(filter, { requiresSkipped: false });
  }
  if (part.id === 'requestable') {
    return applyCodexAccountOrderFilter(filter, { requiresRequestable: false });
  }
  if (part.id === 'blocked') {
    return applyCodexAccountOrderFilter(filter, { requiresBlocked: false });
  }
  if (part.id === 'disabled') {
    return applyCodexAccountOrderFilter(filter, { requiresDisabled: false });
  }
  if (part.id === 'error') {
    return applyCodexAccountOrderFilter(filter, { requiresError: false });
  }
  if (part.id === 'balance') {
    return applyCodexAccountOrderFilter(filter, { hasBalance: false });
  }
  if (part.id === 'longest-quota') {
    return applyCodexAccountOrderFilter(filter, { hasLongestQuota: false });
  }

  return normalizeCodexAccountOrderFilter(filter);
}

export function summarizeCodexAccountOrderFilter(
  t: (key: string) => string,
  filter: CodexAccountOrderFilter,
): CodexAccountOrderFilterSummaryPart[] {
  const normalizedFilter = normalizeCodexAccountOrderFilter(filter);
  const parts: CodexAccountOrderFilterSummaryPart[] = [];

  if (normalizedFilter.requiresParticipating) {
    parts.push({ kind: 'route', id: 'participating', label: t('codex.account_list_filter_participating_match') });
  }
  if (normalizedFilter.requiresSkipped) {
    parts.push({ kind: 'route', id: 'skipped', label: t('codex.account_list_filter_skipped_match') });
  }
  if (normalizedFilter.requiresRequestable) {
    parts.push({ kind: 'status', id: 'requestable', label: t('codex.account_list_filter_requestable_match') });
  }
  if (normalizedFilter.requiresBlocked) {
    parts.push({ kind: 'status', id: 'blocked', label: t('codex.account_list_filter_blocked_match') });
  }
  if (normalizedFilter.requiresDisabled) {
    parts.push({ kind: 'status', id: 'disabled', label: t('codex.account_list_filter_disabled_match') });
  }
  if (normalizedFilter.requiresError) {
    parts.push({ kind: 'status', id: 'error', label: t('codex.account_list_filter_error_match') });
  }
  if (normalizedFilter.hasBalance) {
    parts.push({ kind: 'resource', id: 'balance', label: t('codex.account_list_filter_balance_match') });
  }
  if (normalizedFilter.hasLongestQuota) {
    parts.push({ kind: 'resource', id: 'longest-quota', label: t('codex.account_list_filter_longest_quota_match') });
  }
  if (normalizedFilter.source === 'codex-auth-file') {
    parts.push({ kind: 'source', id: 'codex-auth-file', label: t('codex.account_list_source_auth_file') });
  }
  if (normalizedFilter.source === 'codex-api-key') {
    parts.push({ kind: 'source', id: 'codex-api-key', label: t('codex.account_list_source_api_key') });
  }
  if (normalizedFilter.source === 'openai-compatible') {
    parts.push({ kind: 'source', id: 'openai-compatible', label: t('codex.account_list_source_openai_compatible') });
  }

  return parts;
}

export function filterCodexAccountOrderRows<T extends CodexAccountOrderFilterableRow>(
  rows: T[],
  filter: CodexAccountOrderFilter,
  codexQuotaByName: Record<string, CodexQuotaState> = {},
  query = '',
  routePolicyRowStates: Record<string, { participates?: boolean } | undefined> = {},
) {
  const normalizedFilter = normalizeCodexAccountOrderFilter(filter);
  const normalizedQuery = normalizeCodexOrderSearchQuery(query);
  return rows.filter((row) => {
    if (normalizedFilter.source !== 'all' && row.sourceKind !== normalizedFilter.source) {
      return false;
    }
    if (normalizedFilter.requiresParticipating && routePolicyRowStates[row.id]?.participates !== true) {
      return false;
    }
    if (normalizedFilter.requiresSkipped && routePolicyRowStates[row.id]?.participates !== false) {
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
    if (normalizedQuery && !buildCodexOrderRowSearchText(row).includes(normalizedQuery)) {
      return false;
    }
    return true;
  });
}

export function getCodexAccountOrderGridClass(density: CodexAccountOrderDisplayMode) {
  if (density === 'list') {
    return 'grid grid-cols-1 gap-3 pt-4';
  }
  return 'account-card-grid-full grid gap-8 pt-4';
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

function normalizeCodexOrderSearchQuery(query: string) {
  return String(query || '').trim().toLowerCase();
}

function buildCodexOrderRowSearchText(row: CodexAccountOrderFilterableRow) {
  const values = [
    row.id,
    row.label,
    row.sourceKind,
    row.provider,
    row.status,
    row.baseUrl,
    row.prefix,
    row.keySuffix,
    row.name,
    row.email,
    row.planType,
    row.proxyUrl,
    ...(row.supportedFormats || []),
    ...(row.apiKeys || []),
    ...Object.keys(row.headers || {}),
    ...Object.values(row.headers || {}),
    ...(row.modelMappings || []).flatMap((mapping) => [mapping.realModel, mapping.codexModel]),
  ];

  return values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join('\n');
}
