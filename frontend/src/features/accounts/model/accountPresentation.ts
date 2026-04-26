import type { main } from '../../../../wailsjs/go/models';
import type { AccountRecord, AuthFile, CredentialSource } from '../../../types';
import type { AccountStabilitySummary, QuotaDisplay, Translator } from './types';
import { buildAPIKeyLabelStorageKey } from './accountConfig.ts';

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
