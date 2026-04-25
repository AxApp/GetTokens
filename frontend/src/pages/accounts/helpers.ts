import type { main } from '../../../wailsjs/go/models';
import type { AccountRecord, AuthFile, CodexQuota, CredentialSource } from '../../types';
import type { AccountGroup, CodexQuotaState, QuotaDisplay, QuotaWindowDisplay, Translator } from './types';

export const API_KEY_LABELS_STORAGE_KEY = 'gettokens.apiKeyLabels';

export const emptyApiKeyForm = {
  label: '',
  apiKey: '',
  baseUrl: '',
  prefix: '',
};

export function compareAccountRecords(left: AccountRecord, right: AccountRecord) {
  return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
}

export function groupAccountsByPlan(
  accounts: AccountRecord[],
  codexQuotaByName: Record<string, CodexQuotaState>,
  t: Translator
): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();

  for (const account of accounts) {
    const quotaDisplay = buildQuotaDisplay(account, codexQuotaByName[account.quotaKey || '']);
    const label = resolvePlanGroupLabel(account, quotaDisplay, t);
    const id = label.toLowerCase();
    const existing = groups.get(id);
    if (existing) {
      existing.accounts.push(account);
      continue;
    }
    groups.set(id, {
      id,
      label,
      rank: planGroupRank(label),
      accounts: [account],
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
  });
}

export function sourceLabel(t: Translator, source: CredentialSource) {
  return source === 'auth-file' ? t('accounts.source_auth_file') : t('accounts.source_api_key');
}

export function providerLabel(account: AccountRecord) {
  return String(account.provider || 'unknown').trim().toUpperCase();
}

export function mapAuthFileToRecord(account: AuthFile): AccountRecord {
  const provider = String(account.provider || account.type || 'unknown').trim().toLowerCase() || 'unknown';
  return {
    id: `auth-file:${account.name}`,
    provider,
    credentialSource: 'auth-file',
    displayName: account.name,
    status: String(account.status || 'active').trim().toUpperCase() || 'ACTIVE',
    disabled: account.disabled,
    email: account.email,
    planType: account.planType,
    name: account.name,
    quotaKey: account.name,
    rawAuthFile: account,
  };
}

export function mapBackendAccountRecord(account: main.AccountRecord, apiKeyLabels: Record<string, string>): AccountRecord {
  const credentialSource = account.credentialSource === 'api-key' ? 'api-key' : 'auth-file';
  const storageKey =
    credentialSource === 'api-key'
      ? buildAPIKeyLabelStorageKey(account.apiKey || '', account.baseUrl || '', account.prefix || '')
      : '';
  const localDisplayName = storageKey ? apiKeyLabels[storageKey] : '';

  return {
    ...account,
    displayName: localDisplayName || account.displayName,
    credentialSource,
  };
}

export function supportsQuota(account: AccountRecord) {
  return account.credentialSource === 'auth-file' && providerLabel(account).toLowerCase() === 'codex';
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

export function resolveAccountPlanLabel(account: AccountRecord, quotaDisplay: QuotaDisplay) {
  const plan = String(quotaDisplay.planType || account.planType || '')
    .trim()
    .toUpperCase();
  return plan || '';
}

export function resolveAccountPrimaryLabel(account: AccountRecord) {
  if (account.credentialSource === 'auth-file') {
    const primary = String(account.email || account.displayName || '').trim();
    if (primary) {
      return primary;
    }
  }
  return account.displayName;
}

export function fallbackAPIKeyDisplayName(apiKey: string) {
  const suffix = apiKey.trim().slice(-4);
  return suffix ? `CODEX API KEY · ${suffix}` : 'CODEX API KEY';
}

export function resolvePlanGroupLabel(account: AccountRecord, quotaDisplay: QuotaDisplay, t: Translator) {
  if (account.credentialSource === 'api-key') {
    return t('accounts.plan_group_api_key');
  }
  const label = resolveAccountPlanLabel(account, quotaDisplay);
  return label || t('accounts.plan_group_none');
}

export function groupProviderLabel(accounts: AccountRecord[]) {
  if (accounts.length === 0) {
    return 'UNKNOWN';
  }
  return providerLabel(accounts[0]);
}

export function planGroupRank(label: string) {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'API KEY') return 5;
  if (normalized === 'PRO') return 0;
  if (normalized === 'PLUS') return 1;
  if (normalized === 'FREE') return 2;
  if (normalized === 'TEAM') return 3;
  if (normalized === 'ENTERPRISE') return 4;
  return 9;
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

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function normalizePrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^\/+|\/+$/g, '');
}

export function formatCompactBaseUrl(value?: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '--';
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}`;
  } catch {
    return trimmed;
  }
}

function quoteYAMLString(value: string) {
  return JSON.stringify(value);
}

function normalizeManagedProviderID(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveManagedProviderID(
  draft: {
    baseUrl?: string;
    prefix?: string;
  }
) {
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || '<FILL_BASE_URL>';
  const prefix = normalizePrefix(String(draft.prefix || ''));
  const host = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return '';
    }
  })();
  return normalizeManagedProviderID(prefix || host || 'provider-relay') || 'provider-relay';
}

export function buildManagedAuthJSONSnippet(
  draft: {
    apiKey?: string;
    baseUrl?: string;
  }
) {
  const apiKey = String(draft.apiKey || '').trim() || '<FILL_API_KEY>';
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || '<FILL_BASE_URL>';

  const payload: Record<string, unknown> = {
    auth_mode: 'apikey',
    OPENAI_API_KEY: apiKey,
    base_url: baseUrl,
  };

  return JSON.stringify(payload, null, 2);
}

export function buildManagedConfigTomlSnippet(
  draft: {
    baseUrl?: string;
    prefix?: string;
  }
) {
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || '<FILL_BASE_URL>';
  const providerID = resolveManagedProviderID(draft);

  const lines = [
    `model = ${quoteYAMLString('gpt-5.4')}`,
    `model_reasoning_effort = ${quoteYAMLString('high')}`,
    `model_provider = ${quoteYAMLString(providerID)}`,
    '',
    `[model_providers.${providerID}]`,
    `name = ${quoteYAMLString(providerID)}`,
    `base_url = ${quoteYAMLString(baseUrl)}`,
    'requires_openai_auth = true',
    `wire_api = ${quoteYAMLString('responses')}`,
  ];

  return lines.join('\n');
}

export function parseMaybeJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function decodeBase64Utf8(value: string) {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildAPIKeyLabelStorageKey(apiKey: string, baseUrl: string, prefix: string) {
  return JSON.stringify({
    apiKey: apiKey.trim(),
    baseUrl: normalizeBaseUrl(baseUrl),
    prefix: normalizePrefix(prefix),
  });
}

export function loadAPIKeyLabels() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(API_KEY_LABELS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function persistAPIKeyLabels(labels: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(API_KEY_LABELS_STORAGE_KEY, JSON.stringify(labels));
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
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
