import type { AccountRecord } from '../../../types';
import { buildQuotaDisplay, formatQuotaResetRelative, selectLongestQuotaWindow } from './accountQuota.ts';
import type { OpenAICompatibleProvider } from './openAICompatible';
import type { CodexQuotaState, Translator } from './types';

interface PriorityAccountLike {
  id: string;
  priority?: number;
}

export type RoutingDefaultField =
  | 'strategy'
  | 'sessionAffinity'
  | 'sessionAffinityTTL'
  | 'requestRetry'
  | 'maxRetryCredentials'
  | 'maxRetryInterval'
  | 'switchProject'
  | 'switchPreviewModel'
  | 'antigravityCredits';

export function reorderPriorityAccounts<T extends PriorityAccountLike>(accounts: T[], draggedID: string, targetID: string) {
  if (!draggedID || !targetID || draggedID === targetID) {
    return accounts.slice();
  }

  const next = accounts.slice();
  const draggedIndex = next.findIndex((account) => account.id === draggedID);
  const targetIndex = next.findIndex((account) => account.id === targetID);

  if (draggedIndex < 0 || targetIndex < 0) {
    return next;
  }

  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

export function buildPriorityUpdates<T extends PriorityAccountLike>(accounts: T[]) {
  const highestPriority = accounts.length;

  return accounts
    .map((account, index) => ({
      id: account.id,
      priority: highestPriority - index,
      previousPriority: Number(account.priority || 0),
    }))
    .filter((account) => account.priority !== account.previousPriority)
    .map(({ id, priority }) => ({ id, priority }));
}

export function mapOpenAICompatibleProviderToRotationAccount(provider: OpenAICompatibleProvider): AccountRecord {
  return {
    id: `openai-compatible:${String(provider.name || '').trim()}`,
    provider: String(provider.name || '').trim().toLowerCase() || 'openai-compatible',
    credentialSource: 'api-key',
    displayName: `兼容 OpenAI · ${String(provider.name || '账号').trim()}`,
    status: 'CONFIGURED',
    priority: Number(provider.priority || 0),
    name: String(provider.name || '').trim(),
    apiKey: String(provider.apiKey || '').trim(),
    baseUrl: String(provider.baseUrl || '').trim(),
    prefix: String(provider.prefix || '').trim(),
  };
}

export function buildRoutingDefaultLabel(
  t: (key: string) => string,
  field: RoutingDefaultField,
): string {
  const prefix = t('status.default_value');

  switch (field) {
    case 'strategy':
      return `${prefix}: ${t('status.routing_strategy_round_robin')}`;
    case 'sessionAffinityTTL':
      return `${prefix}: 1h`;
    case 'requestRetry':
    case 'maxRetryCredentials':
    case 'maxRetryInterval':
      return `${prefix}: 0`;
    case 'sessionAffinity':
    case 'switchProject':
    case 'switchPreviewModel':
    case 'antigravityCredits':
      return `${prefix}: ${t('status.disabled')}`;
    default:
      return prefix;
  }
}

export function buildRotationQuotaSummary(
  account: AccountRecord,
  quotaState: CodexQuotaState | undefined,
  t: Translator,
): string {
  const quotaDisplay = buildQuotaDisplay(account, quotaState);

  if (quotaDisplay.status === 'unsupported') {
    return t('accounts.rotation_quota_not_tracked');
  }

  if (quotaDisplay.status === 'loading') {
    return t('accounts.quota_syncing');
  }

  if (quotaDisplay.status === 'error' || quotaDisplay.status === 'empty') {
    return t('accounts.quota_unavailable');
  }

  const longestWindow = selectLongestQuotaWindow(quotaDisplay.windows);
  if (!longestWindow) {
    return t('accounts.quota_unavailable');
  }

  const remaining = longestWindow.remainingPercent === null ? '--' : `${longestWindow.remainingPercent}%`;
  return `${longestWindow.label} · ${t('accounts.quota_remaining')} ${remaining} · ${t('accounts.quota_reset')} ${formatQuotaResetRelative(longestWindow.resetLabel, longestWindow.resetAtUnix)}`;
}
