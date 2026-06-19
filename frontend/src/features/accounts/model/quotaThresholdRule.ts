import { main } from '../../../../wailsjs/go/models';
import type { QuotaThresholdRule } from '../../../types';

export type QuotaThresholdMetric = 'remaining-percent' | 'used-percent';

export interface BuildQuotaThresholdRuleOptions {
  id?: string;
  accountKey: string;
  windowKey: string;
  metric?: QuotaThresholdMetric;
  comparator?: string;
  thresholdPercent: number;
  condition?: Record<string, unknown>;
  enabled?: boolean;
}

export function buildQuotaThresholdRule(options: BuildQuotaThresholdRuleOptions): QuotaThresholdRule {
  const metric = options.metric || 'remaining-percent';
  return main.QuotaThresholdRule.createFrom({
    id: String(options.id || '').trim() || undefined,
    accountKey: String(options.accountKey || '').trim(),
    windowKey: String(options.windowKey || '').trim(),
    metric,
    comparator: String(options.comparator || defaultComparatorForQuotaThresholdMetric(metric)).trim(),
    thresholdPercent: clampThresholdPercent(options.thresholdPercent),
    condition: options.condition,
    enabled: options.enabled !== false,
  });
}

export function buildQuotaThresholdCondition(options: {
  windowKey: string;
  metric?: QuotaThresholdMetric;
  comparator?: string;
  value: number;
}) {
  const metric = options.metric || 'remaining-percent';
  return {
    fact: 'quota.window',
    window_key: String(options.windowKey || '').trim(),
    metric,
    comparator: String(options.comparator || defaultComparatorForQuotaThresholdMetric(metric)).trim(),
    value: clampThresholdPercent(options.value),
  };
}

export function normalizeQuotaThresholdRules(items: unknown): QuotaThresholdRule[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => main.QuotaThresholdRule.createFrom(item))
    .filter((item) => String(item.id || '').trim() && String(item.accountKey || '').trim());
}

export function defaultComparatorForQuotaThresholdMetric(metric: string) {
  return metric === 'used-percent' ? '>=' : '<=';
}

function clampThresholdPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}
