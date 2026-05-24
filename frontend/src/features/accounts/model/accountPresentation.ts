import type { main } from '../../../../wailsjs/go/models';
import type { AccountRecord, ApiFormat, AuthFile, CredentialSource } from '../../../types';
import type { AccountUsageSummary } from './accountUsage';
import type { AccountStabilitySummary, QuotaDisplay, Translator } from './types';
import { formatLabel, formatShortLabel } from './vendorPresetHelpers.ts';

export interface AccountAttributionBadge {
  label: string;
  shortLabel?: string;
  backgroundColor?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
}

function resolveSupportedFormats(provider: string): ApiFormat[] {
  switch (provider.trim().toLowerCase()) {
    case 'codex':
    case 'openai':
      return ['anthropic', 'openai_responses'];
    case 'deepseek':
    case 'zhipu':
    case 'glm':
    case 'kimi':
    case 'moonshot':
    case 'stepfun':
    case 'minimax':
    case 'doubao':
    case 'longcat':
    case 'xiaomimimo':
    case 'mimo':
    case 'bailian':
    case 'dashscope':
    case 'modelscope':
    case 'bailing':
    case 'ling':
    case 'siliconflow':
    case 'openrouter':
    case 'therouter':
      return ['anthropic', 'openai_chat'];
    case 'gemini':
    case 'google':
      return ['gemini_native'];
    case 'copilot':
    case 'github':
      return ['openai_chat'];
    default:
      return ['anthropic'];
  }
}

export function compareAccountRecords(left: AccountRecord, right: AccountRecord) {
  if (left.credentialSource === 'api-key' && right.credentialSource === 'api-key') {
    const leftPriority = Number(left.priority || 0);
    const rightPriority = Number(right.priority || 0);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }
  }
  return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
}

export function sourceLabel(t: Translator, source: CredentialSource) {
  return source === 'auth-file' ? t('accounts.source_auth_file') : t('accounts.source_api_key');
}

export function providerLabel(account: AccountRecord) {
  return String(account.provider || 'unknown').trim().toUpperCase();
}

function replaceProviderPlaceholder(template: string, provider: string) {
  return template.replace('{provider}', provider);
}

export function resolveAccountSourceHeading(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.source_api_key_with_provider'), providerLabel(account));
}

export function resolveAccountProviderConfigHeading(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.provider_config_with_provider'), providerLabel(account));
}

export function resolveAccountConfigurationWorkspaceHeading(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.configuration_workspace_with_provider'), providerLabel(account));
}

export function resolveAccountAPIKeyPlainNotice(account: AccountRecord, t: Translator) {
  return replaceProviderPlaceholder(t('accounts.api_key_plain_notice_with_provider'), providerLabel(account));
}

export function mapAuthFileToRecord(account: AuthFile): AccountRecord {
  const provider = String(account.provider || account.type || 'unknown').trim().toLowerCase() || 'unknown';
  return {
    id: `auth-file:${account.name}`,
    provider,
    credentialSource: 'auth-file',
    displayName: account.name,
    status: String(account.status || 'active').trim().toUpperCase() || 'ACTIVE',
    statusMessage: String(account.statusMessage || '').trim(),
    priority: account.priority,
    disabled: account.disabled,
    email: account.email,
    planType: account.planType,
    name: account.name,
    authIndex: account.authIndex,
    quotaKey: account.name,
    rawAuthFile: account,
    supportedFormats: resolveSupportedFormats(provider),
  };
}

export function resolveLoadedAuthFileRecords(files: AuthFile[], mappedAccounts: AccountRecord[]) {
  if (files.length > 0) {
    return files.map((account) => mapAuthFileToRecord(account));
  }
  return mappedAccounts.filter((account) => account.credentialSource === 'auth-file');
}

export function resolveLoadedAccountIDs(authFileRecords: AccountRecord[], apiKeyAccounts: AccountRecord[]) {
  return [...authFileRecords.map((account) => account.id), ...apiKeyAccounts.map((account) => account.id)];
}

