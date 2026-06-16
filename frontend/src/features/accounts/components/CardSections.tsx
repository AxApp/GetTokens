import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { ApiFormat, BillingDisplay } from '../../../types';
import type { AccountRecord, QuotaDisplay, QuotaWindowDisplay, Translator } from '../model/types';
import { buildAccountTodayUsageTotals, resolveUnboundedTrafficActivityPercent, type AccountUsageSummary } from '../model/accountUsage';
import { buildRateLimitGuardRows, type RateLimitState } from '../model/rateLimit';
import { formatLabel } from '../model/vendorPresetHelpers';
import {
  formatQuotaResetDisplayWithUnix,
  formatQuotaWindowUsageLabel,
  hasDisplayableBilling,
  resolveQuotaWindowUsagePercent,
} from '../model/accountQuota';
import { resolveQuotaRemainingFillClass } from '../model/quotaColor';
import { buildRuntimeWarningDisplay } from '../model/runtimeWarning';

interface RuntimeWarningBannerProps {
  warning: string;
  dataAttribute: 'data-account-quota-runtime-warning' | 'data-account-route-guard-runtime-warning';
}

function RuntimeWarningBanner({ warning, dataAttribute }: RuntimeWarningBannerProps) {
  const display = buildRuntimeWarningDisplay(warning);
  if (!display.summary) return null;
  const dataProps = { [dataAttribute]: true };

  return (
    <div
      className="min-w-0 overflow-hidden border border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_12%,transparent)] px-2 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.08em] text-[var(--color-status-warning)]"
      title={display.full}
      {...dataProps}
    >
      <span className="mr-1">STALE</span>
      <span className="normal-case tracking-normal">{display.summary}</span>
    </div>
  );
}

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
  const usageErrorTitle = usageSummary?.errorMessage || '';
  const requestValue =
    usageSummary?.loadState === 'error'
      ? 'ERR'
      : usageSummary?.loadState === 'stale'
        ? `${formatCountMetric(usageSummary?.requestCount ?? 0)} STALE`
        : formatCountMetric(usageSummary?.requestCount ?? 0);
  const tokenValue =
    usageSummary?.loadState === 'error'
      ? 'ERR'
      : usageSummary?.loadState === 'stale'
        ? `${formatTokenMetric(usageSummary?.totalTokens ?? 0)} STALE`
        : formatTokenMetric(usageSummary?.totalTokens ?? 0);

  return (
    <div className="account-card-list-metrics grid min-w-0 gap-0">
      <AccountMiniMetric label={t('accounts.recent_requests')} value={requestValue} title={usageErrorTitle} />
      <AccountMiniMetric label={t('accounts.total_tokens')} value={tokenValue} title={usageErrorTitle} />
      <AccountMiniMetric label={firstQuotaWindow?.label || t('accounts.quota_remaining')} value={quotaValue} />
    </div>
  );
}

