import type { CSSProperties, ReactNode } from 'react';
import AccountCardFrame from './AccountCardFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { QuotaDisplay, Translator } from '../model/types';

type AttributionCardTone = 'neutral' | 'positive' | 'warning' | 'critical';
type AttributionCardDensity = 'full' | 'compact';

export interface AttributionCardBadge {
  label: string;
  tone?: AttributionCardTone;
}

export interface AttributionCardEvidenceRow {
  label: string;
  value: string;
  title?: string;
}

interface AttributionCardProps {
  t: Translator;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  failureReason?: string;
  badges?: AttributionCardBadge[];
  usageSummary?: AccountUsageSummary;
  quotaDisplay?: QuotaDisplay;
  evidenceRows?: AttributionCardEvidenceRow[];
  tone?: AttributionCardTone;
  density?: AttributionCardDensity;
  leadingAction?: ReactNode;
  topActions?: ReactNode;
  customBody?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  onOpen: () => void;
}

const CARD_TONE_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border-l-[var(--border-color)]',
  positive: 'border-l-green-600',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
};

const CARD_FILL_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'bg-[var(--text-primary)]',
  positive: 'bg-green-600',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const BADGE_TONE_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)]',
  positive: 'border-green-600 bg-green-600/10 text-green-700',
  warning: 'border-yellow-500 bg-yellow-500/10 text-yellow-700',
  critical: 'border-red-500 bg-red-500/10 text-red-500',
};

const FLOW_LINE = '12,46 50,28 92,34 134,18 176,52 218,38 260,24 302,30';
const FLOW_BASE = '12,58 50,44 92,48 134,34 176,60 218,50 260,42 302,40';