export function mapBackendAccountRecord(account: main.AccountRecord): AccountRecord {
  const credentialSource = account.credentialSource === 'api-key' ? 'api-key' : 'auth-file';
  let supportedFormats = (account.supportedFormats || []) as AccountRecord['supportedFormats'];

  // If backend returned codex defaults but base URL matches a known vendor, override
  if (credentialSource === 'api-key' && account.provider === 'codex') {
    const inferredProvider = inferProviderFromBaseURL(account.baseUrl);
    if (inferredProvider) {
      account.provider = inferredProvider;
      supportedFormats = resolveSupportedFormats(inferredProvider) as AccountRecord['supportedFormats'];
    }
  }

  return {
    ...account,
    credentialSource,
    supportedFormats,
    formatBaseUrls: (account.formatBaseUrls || {}) as AccountRecord['formatBaseUrls'],
  };
}

function inferProviderFromBaseURL(baseUrl?: string): string | null {
  if (!baseUrl) return null;
  const normalized = baseUrl.toLowerCase();
  if (normalized.includes('deepseek')) return 'deepseek';
  if (normalized.includes('bigmodel') || normalized.includes('zhipu')) return 'zhipu';
  if (normalized.includes('moonshot') || normalized.includes('kimi')) return 'kimi';
  if (normalized.includes('stepfun')) return 'stepfun';
  if (normalized.includes('dashscope') || normalized.includes('bailian')) return 'bailian';
  if (normalized.includes('minimax') || normalized.includes('minimaxi')) return 'minimax';
  if (normalized.includes('volces') || normalized.includes('doubao')) return 'doubao';
  if (normalized.includes('longcat')) return 'longcat';
  if (normalized.includes('xiaomimimo') || normalized.includes('mimo')) return 'xiaomimimo';
  if (normalized.includes('tbox')) return 'bailing';
  if (normalized.includes('openrouter')) return 'openrouter';
  if (normalized.includes('siliconflow')) return 'siliconflow';
  if (normalized.includes('novita')) return 'novita';
  if (normalized.includes('openai.com')) return 'openai';
  if (normalized.includes('groq')) return 'groq';
  if (normalized.includes('together')) return 'together';
  if (normalized.includes('nvidia')) return 'nvidia';
  if (normalized.includes('copilot') || normalized.includes('githubcopilot')) return 'copilot';
  if (normalized.includes('generativelanguage') || normalized.includes('googleapis')) return 'gemini';
  if (normalized.includes('aihubmix')) return 'aihubmix';
  if (normalized.includes('shengsuanyun')) return 'shengsuanyun';
  if (normalized.includes('modelscope')) return 'modelscope';
  if (normalized.includes('modelverse') || normalized.includes('compshare')) return 'compshare';
  if (normalized.includes('therouter')) return 'therouter';
  return null;
}

export function resolveAccountFailureReason(account: AccountRecord) {
  const status = String(account.status || '')
    .trim()
    .toUpperCase();
  if (status === 'ACTIVE' || status === 'CONFIGURED' || status === 'DISABLED' || status === 'LOCAL') {
    return '';
  }
  return String(account.statusMessage || account.rawAuthFile?.statusMessage || '')
    .trim();
}

export function buildAccountDetailStatusMessage(account: AccountRecord, t: Translator) {
  const status = String(account.localOnly ? 'LOCAL' : account.status || '')
    .trim()
    .toUpperCase();
  if (status === 'ACTIVE' || status === 'CONFIGURED' || status === 'DISABLED' || status === 'LOCAL') {
    return null;
  }

  return {
    title: t('accounts.detail_error_title'),
    body: resolveAccountFailureReason(account) || t('accounts.detail_error_fallback'),
    tone: 'danger' as const,
  };
}

export function resolveAccountStatusTone(account: AccountRecord) {
  const status = String(account.localOnly ? 'LOCAL' : account.status || '')
    .trim()
    .toUpperCase();

  if (status === 'ACTIVE' || status === 'CONFIGURED' || status === 'LOCAL') {
    return 'positive';
  }
  if (status === 'DISABLED') {
    return 'warning';
  }
  return 'danger';
}

