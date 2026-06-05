import type { AccountRecord, AuthFile, BillingDisplay, CodexQuota } from '../../../types';
import type { CodexQuotaState, QuotaDisplay, QuotaWindowDisplay, Translator } from './types';

export function supportsQuota(account: AccountRecord) {
  const provider = String(account.provider || '').trim().toLowerCase();
  if (account.credentialSource === 'auth-file') {
    return provider === 'codex';
  }
  const hasQuotaCurl = account.quotaEnabled && Boolean(String(account.quotaCurl || '').trim());
  const hasBillingCurl = account.billingEnabled && Boolean(String(account.billingCurl || '').trim());
  return (
    account.credentialSource === 'api-key' &&
    (hasQuotaCurl || hasBillingCurl)
  );
}

export function isCodexAuthFile(account: AuthFile) {
  const provider = String(account.provider || account.type || '')
    .trim()
    .toLowerCase();
  return provider === 'codex';
}

export function buildQuotaDisplay(account: AccountRecord, state?: CodexQuotaState): QuotaDisplay {
  if (!supportsQuota(account)) {
    return {
      status: 'unsupported',
      planType: '',
      windows: [],
    };
  }

  if (!state || (state.status === 'loading' && !state.quota)) {
    return {
      status: 'loading',
      planType: '',
      windows: [],
    };
  }

  if (!state.quota) {
    return {
      status: 'error',
      planType: '',
      windows: [],
    };
  }

  const refreshing = state.refreshing || state.status === 'loading';
  const runtimeState = quotaRuntimeDisplayState(state.quota);
  const windows = selectQuotaWindows(state.quota).map((window) => {
    const remainingPercent = normalizePercent(window.remainingPercent);
    const usedPercent = remainingPercent === null ? null : Math.max(0, 100 - remainingPercent);

    return {
      id: window.id,
      label: window.label,
      remainingPercent,
      usedLabel: usedPercent === null ? '--' : `${usedPercent}%`,
      usedTokens: normalizeQuotaTokenCount(window.usedTokens),
      limitTokens: normalizeQuotaTokenCount(window.limitTokens),
      remainingTokens: normalizeQuotaTokenCount(window.remainingTokens),
      resetLabel: window.resetLabel || '--',
      resetAtUnix: typeof window.resetAtUnix === 'number' ? window.resetAtUnix : undefined,
    };
  });

  if (windows.length === 0) {
    return {
      status: 'empty',
      planType: state.quota.planType || '',
      windows: [],
      refreshing,
      ...runtimeState,
    };
  }

  return {
    status: 'success',
    planType: state.quota.planType || '',
    windows,
    refreshing,
    ...runtimeState,
  };
}

export function buildQuotaBlockBadgeLabel(quotaDisplay: QuotaDisplay, t: Translator) {
  if (!quotaDisplay.blocked) {
    return '';
  }

  const window = resolveBlockedQuotaWindow(quotaDisplay);
  const templateKey = window ? 'accounts.quota_empty_badge_with_window' : 'accounts.quota_empty_badge';
  const translated = t(templateKey);
  const fallback = window ? `${window.label} empty` : 'Quota empty';
  const baseLabel = translated === templateKey
    ? fallback
    : translated.replace('{window}', window?.label || '').trim();
  const reset = resolveBlockedQuotaReset(quotaDisplay, window);
  return reset ? `${baseLabel} · ${reset}` : baseLabel;
}

