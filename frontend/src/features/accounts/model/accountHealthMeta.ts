import type { AccountUsageSummary } from './accountUsage';
import type { Translator } from './types';

export interface AccountHealthMetaItem {
  label: string;
  value: string;
}

export function buildAccountHealthMetaItems(
  summary: AccountUsageSummary | undefined,
  t: Translator
): AccountHealthMetaItem[] {
  return [
    {
      label: t('accounts.recent_failure'),
      value: String(summary?.failure ?? 0),
    },
    {
      label: t('accounts.average_latency'),
      value: summary?.averageLatencyMs ? `${summary.averageLatencyMs} ms` : '—',
    },
  ];
}