export function AccountMiniMetric({ label, value, title = '' }: { label: string; value: string; title?: string }) {
  return (
    <div className="account-card-list-metric-cell min-w-0 border-l border-dashed border-[var(--border-color)] px-2 py-1.5 first:border-l-0" title={title}>
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
  showDivider?: boolean;
}

type QuotaBarsDisplayMode = 'percent' | 'tokens';

export function QuotaBars({ quotaDisplay, t, showDivider = true }: QuotaBarsProps) {
  const windows = quotaDisplay.windows ?? [];
  const [displayMode, setDisplayMode] = useState<QuotaBarsDisplayMode>('percent');
  if (windows.length === 0) return null;
  const refreshing = quotaDisplay.refreshing === true;
  const hasTokenProgress = windows.some(hasQuotaTokenProgress);
  const runtimeWarning = formatQuotaRuntimeWarning(quotaDisplay);

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
      className={`grid gap-2.5 px-4 py-3 ${showDivider ? 'border-b border-dashed border-[var(--border-color)]' : ''} ${
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
      {runtimeWarning ? (
        <RuntimeWarningBanner warning={runtimeWarning} dataAttribute="data-account-quota-runtime-warning" />
      ) : null}
      {windows.map((window) => {
        const resetTime = formatQuotaResetDisplayWithUnix(window.resetLabel, window.resetAtUnix);
        const valueLabel = displayMode === 'tokens' && hasQuotaTokenProgress(window)
          ? formatQuotaTokenProgress(window)
          : formatQuotaWindowUsageLabel(window);
        const fillPercent = displayMode === 'tokens' && hasQuotaTokenProgress(window)
          ? resolveQuotaTokenFillPercent(window)
          : resolveQuotaWindowUsagePercent(window);
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

function formatQuotaRuntimeWarning(quotaDisplay: QuotaDisplay) {
  const degradedReason = String(quotaDisplay.degradedReason || '').trim();
  if (degradedReason) {
    return degradedReason;
  }
  return quotaDisplay.stale ? 'Quota data is stale.' : '';
}

function hasQuotaTokenProgress(window: QuotaWindowDisplay) {
  return typeof window.usedTokens === 'number' && typeof window.limitTokens === 'number' && window.limitTokens > 0;
}

function formatQuotaTokenProgress(window: QuotaWindowDisplay) {
  if (!hasQuotaTokenProgress(window)) {
    return formatQuotaWindowUsageLabel(window);
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

function formatUsageCountMetric(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function formatUsageTokenMetric(value: number | null | undefined) {
  if (typeof value !== 'number') return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(Math.max(0, Math.round(value)));
}

// ── Rate Limit Guard ───────────────────────────────────────────────

interface RateLimitGuardProps {
  rateLimitStatus?: RateLimitState;
  usageSummary?: AccountUsageSummary;
  refreshing?: boolean;
  t: Translator;
}

export function RateLimitGuard({ rateLimitStatus, usageSummary, refreshing = false, t }: RateLimitGuardProps) {
  const rows = buildRateLimitGuardRows(rateLimitStatus);
  const runtimeWarning = formatRateLimitRuntimeWarning(rateLimitStatus);
  const hasRows = rows.length > 0;
  const statusLabel = rateLimitStatus?.blocked ? rateLimitStatus.blockReason || 'BLOCKED' : 'PASS';
  const trafficBuckets = usageSummary?.trafficBuckets ?? [];
  const todayUsage = buildAccountTodayUsageTotals(usageSummary);
  const requestActivityPercent = resolveUnboundedTrafficActivityPercent(
    todayUsage.requestCount,
    trafficBuckets.map((bucket) => bucket.requestCount),
  );
  const tokenActivityPercent = resolveUnboundedTrafficActivityPercent(
    todayUsage.totalTokens,
    trafficBuckets.map((bucket) => bucket.totalTokens),
  );

  return (
    <section
      className="grid gap-2.5 px-4 py-3"
      aria-busy={refreshing}
      data-rate-limit-refreshing={refreshing ? 'true' : undefined}
    >
      {runtimeWarning ? (
        <RuntimeWarningBanner warning={runtimeWarning} dataAttribute="data-account-route-guard-runtime-warning" />
      ) : null}
      {hasRows ? (
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            ROUTE GUARD
          </div>
          <div className={`font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
            rateLimitStatus?.blocked ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
          }`}>
            {statusLabel}
          </div>
        </div>
      ) : null}
      {!hasRows ? (
        <div data-account-card-traffic-statistics="unbounded" className="grid gap-2">
          <TrafficStatisticsRow
            label={t('accounts.today_requests')}
            value={formatUsageCountMetric(todayUsage.requestCount)}
            activityPercent={requestActivityPercent}
            refreshing={refreshing}
          />
          <TrafficStatisticsRow
            label={t('accounts.today_tokens')}
            value={formatUsageTokenMetric(todayUsage.totalTokens)}
            activityPercent={tokenActivityPercent}
            refreshing={refreshing}
          />
        </div>
      ) : null}
      {rows.map((row) => {
        const fillClass = row.tone === 'critical' ? 'bg-[var(--color-status-danger)]' : 'bg-[var(--color-status-warning)]';
        return (
          <div key={row.id} className="account-card-rate-limit-row grid min-w-0 gap-1.5">
            <div className="account-card-rate-limit-heading flex min-w-0 items-baseline justify-between gap-2">
              <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {row.label}
              </div>
              <div className="shrink-0 text-right font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                {row.valueLabel}
              </div>
            </div>
            <div className="grid min-w-0 gap-1">
              <div className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className={`absolute inset-y-0 left-0 ${fillClass}`} style={{ width: `${row.fillPercent}%` }} />
                {refreshing ? (
                  <div
                    className="account-card-quota-refresh-skeleton absolute inset-0 pointer-events-none"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                <span className="shrink-0">{row.windowLabel}</span>
                <span className="min-w-0 truncate text-right text-[var(--text-primary)]">{row.resetLabel || '--'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function TrafficStatisticsRow({
  label,
  value,
  activityPercent,
  refreshing,
}: {
  label: string;
  value: string;
  activityPercent: number;
  refreshing: boolean;
}) {
  return (
    <div className="account-card-traffic-statistics-row grid min-w-0 gap-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </div>
        <div className="shrink-0 text-right font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
          {value} / ∞
        </div>
      </div>
      <div className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div
          aria-hidden="true"
          data-account-card-traffic-activity-fill
          className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--text-primary)_16%,transparent)]"
          style={{ width: `${activityPercent}%` }}
        />
        {refreshing ? (
          <div
            className="account-card-quota-refresh-skeleton absolute inset-0 pointer-events-none"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}

function formatRateLimitRuntimeWarning(rateLimitStatus?: RateLimitState) {
  const degradedReason = String(rateLimitStatus?.degradedReason || '').trim();
  if (degradedReason) {
    return degradedReason;
  }
  return rateLimitStatus?.stale ? 'Route guard data is stale.' : '';
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

export function formatCountMetric(value: number) {
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

export function formatTokenMetric(value: number | null | undefined) {
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
