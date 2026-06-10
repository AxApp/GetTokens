import type { AccountRecord } from '../../../types';
import { supportsQuota } from './accountQuota.ts';
import type { CodexQuotaState } from './types';

export interface AccountCardRefreshAction {
  visible: boolean;
  labelKey: 'accounts.refresh_quota' | 'accounts.refresh_runtime';
  disabled: boolean;
}

export function buildAccountCardRefreshAction(input: {
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageRefreshing?: boolean;
  rateLimitRefreshing?: boolean;
}): AccountCardRefreshAction {
  const hasAccountID = String(input.account.id || '').trim().length > 0;
  const quotaSupported = supportsQuota(input.account);
  if (!hasAccountID) {
    return {
      visible: false,
      labelKey: quotaSupported ? 'accounts.refresh_quota' : 'accounts.refresh_runtime',
      disabled: true,
    };
  }

  return {
    visible: true,
    labelKey: quotaSupported ? 'accounts.refresh_quota' : 'accounts.refresh_runtime',
    disabled: quotaSupported
      ? input.quotaState?.status === 'loading'
      : input.usageRefreshing === true || input.rateLimitRefreshing === true,
  };
}
