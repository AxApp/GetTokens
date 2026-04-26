import type { AccountRecord, AuthFile, CodexQuota } from '../../../types';
import type { CodexQuotaState, QuotaDisplay, QuotaWindowDisplay } from './types';

export function supportsQuota(account: AccountRecord) {
  return account.credentialSource === 'auth-file' && String(account.provider || '').trim().toLowerCase() === 'codex';
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

  if (!state || state.status === 'loading') {
    return {
      status: 'loading',
      planType: '',
      windows: [],
    };
  }

  if (state.status === 'error' || !state.quota) {
    return {
      status: 'error',
      planType: '',
      windows: [],
    };
  }

  const windows = selectQuotaWindows(state.quota).map((window) => {
    const remainingPercent = normalizePercent(window.remainingPercent);
    const usedPercent = remainingPercent === null ? null : Math.max(0, 100 - remainingPercent);

    return {
      id: window.id,
      label: window.label,
      remainingPercent,
      usedLabel: usedPercent === null ? '--' : `${usedPercent}%`,
      resetLabel: window.resetLabel || '--',
      resetAtUnix: typeof window.resetAtUnix === 'number' ? window.resetAtUnix : undefined,
    };
  });

  if (windows.length === 0) {
    return {
      status: 'empty',
      planType: state.quota.planType || '',
      windows: [],
    };
  }

  return {
    status: 'success',
    planType: state.quota.planType || '',
    windows,
  };
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

export function normalizePercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
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
