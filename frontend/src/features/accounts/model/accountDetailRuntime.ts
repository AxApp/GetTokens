import type { AccountUsageSummary } from './accountUsage';

export interface AccountRuntimeStatItem {
  id: string;
  label: string;
  value: string;
}

export function buildAccountRuntimeStats(
  summary: AccountUsageSummary | undefined,
  t: (key: string) => string,
): AccountRuntimeStatItem[] {
  return [
    {
      id: 'recent-requests',
      label: t('accounts.recent_requests'),
      value: formatRuntimeCount(summary?.requestCount ?? 0),
    },
    {
      id: 'total-tokens',
      label: t('accounts.total_tokens'),
      value: formatRuntimeTokens(summary?.totalTokens ?? 0),
    },
    {
      id: 'cached-input',
      label: 'CACHED',
      value: formatRuntimeTokens(summary?.cachedInputTokens ?? 0),
    },
    {
      id: 'average-latency',
      label: t('accounts.average_latency'),
      value: formatRuntimeLatency(summary?.averageLatencyMs ?? null),
    },
  ];
}

export function formatRuntimeCount(value: number) {
  const normalized = Number.isFinite(value) && value > 0 ? value : 0;
  if (normalized >= 1000000) return `${trimRuntimeDecimal(normalized / 1000000)}M`;
  if (normalized >= 1000) return `${trimRuntimeDecimal(normalized / 1000)}K`;
  return new Intl.NumberFormat('zh-CN').format(Math.round(normalized));
}

export function formatRuntimeTokens(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1000000) return `${trimRuntimeDecimal(value / 1000000)}M`;
  if (value >= 1000) return `${trimRuntimeDecimal(value / 1000)}K`;
  return new Intl.NumberFormat('zh-CN').format(Math.round(value));
}

export function formatRuntimeLatency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1000) return `${trimRuntimeDecimal(value / 1000)}s`;
  return `${Math.round(value)}ms`;
}

function trimRuntimeDecimal(value: number) {
  const normalized = Math.round(value * 10) / 10;
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1).replace(/\.0$/, '');
}
