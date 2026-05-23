import type { BillingDisplay } from '../../../types';
import type { QuotaDisplay } from '../../accounts/model/types';
import type { CodexLiveBillingBalance, CodexLiveQuotaWindow } from '../model/types';

export function buildLiveSessionQuotaDisplay(quota?: readonly CodexLiveQuotaWindow[]): QuotaDisplay | undefined {
  if (!quota?.length) {
    return undefined;
  }

  return {
    status: 'success',
    planType: 'live',
    windows: quota.map((window, index) => ({
      id: `${index}`,
      label: window.label,
      remainingPercent: typeof window.remainingPercent === 'number' ? window.remainingPercent : null,
      usedLabel: buildQuotaUsedLabel(window),
      resetLabel: window.resetLabel || '—',
      resetAtUnix: window.resetAtUnix,
    })),
  };
}

export function buildLiveSessionBillingDisplay(billing?: readonly CodexLiveBillingBalance[]): BillingDisplay | undefined {
  if (!billing?.length) {
    return undefined;
  }

  return {
    isAvailable: true,
    balances: billing.map((balance) => ({
      currency: balance.currency,
      totalBalance: balance.totalBalance.toLocaleString(),
      grantedBalance: balance.grantedBalance.toLocaleString(),
      toppedUpBalance: balance.toppedUpBalance.toLocaleString(),
    })),
  };
}

function buildQuotaUsedLabel(window: CodexLiveQuotaWindow): string {
  if (window.remaining == null || window.limit == null) {
    return '—';
  }

  return `${window.remaining.toLocaleString()} / ${window.limit.toLocaleString()}`;
}
