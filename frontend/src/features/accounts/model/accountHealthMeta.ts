import type { AccountUsageSummary } from './accountUsage';
import type { Translator } from './types';

export interface AccountHealthMetaItem {
  label: string;
  value: string;
}

function formatCompactMetric(value: number, unit: 'count' | 'tokens') {
  const normalized = Number.isFinite(value) && value > 0 ? value : 0;
  const formatter = new Intl.NumberFormat('zh-CN');

  if (unit === 'count') {
    if (normalized >= 100000000) {
      return `${formatCompactNumber(normalized / 100000000)} 亿次`;
    }
    if (normalized >= 1000000) {
      return `${formatCompactNumber(normalized / 1000000)} 百万次`;
    }
    if (normalized >= 10000) {
      return `${formatCompactNumber(normalized / 10000)} 万次`;
    }
    return `${formatter.format(normalized)} 次`;
  }

  if (normalized >= 100000000) {
    return `${formatCompactNumber(normalized / 100000000)} 亿`;
  }
  if (normalized >= 1000000) {
    return `${formatCompactNumber(normalized / 1000000)} 百万`;
  }
  if (normalized >= 10000) {
    return `${formatCompactNumber(normalized / 10000)} 万`;
  }
  return formatter.format(normalized);
}

function formatCompactNumber(value: number) {
  const normalized = Math.round(value * 10) / 10;
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(1).replace(/\.0$/, '');
}

export function buildAccountHealthMetaItems(
  summary: AccountUsageSummary | undefined,
  t: Translator
): AccountHealthMetaItem[] {
  return [
    {
      label: t('accounts.recent_requests'),
      value: formatCompactMetric(summary?.requestCount ?? 0, 'count'),
    },
    {
      label: t('accounts.total_tokens'),
      value: formatCompactMetric(summary?.totalTokens ?? 0, 'tokens'),
    },
    {
      label: t('accounts.average_latency'),
      value: summary?.averageLatencyMs ? `${summary.averageLatencyMs} ms` : '—',
    },
  ];
}
