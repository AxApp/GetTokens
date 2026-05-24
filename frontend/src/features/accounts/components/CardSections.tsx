import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { ApiFormat, BillingDisplay } from '../../../types';
import type { AccountRecord, QuotaDisplay, QuotaWindowDisplay, Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import { formatLabel } from '../model/vendorPresetHelpers';
import { formatQuotaResetDisplayWithUnix, hasDisplayableBilling } from '../model/accountQuota';
import { resolveQuotaRemainingFillClass } from '../model/quotaColor';

const FLOW_BASE = '12,58 50,44 92,48 134,34 176,60 218,50 260,42 302,40';

// ── Format Badges ──────────────────────────────────────────────────

interface FormatBadgesProps {
  account: AccountRecord;
}

export function FormatBadges({ account }: FormatBadgesProps) {
  const formats = (account.supportedFormats && account.supportedFormats.length > 0
    ? account.supportedFormats
    : ['anthropic']) as ApiFormat[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {formats.map((fmt) => (
        <span
          key={fmt}
          className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]"
        >
          {formatLabel(fmt)}
        </span>
      ))}
    </div>
  );
}

// ── Traffic Section ────────────────────────────────────────────────

interface TrafficSectionProps {
  usageSummary?: AccountUsageSummary;
  t: Translator;
}

export function TrafficSection({ usageSummary, t }: TrafficSectionProps) {
  const flow = buildTrafficCurveState(usageSummary);
  const sourceLabel = resolveUsageSourceLabel(usageSummary);

  return (
    <section className="account-card-traffic grid gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-3">
      <TrafficSummary
        label={t('accounts.recent_requests')}
        value={formatCountMetric(usageSummary?.requestCount ?? 0)}
        sourceLabel={sourceLabel}
      />
      <TrafficChart
        flow={flow}
        windowLabel={t('accounts.attribution_window')}
        peakLabel={t('accounts.attribution_peak')}
        nowLabel={t('accounts.attribution_now')}
      />
    </section>
  );
}

interface TrafficSummaryProps {
  label: string;
  value: string;
  sourceLabel: string;
}

export function TrafficSummary({ label, value, sourceLabel }: TrafficSummaryProps) {
  return (
    <div className="flex min-h-[6rem] flex-col justify-between">
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-mono text-[length:var(--font-size-ui-display)] font-black leading-none text-[var(--text-primary)]">
        {value}
      </div>
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {sourceLabel}
      </div>
    </div>
  );
}

interface TrafficChartProps {
  flow: AccountTrafficFlowState;
  windowLabel: string;
  peakLabel: string;
  nowLabel: string;
}

export function TrafficChart({ flow, windowLabel, peakLabel, nowLabel }: TrafficChartProps) {
  return (
    <div className="account-card-traffic-chart min-w-0 border-l-2 border-[var(--border-color)]">
      <div className="account-card-flow-head mb-1 grid gap-2">
        <TrafficHeadCell label={windowLabel} value={formatTokenMetric(flow.windowTokens)} />
        <TrafficHeadCell label={peakLabel} value={formatTokenMetric(flow.peakTokens)} />
        <TrafficHeadCell label={nowLabel} value={formatTokenMetric(flow.currentTokens)} />
      </div>
      <div
        className="relative h-[4rem] overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--border-color) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border-color) 10%, transparent) 1px, transparent 1px)',
          backgroundSize: '28px 100%, 100% 22px',
        }}
      >
        <svg viewBox="0 0 314 86" className="absolute inset-0 h-full w-full">
          <polyline
            fill="none"
            stroke="color-mix(in srgb, var(--text-muted) 35%, transparent)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={FLOW_BASE}
          />
          <path
            d={flow.path}
            fill="none"
            stroke="var(--color-chart-attribution)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="12 10"
          >
            <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.8s" repeatCount="indefinite" />
          </path>
          {flow.points.map((point) => (
            <circle
              key={point.key}
              cx={point.x}
              cy={point.y}
              r={point.kind === 'latest' ? 4.8 : point.kind === 'peak' ? 4.2 : 3.4}
              fill={point.kind === 'latest' ? 'var(--color-chart-attribution)' : point.kind === 'peak' ? 'var(--color-chart-peak)' : 'var(--bg-main)'}
              stroke={point.kind === 'peak' ? 'var(--color-chart-primary)' : 'var(--color-chart-attribution)'}
              strokeWidth="1.3"
            />
          ))}
          <text x="10" y="79" fill="var(--text-muted)" fontSize="7" fontWeight="900">
            24H
          </text>
          <text x="278" y="79" fill="var(--text-muted)" fontSize="7" fontWeight="900">
            NOW
          </text>
        </svg>
      </div>
    </div>
  );
}

function TrafficHeadCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="shrink-0 truncate font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

// ── Mini Metrics ───────────────────────────────────────────────────

interface AccountMiniMetricsProps {
  usageSummary?: AccountUsageSummary;
  quotaDisplay?: QuotaDisplay;
  t: Translator;
}

export function AccountMiniMetrics({ usageSummary, quotaDisplay, t }: AccountMiniMetricsProps) {
  const firstQuotaWindow = quotaDisplay?.windows?.[0];
  const quotaValue = firstQuotaWindow
    ? firstQuotaWindow.remainingPercent === null
      ? '--'
      : `${firstQuotaWindow.remainingPercent}%`
    : quotaDisplay?.status === 'unsupported'
      ? t('accounts.quota_unsupported')
      : '—';

  return (
    <div className="account-card-list-metrics grid min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      <AccountMiniMetric label={t('accounts.recent_requests')} value={formatCountMetric(usageSummary?.requestCount ?? 0)} />
      <AccountMiniMetric label={t('accounts.total_tokens')} value={formatTokenMetric(usageSummary?.totalTokens ?? 0)} />
      <AccountMiniMetric label={firstQuotaWindow?.label || t('accounts.quota_remaining')} value={quotaValue} />
    </div>
  );
}

export function AccountMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-[var(--border-color)] px-2 py-2 last:border-r-0">
      <div className="truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-normal text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

// ── Quota Bars ─────────────────────────────────────────────────────

interface QuotaBarsProps {
  quotaDisplay: QuotaDisplay;
  t: Translator;
}

type QuotaBarsDisplayMode = 'percent' | 'tokens';