export function resolveAccountOperationalState(
  account: AccountRecord,
  usageSummary: AccountUsageSummary | undefined,
  quotaDisplay: QuotaDisplay | undefined,
  t: Translator,
) {
  if (usageSummary?.success && usageSummary.success > 0) {
    return {
      tone: 'positive' as const,
      label: t('accounts.status_available'),
    };
  }

  if (account.credentialSource === 'auth-file' && quotaDisplay?.status === 'success') {
    return {
      tone: 'positive' as const,
      label: t('accounts.status_available'),
    };
  }

  if (usageSummary?.hasData && usageSummary.failure > 0) {
    return {
      tone: 'danger' as const,
      label: t('accounts.status_error_display'),
    };
  }

  const status = String(account.localOnly ? 'LOCAL' : account.status || '')
    .trim()
    .toUpperCase();

  if (status === 'DISABLED') {
    return {
      tone: 'warning' as const,
      label: t('accounts.status_disabled_display'),
    };
  }

  if (status === 'LOCAL') {
    return {
      tone: 'warning' as const,
      label: t('accounts.status_local'),
    };
  }

  if (status === 'ACTIVE' || status === 'CONFIGURED') {
    return {
      tone: 'warning' as const,
      label: t('accounts.status_waiting_check'),
    };
  }

  return {
    tone: 'danger' as const,
    label: t('accounts.status_error_display'),
  };
}

export function isAccountUnavailable(account: AccountRecord) {
  if (account.disabled || account.rawAuthFile?.unavailable) {
    return true;
  }

  const status = String(account.status || '')
    .trim()
    .toUpperCase();
  return status !== 'ACTIVE' && status !== 'CONFIGURED' && status !== 'LOCAL';
}

export function isCodexReauthEligible(account: AccountRecord) {
  if (account.credentialSource !== 'auth-file') {
    return false;
  }
  if (String(account.provider || '').trim().toLowerCase() !== 'codex') {
    return false;
  }
  if (!String(account.name || '').trim()) {
    return false;
  }

  const status = String(account.status || '')
    .trim()
    .toUpperCase();
  return status !== 'ACTIVE' && status !== 'CONFIGURED' && status !== 'DISABLED' && status !== 'LOCAL';
}

export function isCodexAuthFile(account: AccountRecord) {
  if (account.credentialSource !== 'auth-file') {
    return false;
  }
  if (!String(account.name || '').trim()) {
    return false;
  }
  return String(account.provider || '').trim().toLowerCase() === 'codex';
}

export function resolveAccountPlanLabel(account: AccountRecord, quotaDisplay: QuotaDisplay) {
  const plan = String(quotaDisplay.planType || account.planType || '')
    .trim()
    .toUpperCase();
  return plan || '';
}

export function buildAccountAttributionBadges(account: AccountRecord, quotaDisplay: QuotaDisplay): AccountAttributionBadge[] {
  const badges: AccountAttributionBadge[] = [];
  const planLabel = resolveAccountPlanLabel(account, quotaDisplay);
  if (planLabel) {
    badges.push({
      label: planLabel,
      backgroundColor: 'color-mix(in_srgb,var(--text-primary)_6%,transparent)',
    });
  }

  const formats = account.supportedFormats && account.supportedFormats.length > 0
    ? account.supportedFormats
    : ['anthropic' as ApiFormat];
  for (const format of formats) {
    badges.push({ label: formatLabel(format), shortLabel: formatShortLabel(format) });
  }
  return badges;
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

export function buildAccountStabilitySummary(account: AccountRecord, quotaDisplay: QuotaDisplay, t: Translator): AccountStabilitySummary {
  const failureReason = resolveAccountFailureReason(account);
  if (failureReason) {
    return {
      title: t('accounts.stability_attention_title'),
      body: failureReason,
      tone: 'warning',
    };
  }

  if (account.disabled) {
    return {
      title: t('accounts.stability_attention_title'),
      body: t('accounts.stability_disabled_body'),
      tone: 'warning',
    };
  }

  if (quotaDisplay.status === 'loading') {
    return {
      title: t('accounts.stability_loading_title'),
      body: t('accounts.quota_syncing'),
      tone: 'neutral',
    };
  }

  if (quotaDisplay.status === 'success' && quotaDisplay.windows.length > 0) {
    return {
      title: t('accounts.stability_ready_title'),
      body: t('accounts.stability_ready_body'),
      tone: 'positive',
    };
  }

  if (quotaDisplay.status === 'error' || quotaDisplay.status === 'empty') {
    return {
      title: t('accounts.stability_pending_title'),
      body: t('accounts.stability_pending_body'),
      tone: 'neutral',
    };
  }

  return {
    title: t('accounts.stability_placeholder_title'),
    body: t('accounts.stability_placeholder_body'),
    tone: 'neutral',
  };
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
