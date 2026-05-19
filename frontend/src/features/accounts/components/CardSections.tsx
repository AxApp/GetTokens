import type { ApiFormat, BillingDisplay } from '../../../types';
import type { AccountRecord, QuotaDisplay, Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import { formatLabel } from '../model/vendorPresetHelpers';

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

// ── Quota Bars ─────────────────────────────────────────────────────

interface QuotaBarsProps {
  quotaDisplay: QuotaDisplay;
  accentFillClass: string;
}

export function QuotaBars({ quotaDisplay, accentFillClass }: QuotaBarsProps) {
  const windows = quotaDisplay.windows ?? [];
  if (windows.length === 0) return null;

  return (
    <div className="grid gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-4">
      {windows.map((window) => (
        <div key={window.id} className="account-card-quota-row grid items-center gap-2">
          <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {window.label}
          </div>
          <div
            className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
            style={{
              backgroundImage: window.remainingPercent === null
                ? 'repeating-linear-gradient(to right, color-mix(in srgb, var(--border-color) 12%, transparent) 0 8px, transparent 8px 14px)'
                : 'none',
            }}
          >
            {window.remainingPercent !== null ? (
              <div
                className={`absolute inset-y-0 left-0 ${accentFillClass}`}
                style={{ width: `${Math.max(0, window.remainingPercent)}%` }}
              />
            ) : null}
          </div>
          <div className="text-right font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
            {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
          </div>
        </div>
      ))}
    </div>
  );
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

function formatCountMetric(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function formatTokenMetric(value: number | null | undefined) {
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
      <UsageCell label={t('accounts.recent_requests')} value={formatCountMetric(usageSummary.requestCount ?? 0)} />
      <UsageCell label={t('accounts.total_tokens')} value={formatTokenMetric(usageSummary.totalTokens ?? 0)} />
      <UsageCell label="CACHED" value={formatTokenMetric(usageSummary.cachedInputTokens ?? 0)} />
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

// ── Evidence Section ───────────────────────────────────────────────

export interface EvidenceRow {
  label: string;
  value: string;
  title?: string;
}

interface EvidenceSectionProps {
  rows: EvidenceRow[];
}

export function EvidenceSection({ rows }: EvidenceSectionProps) {
  if (rows.length === 0) return null;

  return (
    <section className="grid gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-4">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        EVIDENCE
      </div>
      <div className="account-card-evidence-grid grid gap-x-4 gap-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {row.label}
            </div>
            <div
              className="font-mono text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-[0.04em] text-[var(--text-primary)] truncate"
              title={row.title ?? row.value}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>
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
  if (windows.length > 0 || billing) return null;

  return (
    <section className="border-b border-dashed border-[var(--border-color)] px-4 py-4">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {quotaDisplay?.status === 'loading' ? t('accounts.quota_syncing') : t('accounts.quota_unsupported')}
      </div>
    </section>
  );
}