function resolveBlockedQuotaWindow(quotaDisplay: QuotaDisplay) {
  const reasons = [
    quotaDisplay.blockReason,
    ...(quotaDisplay.sources || []).map((source) => source.reason || source.source),
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  for (const window of quotaDisplay.windows) {
    if (reasons.some((reason) => quotaReasonMatchesWindow(reason, window))) {
      return window;
    }
  }

  return quotaDisplay.windows.find((window) => window.remainingPercent === 0) || null;
}

function quotaReasonMatchesWindow(reason: string, window: QuotaWindowDisplay) {
  const id = window.id.toLowerCase();
  const label = window.label.toLowerCase();
  if ((id && reason.includes(id)) || (label && reason.includes(label))) {
    return true;
  }
  if (id.includes('five-hour')) {
    return /(?:five[-_\s]?hour|5h|requests_5h|tokens_5h)/i.test(reason);
  }
  if (id.includes('weekly')) {
    return /(?:weekly|week|7d|requests_7d|tokens_week)/i.test(reason);
  }
  return false;
}

function resolveBlockedQuotaReset(quotaDisplay: QuotaDisplay, window: QuotaWindowDisplay | null) {
  if (window) {
    const reset = formatQuotaResetDisplayWithUnix(window.resetLabel, window.resetAtUnix);
    if (reset !== '--') {
      return reset;
    }
  }

  const resetValue = [
    ...(quotaDisplay.sources || []).flatMap((source) => [source.nextReset, source.expiresAt]),
    extractResetAtFromQuotaReason(quotaDisplay.blockReason),
  ].find((value) => String(value || '').trim());

  if (!resetValue) {
    return '';
  }
  return formatQuotaResetDisplay(String(resetValue));
}

function extractResetAtFromQuotaReason(reason?: string) {
  const match = String(reason || '').match(/reset\s+at\s+([^;]+)/i);
  return match?.[1]?.trim() || '';
}

export function normalizeQuotaTestDisplay(result: unknown): QuotaDisplay | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const record = result as Record<string, any>;
  const rawWindows = Array.isArray(record.windows) ? record.windows : [];
  const windows = rawWindows
    .map((window, index) => normalizeQuotaTestWindow(window, index))
    .filter((window): window is QuotaWindowDisplay => Boolean(window));

  if (windows.length === 0) {
    return undefined;
  }

  return {
    status: 'success',
    planType: String(record.planType ?? record.plan_type ?? '').trim(),
    windows,
    refreshing: false,
    blocked: Boolean(record.blocked),
    blockReason: String(record.blockReason ?? record.block_reason ?? '').trim() || undefined,
    stale: Boolean(record.stale),
    degradedReason: String(record.degradedReason ?? record.degraded_reason ?? '').trim() || undefined,
  };
}

function normalizeQuotaTestWindow(window: unknown, index: number): QuotaWindowDisplay | undefined {
  if (!window || typeof window !== 'object') {
    return undefined;
  }
  const record = window as Record<string, any>;
  const remainingPercent = normalizePercent(record.remainingPercent ?? record.remaining_percent);
  const usedPercent = remainingPercent === null ? null : Math.max(0, 100 - remainingPercent);
  const id = String(record.id ?? record.windowID ?? record.window_id ?? `test-window-${index + 1}`).trim();
  const label = String(record.label ?? record.name ?? id).trim();
  if (!label) {
    return undefined;
  }

  return {
    id: id || `test-window-${index + 1}`,
    label,
    remainingPercent,
    usedLabel: String(record.usedLabel ?? record.used_label ?? (usedPercent === null ? '--' : `${usedPercent}%`)).trim() || '--',
    usedTokens: normalizeQuotaTokenCount(record.usedTokens ?? record.used_tokens),
    limitTokens: normalizeQuotaTokenCount(record.limitTokens ?? record.limit_tokens),
    remainingTokens: normalizeQuotaTokenCount(record.remainingTokens ?? record.remaining_tokens),
    resetLabel: String(record.resetLabel ?? record.reset_label ?? '--').trim() || '--',
    resetAtUnix: normalizeQuotaResetUnix(record.resetAtUnix ?? record.reset_at_unix),
  };
}

function normalizeQuotaResetUnix(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function quotaRuntimeDisplayState(quota: CodexQuota) {
  const sources = Array.isArray((quota as any).sources)
    ? (quota as any).sources.map((source: any) => ({
        source: String(source?.source || '').trim(),
        reason: String(source?.reason || '').trim() || undefined,
        expiresAt: String(source?.expiresAt || '').trim() || undefined,
        nextReset: String(source?.nextReset || '').trim() || undefined,
      })).filter((source: { source: string }) => source.source)
    : [];
  return {
    blocked: Boolean((quota as any).blocked),
    blockReason: String((quota as any).blockReason || '').trim() || undefined,
    stale: Boolean((quota as any).stale),
    degradedReason: String((quota as any).degradedReason || '').trim() || undefined,
    sources,
  };
}

export function beginQuotaRefreshState(current?: CodexQuotaState): CodexQuotaState {
  if (current?.quota) {
    return {
      ...current,
      refreshing: true,
    };
  }

  return { status: 'loading' };
}

export function failQuotaRefreshState(current?: CodexQuotaState, error?: unknown): CodexQuotaState {
  if (current?.quota) {
    const reason = quotaRefreshFailureReason(error);
    const existingReason = String((current.quota as any).degradedReason || '').trim();
    const degradedReason = reason
      ? existingReason && !existingReason.includes(reason)
        ? `${existingReason}; ${reason}`
        : existingReason || reason
      : existingReason;

    return {
      ...current,
      status: 'success',
      refreshing: false,
      quota: {
        ...current.quota,
        status: 'stale',
        stale: true,
        degradedReason: degradedReason || 'Quota refresh failed.',
      } as CodexQuota,
    };
  }

  return { status: 'error' };
}

function quotaRefreshFailureReason(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }
  if (typeof error === 'string') {
    return error.trim();
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '').trim();
  }
  return '';
}

