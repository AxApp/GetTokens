export type RateLimitTone = 'neutral' | 'warning' | 'critical';

export interface RateLimitStrategyMeta {
  id: string;
  name: string;
  supportedWindows: string[];
}

export interface RateLimitRule {
  id?: string;
  accountKey: string;
  matchKey?: string;
  strategy: string;
  window: string;
  limitValue: number;
  action: 'block' | 'warn' | string;
  enabled: boolean;
  label?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface RateLimitRuleState {
  rule: RateLimitRule;
  exceeded: boolean;
  reason?: string;
  usagePct: number;
  currentUsage: number;
}

export interface RateLimitState {
  accountKey: string;
  matchKey?: string;
  blocked: boolean;
  blockReason?: string;
  rules: RateLimitRuleState[];
  updatedAt?: string;
}

export interface RateLimitEvent {
  id: string;
  accountKey: string;
  matchKey?: string;
  ruleID: string;
  strategy: string;
  window: string;
  action: string;
  usageValue: number;
  limitValue: number;
  blocked: boolean;
  reason?: string;
  triggeredAt: number;
}

export const DEFAULT_RATE_LIMIT_STRATEGIES: RateLimitStrategyMeta[] = [
  { id: 'token-window', name: 'Token 窗口限流', supportedWindows: ['1h', '6h', '12h', '24h', '7d', '30d'] },
  { id: 'request-window', name: '请求窗口限流', supportedWindows: ['1h', '6h', '12h', '24h', '7d', '30d'] },
];

export function buildRateLimitStatusMap(items: RateLimitState[] | undefined) {
  return (items ?? []).reduce<Record<string, RateLimitState>>((result, item) => {
    const accountKey = String(item.accountKey || '').trim();
    if (accountKey) {
      result[accountKey] = normalizeRateLimitState(item);
    }
    return result;
  }, {});
}

export function normalizeRateLimitState(input: RateLimitState): RateLimitState {
  return {
    accountKey: String(input.accountKey || '').trim(),
    matchKey: String(input.matchKey || '').trim(),
    blocked: Boolean(input.blocked),
    blockReason: String(input.blockReason || '').trim(),
    updatedAt: String(input.updatedAt || '').trim(),
    rules: (input.rules ?? []).map((ruleState) => ({
      exceeded: Boolean(ruleState.exceeded),
      reason: String(ruleState.reason || '').trim(),
      usagePct: Number.isFinite(Number(ruleState.usagePct)) ? Number(ruleState.usagePct) : 0,
      currentUsage: Number.isFinite(Number(ruleState.currentUsage)) ? Number(ruleState.currentUsage) : 0,
      rule: {
        id: String(ruleState.rule?.id || '').trim(),
        accountKey: String(ruleState.rule?.accountKey || input.accountKey || '').trim(),
        matchKey: String(ruleState.rule?.matchKey || '').trim(),
        strategy: String(ruleState.rule?.strategy || '').trim(),
        window: String(ruleState.rule?.window || '').trim(),
        limitValue: Number.isFinite(Number(ruleState.rule?.limitValue)) ? Number(ruleState.rule.limitValue) : 0,
        action: String(ruleState.rule?.action || 'block').trim(),
        enabled: Boolean(ruleState.rule?.enabled),
        label: String(ruleState.rule?.label || '').trim(),
        createdAt: Number(ruleState.rule?.createdAt || 0),
        updatedAt: Number(ruleState.rule?.updatedAt || 0),
      },
    })),
  };
}

export function rateLimitStateTone(status?: RateLimitState): RateLimitTone {
  if (!status || status.rules.length === 0) return 'neutral';
  if (status.blocked) return 'critical';
  if (status.rules.some((item) => item.exceeded)) return 'warning';
  return 'neutral';
}

export function rateLimitRuleLabel(rule: Pick<RateLimitRule, 'strategy' | 'window' | 'label'>) {
  const label = String(rule.label || '').trim();
  if (label) return label.toUpperCase();
  const window = String(rule.window || 'window').toUpperCase();
  return `${window} ${rateLimitStrategyShortLabel(rule.strategy)}`;
}

export function rateLimitStrategyShortLabel(strategy: string) {
  switch (strategy) {
    case 'token-window':
      return 'TOKENS';
    case 'request-window':
      return 'REQ';
    default:
      return String(strategy || 'LIMIT').toUpperCase();
  }
}

export function formatRateLimitMetric(value: number) {
  const normalized = Math.max(0, Number(value || 0));
  if (normalized >= 1000000) return `${trimDecimal(normalized / 1000000)}M`;
  if (normalized >= 10000) return `${trimDecimal(normalized / 10000)}W`;
  return new Intl.NumberFormat('zh-CN').format(Math.round(normalized));
}

export function formatRateLimitLimitDraftValue(rule: Pick<RateLimitRule, 'strategy' | 'limitValue'>) {
  const normalized = Math.max(0, Number(rule.limitValue || 0));
  if (rule.strategy === 'token-window') {
    return trimDecimal(normalized / 1000000);
  }
  return String(Math.round(normalized));
}

export function parseRateLimitLimitDraftValue(strategy: string, value: string) {
  const normalized = Math.max(0, Number(value || 0));
  if (strategy === 'token-window') {
    return Math.round(normalized * 1000000);
  }
  return Math.round(normalized);
}

function trimDecimal(value: number) {
  const normalized = Math.round(value * 10) / 10;
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1).replace(/\.0$/, '');
}