export function QuotaBars({ quotaDisplay, t }: QuotaBarsProps) {
  const windows = quotaDisplay.windows ?? [];
  const [displayMode, setDisplayMode] = useState<QuotaBarsDisplayMode>('percent');
  if (windows.length === 0) return null;
  const refreshing = quotaDisplay.refreshing === true;
  const hasTokenProgress = windows.some(hasQuotaTokenProgress);

  const toggleDisplayMode = () => {
    if (!hasTokenProgress) return;
    setDisplayMode((current) => current === 'percent' ? 'tokens' : 'percent');
  };

  const handleToggleDisplayMode = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    toggleDisplayMode();
  };

  const handleToggleDisplayModeKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    toggleDisplayMode();
  };

  return (
    <section
      className={`grid gap-2.5 border-b border-dashed border-[var(--border-color)] px-4 py-3 ${
        hasTokenProgress ? 'cursor-pointer transition-colors hover:bg-[var(--bg-surface)]' : ''
      }`}
      aria-busy={refreshing}
      aria-pressed={hasTokenProgress ? displayMode === 'tokens' : undefined}
      role={hasTokenProgress ? 'button' : undefined}
      tabIndex={hasTokenProgress ? 0 : undefined}
      data-quota-refreshing={refreshing ? 'true' : undefined}
      data-quota-display-mode={displayMode}
      data-account-card-ignore-click={hasTokenProgress ? 'true' : undefined}
      onClick={hasTokenProgress ? handleToggleDisplayMode : undefined}
      onKeyDown={hasTokenProgress ? handleToggleDisplayModeKeyDown : undefined}
    >
      {windows.map((window) => {
        const resetTime = formatQuotaResetDisplayWithUnix(window.resetLabel, window.resetAtUnix);
        const valueLabel = displayMode === 'tokens' && hasQuotaTokenProgress(window)
          ? formatQuotaTokenProgress(window)
          : formatQuotaPercent(window);
        const fillPercent = displayMode === 'tokens' && hasQuotaTokenProgress(window)
          ? resolveQuotaTokenFillPercent(window)
          : window.remainingPercent;
        const fillClass = fillPercent === null
          ? ''
          : window.remainingPercent !== null
            ? resolveQuotaRemainingFillClass(window.remainingPercent)
            : resolveQuotaRemainingFillClass(Math.max(0, 100 - fillPercent));

        return (
          <div key={window.id} className="account-card-quota-row grid min-w-0 gap-1.5">
            <div className="account-card-quota-heading flex min-w-0 items-baseline justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {window.label}
              </div>
              <div className="shrink-0 text-right font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                {valueLabel}
              </div>
            </div>
            <div className="grid min-w-0 gap-1">
              <div
                className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
                style={{
                  backgroundImage: window.remainingPercent === null
                    ? 'repeating-linear-gradient(to right, color-mix(in srgb, var(--border-color) 12%, transparent) 0 8px, transparent 8px 14px)'
                    : 'none',
                }}
              >
                {fillPercent !== null ? (
                  <div
                    className={`absolute inset-y-0 left-0 ${fillClass}`}
                    style={{ width: `${Math.max(0, fillPercent)}%` }}
                  />
                ) : null}
                {refreshing ? (
                  <div
                    className="account-card-quota-refresh-skeleton absolute inset-0 pointer-events-none"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                <span className="shrink-0">{t('accounts.quota_reset')}</span>
                <span className="min-w-0 truncate text-right text-[var(--text-primary)]">{resetTime}</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function hasQuotaTokenProgress(window: QuotaWindowDisplay) {
  return typeof window.usedTokens === 'number' && typeof window.limitTokens === 'number' && window.limitTokens > 0;
}

function formatQuotaPercent(window: QuotaWindowDisplay) {
  return window.remainingPercent === null ? '--' : `${window.remainingPercent}%`;
}

function formatQuotaTokenProgress(window: QuotaWindowDisplay) {
  if (!hasQuotaTokenProgress(window)) {
    return formatQuotaPercent(window);
  }
  return `${formatTokenMetric(window.usedTokens)} / ${formatTokenMetric(window.limitTokens)}`;
}

function resolveQuotaTokenFillPercent(window: QuotaWindowDisplay) {
  if (!hasQuotaTokenProgress(window)) {
    return window.remainingPercent;
  }
  return Math.max(0, Math.min(100, Math.round((window.usedTokens! / window.limitTokens!) * 100)));
}

// ── Billing Balance ─────────────────────────────────────────────────

interface BillingBalanceProps {
  billing?: BillingDisplay;
}

export function BillingBalance({ billing }: BillingBalanceProps) {
  if (!billing?.isAvailable || !billing?.balances?.length) return null;

  return (
    <div className="space-y-2 border-b border-dashed border-[var(--border-color)] px-4 py-3">
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        BALANCE
      </div>
      {billing.balances.map((b, i) => (
        <div key={i} className="account-card-billing-grid grid gap-2 text-[length:var(--font-size-ui-xs)]">
          <div className="flex items-center justify-between border border-[var(--border-color)] px-2 py-1">
            <span className="font-mono font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Total</span>
            <span className="font-mono font-black text-[var(--text-primary)]">{b.totalBalance} {b.currency}</span>
          </div>
          <div className="flex items-center justify-between border border-[var(--border-color)] px-2 py-1">
            <span className="font-mono font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Granted</span>
            <span className="font-mono font-black text-[var(--text-primary)]">{b.grantedBalance} {b.currency}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Usage Metrics Grid ─────────────────────────────────────────────

interface UsageMetricsProps {
  usageSummary?: AccountUsageSummary;
  t: Translator;
}

function formatUsageCountMetric(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function formatUsageTokenMetric(value: number | null | undefined) {
  if (typeof value !== 'number' || value === 0) return '—';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatLatencyMetric(ms: number | null | undefined) {
  if (typeof ms !== 'number' || ms === 0) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function UsageCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-dashed border-[var(--border-color)] px-3 py-3 last:border-r-0">
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[length:var(--font-size-ui-md)] font-black tabular-nums tracking-[-0.02em] text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

export function UsageMetrics({ usageSummary, t }: UsageMetricsProps) {
  if (!usageSummary) return null;

  return (
    <section className="account-card-usage-metrics grid border-b border-dashed border-[var(--border-color)]">
      <UsageCell label={t('accounts.recent_requests')} value={formatUsageCountMetric(usageSummary.requestCount ?? 0)} />
      <UsageCell label={t('accounts.total_tokens')} value={formatUsageTokenMetric(usageSummary.totalTokens ?? 0)} />
      <UsageCell label="CACHED" value={formatUsageTokenMetric(usageSummary.cachedInputTokens ?? 0)} />
      <UsageCell label={t('accounts.average_latency')} value={formatLatencyMetric(usageSummary.averageLatencyMs ?? null)} />
    </section>
  );
}

// ── Rate Limit Guard ───────────────────────────────────────────────

interface RateLimitGuardProps {
  rateLimitStatus?: RateLimitState;
}

export function RateLimitGuard({ rateLimitStatus }: RateLimitGuardProps) {
  const rules = rateLimitStatus?.rules ?? [];
  if (rules.length === 0) return null;

  return (
    <section className="grid gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          ROUTE GUARD
        </div>
        <div className={`font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
          rateLimitStatus?.blocked ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
        }`}>
          {rateLimitStatus?.blocked ? rateLimitStatus.blockReason || 'BLOCKED' : 'PASS'}
        </div>
      </div>
      {rules.map((ruleState) => {
        const exceeded = ruleState.exceeded && ruleState.rule.action === 'block';
        const fillClass = exceeded ? 'bg-[var(--color-status-danger)]' : ruleState.exceeded ? 'bg-[var(--color-status-warning)]' : 'bg-[var(--color-status-warning)]';
        const pct = Math.min(100, Math.max(0, Number(ruleState.usagePct || 0)));
        return (
          <div key={ruleState.rule.id} className="account-card-rate-limit-row grid items-center gap-2">
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
              {ruleState.rule.strategy} · {ruleState.rule.window}
            </div>
            <div className="relative h-3 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]">
              <div className={`absolute inset-y-0 left-0 ${fillClass}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right font-mono text-[length:var(--font-size-ui-2xs)] font-black tabular-nums text-[var(--text-primary)]">
              {pct}%
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ── Unsupported Quota Placeholder ──────────────────────────────────

interface UnsupportedQuotaPlaceholderProps {
  quotaDisplay?: QuotaDisplay;
  billing?: BillingDisplay;
  t: Translator;
}

export function UnsupportedQuotaPlaceholder({ quotaDisplay, billing, t }: UnsupportedQuotaPlaceholderProps) {
  const windows = quotaDisplay?.windows ?? [];
  if (windows.length > 0 || hasDisplayableBilling(billing)) return null;

  return (
    <section className="border-b border-dashed border-[var(--border-color)] px-4 py-4">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {quotaDisplay?.status === 'loading' ? t('accounts.quota_syncing') : t('accounts.quota_unsupported')}
      </div>
    </section>
  );
}

export interface AccountTrafficPoint {
  key: string;
  x: number;
  y: number;
  value: number;
  kind: 'normal' | 'latest' | 'peak';
}

export interface AccountTrafficFlowState {
  path: string;
  points: AccountTrafficPoint[];
  windowTokens: number;
  peakTokens: number;
  currentTokens: number;
}

function buildTrafficCurveState(summary?: AccountUsageSummary): AccountTrafficFlowState {
  const buckets = Array.isArray(summary?.trafficBuckets) && summary?.trafficBuckets.length > 0
    ? summary.trafficBuckets.slice(-8)
    : Array.from({ length: 8 }, (_, index) => ({
        start: `slot-${index}`,
        requestCount: 0,
        failedCount: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      }));
  const values = buckets.map((bucket) => Math.max(0, bucket.totalTokens || 0));
  const max = Math.max(1, ...values);
  const height = 86;
  const top = 14;
  const bottom = 18;
  const left = 12;
  const right = 12;
  const step = buckets.length > 1 ? (314 - left - right) / (buckets.length - 1) : 0;
  const usableHeight = height - top - bottom;
  const points: AccountTrafficPoint[] = buckets.map((bucket, index) => {
    const x = left + step * index;
    const y = height - bottom - (Math.max(0, bucket.totalTokens || 0) / max) * usableHeight;
    return {
      key: `${bucket.start}-${index}`,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      value: Math.max(0, bucket.totalTokens || 0),
      kind: 'normal',
    };
  });
  const peakValue = Math.max(...values);
  const latestIndex = Math.max(0, points.length - 1);
  points.forEach((point, index) => {
    if (index === latestIndex) {
      point.kind = 'latest';
      return;
    }
    if (point.value === peakValue && peakValue > 0) {
      point.kind = 'peak';
    }
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  return {
    path: points.length > 1 ? path : 'M 12 56 L 302 56',
    points,
    windowTokens: summary?.totalTokens ?? 0,
    peakTokens: peakValue,
    currentTokens: values[values.length - 1] ?? 0,
  };
}

function resolveUsageSourceLabel(summary?: AccountUsageSummary) {
  if (summary?.source === 'attribution') {
    return 'ATTRIBUTION';
  }
  if (summary?.source === 'legacy') {
    return 'LEGACY';
  }
  return 'NONE';
}

function formatCountMetric(value: number) {
  const normalized = Math.max(0, Number(value || 0));
  if (normalized >= 1000000000) {
    return `${trimDecimal(normalized / 1000000000)}B`;
  }
  if (normalized >= 1000000) {
    return `${trimDecimal(normalized / 1000000)}M`;
  }
  if (normalized >= 1000) {
    return `${trimDecimal(normalized / 1000)}K`;
  }
  return new Intl.NumberFormat('zh-CN').format(normalized);
}

function formatTokenMetric(value: number | null | undefined) {
  const normalized = Math.max(0, Number(value || 0));
  if (normalized >= 1000000) {
    return `${trimDecimal(normalized / 1000000)}M`;
  }
  if (normalized >= 10000) {
    return `${trimDecimal(normalized / 10000)}W`;
  }
  return new Intl.NumberFormat('zh-CN').format(normalized);
}

function trimDecimal(value: number) {
  const normalized = Math.round(value * 10) / 10;
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1).replace(/\.0$/, '');
}