export function selectQuotaWindows(quota: CodexQuota) {
  const preferredWindows = quota.windows.filter(
    (window) =>
      window.id === 'five-hour' ||
      window.id === 'weekly' ||
      window.id.endsWith('-five-hour') ||
      window.id.endsWith('-weekly')
  );
  return preferredWindows.length > 0 ? preferredWindows : quota.windows.slice(0, 2);
}

export function selectLongestQuotaWindow(windows: QuotaWindowDisplay[]) {
  if (windows.length === 0) {
    return null;
  }
  if (windows.length === 1) {
    return windows[0];
  }
  return [...windows].reverse().find((window) => window.id === 'weekly' || window.id.endsWith('-weekly')) || windows[windows.length - 1];
}

export function hasPositiveLongestQuota(account: AccountRecord, state?: CodexQuotaState) {
  if (!supportsQuota(account)) {
    return false;
  }

  const quotaDisplay = buildQuotaDisplay(account, state);
  if (quotaDisplay.status !== 'success') {
    return false;
  }

  const longestWindow = selectLongestQuotaWindow(quotaDisplay.windows);
  return typeof longestWindow?.remainingPercent === 'number' && longestWindow.remainingPercent > 0;
}

export function extractBilling(quota: CodexQuota): BillingDisplay | undefined {
  const billing = (quota as any).billing;
  if (!billing?.isAvailable || !billing.balanceInfos?.length) return undefined;
  return {
    isAvailable: billing.isAvailable,
    balances: billing.balanceInfos.map((info: any) => ({
      currency: info.currency ?? '',
      totalBalance: info.totalBalance ?? '0',
      grantedBalance: info.grantedBalance ?? '0',
      toppedUpBalance: info.toppedUpBalance ?? '0',
    })),
  };
}

export function hasDisplayableBilling(billing?: BillingDisplay) {
  return Boolean(billing?.isAvailable && billing.balances?.length);
}

export function normalizePercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeQuotaTokenCount(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return undefined;
  }
  return Math.round(value);
}

export function createPlaceholderWindows(): QuotaWindowDisplay[] {
  return [
    { id: 'placeholder-five-hour', label: '5H', remainingPercent: null, usedLabel: '--', resetLabel: '--', resetAtUnix: 0 },
    { id: 'placeholder-weekly', label: '7D', remainingPercent: null, usedLabel: '--', resetLabel: '--', resetAtUnix: 0 },
  ];
}

export function formatQuotaResetRelative(value: string, resetAtUnix?: number) {
  const date = resolveQuotaResetDate(value, resetAtUnix);
  if (!date || Number.isNaN(date.getTime())) {
    return '--';
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return '0s';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const parts: string[] = [];
  if (diffDay > 0) parts.push(`${diffDay}d`);
  if (diffHour % 24 > 0) parts.push(`${diffHour % 24}h`);
  if (diffDay === 0 && diffMin % 60 > 0) parts.push(`${diffMin % 60}m`);

  if (parts.length === 0) {
    return `${Math.max(1, diffSec)}s`;
  }
  return parts.slice(0, 2).join(', ');
}

export function formatQuotaResetDisplay(value: string) {
  return formatQuotaResetDisplayWithUnix(value, 0);
}

export function formatQuotaResetDisplayWithUnix(value: string, resetAtUnix?: number) {
  const parsed = resolveQuotaResetDate(value, resetAtUnix);
  if (parsed && !Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hour = String(parsed.getHours()).padStart(2, '0');
    const minute = String(parsed.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') {
    return '--';
  }

  return trimmed.replace(/^重置于\s*/u, '').replace(/^reset\s*/iu, '').trim();
}

export function resolveQuotaResetDate(value: string, resetAtUnix?: number) {
  if (typeof resetAtUnix === 'number' && Number.isFinite(resetAtUnix) && resetAtUnix > 0) {
    return new Date(resetAtUnix * 1000);
  }
  return parseQuotaResetDate(value);
}

export function parseQuotaResetDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') {
    return null;
  }

  const normalized = trimmed.replace(/^重置于\s*/u, '').replace(/^reset\s*/iu, '').trim();
  const chineseMatch = normalized.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(上午|下午)?(\d{1,2}):(\d{2})/);
  if (chineseMatch) {
    const [, year, month, day, meridiem, rawHour, minute] = chineseMatch;
    let hour = Number(rawHour);
    if (meridiem === '下午' && hour < 12) hour += 12;
    if (meridiem === '上午' && hour === 12) hour = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute));
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}