export default function AttributionCard({
  t,
  title,
  subtitle = '',
  eyebrow = '',
  failureReason = '',
  badges = [],
  usageSummary,
  quotaDisplay,
  evidenceRows = [],
  tone = 'neutral',
  density = 'full',
  leadingAction,
  topActions,
  customBody,
  footer,
  className = '',
  style,
  interactive = true,
  onOpen,
}: AttributionCardProps) {
  const showAttribution = density !== 'compact';
  const accentBorderClass = CARD_TONE_CLASS[tone];
  const accentFillClass = CARD_FILL_CLASS[tone];
  const quotaWindows = quotaDisplay?.windows ?? [];
  const flow = buildTrafficCurveState(usageSummary);
  const sourceLabel =
    usageSummary?.source === 'attribution'
      ? 'ATTRIBUTION'
      : usageSummary?.source === 'legacy'
        ? 'LEGACY'
        : 'NONE';

  return (
    <AccountCardFrame
      className={`border-l-[6px] p-0 ${accentBorderClass} ${className}`}
      style={style}
      interactive={interactive}
      onOpen={onOpen}
    >
      <div className="flex min-h-[112px] items-start gap-4 border-b-[3px] border-[var(--border-color)] px-4 py-4">
        {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}
        <div className="min-w-0 flex-1 space-y-3">
          {eyebrow ? (
            <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {eyebrow}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className={`h-2.5 w-2.5 shrink-0 ${accentFillClass}`} />
              <h3 className="truncate text-[0.95rem] font-black leading-tight tracking-[0.02em] text-[var(--text-primary)]">
                {title}
              </h3>
            </div>
            {subtitle ? (
              <div className="break-all font-mono text-[0.625rem] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {subtitle}
              </div>
            ) : null}
            {failureReason ? (
              <div className="text-[0.625rem] font-black leading-relaxed text-red-500">{failureReason}</div>
            ) : null}
          </div>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={`${badge.label}-${badge.tone || 'neutral'}`}
                  className={`border px-2 py-1 font-mono text-[0.5625rem] font-black uppercase tracking-[0.14em] ${
                    BADGE_TONE_CLASS[badge.tone || 'neutral']
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {topActions ? <div className="shrink-0">{topActions}</div> : null}
      </div>

      {showAttribution ? (
        <>
          <section className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-4">
            <div className="flex min-h-[8.5rem] flex-col justify-between">
              <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.recent_requests')}
              </div>
              <div className="font-mono text-[2.5rem] font-black leading-none text-[var(--text-primary)]">
                {formatCountMetric(usageSummary?.requestCount ?? 0)}
              </div>
              <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {sourceLabel}
              </div>
            </div>

            <div className="min-w-0 border-l-2 border-[var(--border-color)] pl-3">
              <div className="mb-2 grid grid-cols-3 gap-2">
                <FlowHeadCell label={t('accounts.attribution_window')} value={formatTokenMetric(flow.windowTokens)} />
                <FlowHeadCell label={t('accounts.attribution_peak')} value={formatTokenMetric(flow.peakTokens)} />
                <FlowHeadCell label={t('accounts.attribution_now')} value={formatTokenMetric(flow.currentTokens)} />
              </div>
              <div
                className="relative h-[5.5rem] overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
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
                    stroke="rgb(86 118 136)"
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
                      fill={point.kind === 'latest' ? 'rgb(86 118 136)' : point.kind === 'peak' ? 'rgb(245 158 11)' : 'white'}
                      stroke={point.kind === 'peak' ? 'rgb(17 24 39)' : 'rgb(86 118 136)'}
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
          </section>

          <section className="grid grid-cols-4 border-b border-dashed border-[var(--border-color)]">
            <UsageCell label={t('accounts.recent_requests')} value={formatCountMetric(usageSummary?.requestCount ?? 0)} />
            <UsageCell label={t('accounts.total_tokens')} value={formatTokenMetric(usageSummary?.totalTokens ?? 0)} />
            <UsageCell label="CACHED" value={formatTokenMetric(usageSummary?.cachedInputTokens ?? 0)} />
            <UsageCell label={t('accounts.average_latency')} value={formatLatencyMetric(usageSummary?.averageLatencyMs ?? null)} />
          </section>

          <section className="grid gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-4">
            {quotaWindows.length > 0 ? (
              quotaWindows.map((window) => (
                <div key={window.id} className="grid grid-cols-[4.25rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                  <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {window.label}
                  </div>
                  <div
                    className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to right, color-mix(in srgb, var(--border-color) 12%, transparent) 0 8px, transparent 8px 14px)',
                    }}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${accentFillClass}`}
                      style={{ width: `${Math.max(0, window.remainingPercent ?? 0)}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-[0.625rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                    {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
                  </div>
                </div>
              ))
            ) : (
              <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {quotaDisplay?.status === 'loading' ? t('accounts.quota_syncing') : t('accounts.quota_unsupported')}
              </div>
            )}
          </section>

          <section className="grid gap-2 px-4 py-4">
            <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('accounts.card_evidence')}
            </div>
            {evidenceRows.length > 0 ? (
              evidenceRows.map((row) => (
                <div key={`${row.label}-${row.value}`} className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-3">
                  <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {row.label}
                  </div>
                  <div
                    className="truncate font-mono text-[0.625rem] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]"
                    title={row.title || row.value}
                  >
                    {row.value}
                  </div>
                </div>
              ))
            ) : (
              <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {t('accounts.ui_no_data_available')}
              </div>
            )}
          </section>
        </>
      ) : null}

      {customBody ? <div className="shrink-0 border-t-2 border-[var(--border-color)]">{customBody}</div> : null}
      {footer ? <div className="mt-auto px-4 pb-4">{footer}</div> : null}
    </AccountCardFrame>
  );
}

function FlowHeadCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[0.6875rem] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function UsageCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[4.5rem] border-r border-[var(--border-color)] px-3 py-3 last:border-r-0">
      <div className="font-mono text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 font-mono text-[0.8125rem] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function buildTrafficCurveState(summary?: AccountUsageSummary) {
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
  const points = buckets.map((bucket, index) => {
    const x = left + step * index;
    const y = height - bottom - (Math.max(0, bucket.totalTokens || 0) / max) * usableHeight;
    return {
      key: `${bucket.start}-${index}`,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      value: Math.max(0, bucket.totalTokens || 0),
      kind: 'normal' as 'normal' | 'latest' | 'peak',
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
    path: points.length > 1 ? path : `M 12 56 L 302 56`,
    points,
    windowTokens: summary?.totalTokens ?? 0,
    peakTokens: peakValue,
    currentTokens: values[values.length - 1] ?? 0,
  };
}

function formatCountMetric(value: number) {
  const normalized = Math.max(0, Number(value || 0));
  return new Intl.NumberFormat('zh-CN').format(normalized);
}

function formatTokenMetric(value: number) {
  const normalized = Math.max(0, Number(value || 0));
  if (normalized >= 1000000) {
    return `${trimDecimal(normalized / 1000000)}M`;
  }
  if (normalized >= 10000) {
    return `${trimDecimal(normalized / 10000)}W`;
  }
  return new Intl.NumberFormat('zh-CN').format(normalized);
}

function formatLatencyMetric(value: number | null) {
  if (!value || !Number.isFinite(value)) {
    return '—';
  }
  if (value >= 1000) {
    return `${trimDecimal(value / 1000)} S`;
  }
  return `${Math.round(value)} MS`;
}

function trimDecimal(value: number) {
  const normalized = Math.round(value * 10) / 10;
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1).replace(/\.0$/, '');
}
