import type { CSSProperties, ReactNode } from 'react';
import AccountCardFrame from './AccountCardFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import { buildRateLimitGuardRows, type RateLimitState } from '../model/rateLimit';
import type { BillingDisplay } from '../../../types';
import type { QuotaDisplay, Translator } from '../model/types';
import {
  BillingBalance,
  QuotaBars,
  RateLimitGuard,
  formatCountMetric,
  formatTokenMetric,
} from './CardSections';
import {
  ATTRIBUTION_CARD_BADGE_TONE_CLASS,
  ATTRIBUTION_CARD_TONE_BORDER_CLASS,
  ATTRIBUTION_CARD_TONE_FILL_CLASS,
  type AttributionCardTone,
} from './attributionCardTone';

type AttributionCardDensity = 'full' | 'list';


function buildRouteGuardFrameDebugLabel(rateLimitStatus?: RateLimitState) {
  const rows = buildRateLimitGuardRows(rateLimitStatus);
  if (rows.length === 0) return undefined;
  const statusLabel = rateLimitStatus?.blocked ? rateLimitStatus.blockReason || 'BLOCKED' : 'PASS';
  const rowSummary = rows.map((row) => `${row.label} ${row.valueLabel}`).join(' | ');
  return `ROUTE GUARD: ${statusLabel}${rowSummary ? ` · ${rowSummary}` : ''}`;
}

export interface AttributionCardBadge {
  label: string;
  shortLabel?: string;
  backgroundColor?: string;
  tone?: AttributionCardTone;
}

interface AttributionCardProps {
  t: Translator;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  eyebrowPrefix?: string;
  failureReason?: string;
  badges?: AttributionCardBadge[];
  usageSummary?: AccountUsageSummary;
  usageRefreshing?: boolean;
  quotaDisplay?: QuotaDisplay;
  billing?: BillingDisplay;
  rateLimitStatus?: RateLimitState;
  rateLimitRefreshing?: boolean;
  tone?: AttributionCardTone;
  density?: AttributionCardDensity;
  leadingAction?: ReactNode;
  topActions?: ReactNode;
  customBody?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  cardID?: string;
  style?: CSSProperties;
  interactive?: boolean;
  onOpen: () => void;
}

export default function AttributionCard({
  t,
  title,
  subtitle = '',
  eyebrow = '',
  eyebrowPrefix = '',
  failureReason = '',
  badges = [],
  usageSummary,
  usageRefreshing = false,
  quotaDisplay,
  billing,
  rateLimitStatus,
  rateLimitRefreshing = false,
  tone = 'neutral',
  density = 'full',
  leadingAction,
  topActions,
  customBody,
  footer,
  overlay,
  className = '',
  cardID,
  style,
  interactive = true,
  onOpen,
}: AttributionCardProps) {
  const accentBorderClass = ATTRIBUTION_CARD_TONE_BORDER_CLASS[tone];
  const accentFillClass = ATTRIBUTION_CARD_TONE_FILL_CLASS[tone];
  const resolvedQuotaDisplay = quotaDisplay ?? { status: 'unsupported', planType: '', windows: [] };
  const overlayFrameClass =
    density === 'list'
      ? 'absolute -inset-y-0.5 -left-2 -right-0.5 z-20'
      : 'absolute -inset-y-0.5 -left-1.5 -right-0.5 z-20';
  const routeGuardFrameDebugLabel = buildRouteGuardFrameDebugLabel(rateLimitStatus);

  if (density === 'list') {
    const planBadge = badges.find((badge) => badge.backgroundColor) ?? null;
    const firstQuotaWindow = resolvedQuotaDisplay.windows?.[0];
    const quotaStatusText = firstQuotaWindow
      ? `${firstQuotaWindow.label} ${
          firstQuotaWindow.remainingPercent === null
            ? '--'
            : `${firstQuotaWindow.remainingPercent}%`
        }`
      : quotaDisplay?.status === 'unsupported'
        ? t('accounts.quota_unsupported')
        : '';
    const listEyebrow = [eyebrowPrefix, eyebrow].filter(Boolean).join(' ');
    const listStatusText = [
      listEyebrow,
      planBadge ? (planBadge.shortLabel || planBadge.label) : '',
      `${t('accounts.recent_requests')} ${formatCountMetric(usageSummary?.requestCount ?? 0)}`,
      `${t('accounts.total_tokens')} ${formatTokenMetric(usageSummary?.totalTokens ?? 0)}`,
      quotaStatusText,
    ]
      .filter(Boolean)
      .join(' · ');
    const secondaryCopy = failureReason || subtitle;

    return (
      <AccountCardFrame
        className={`min-h-[5.25rem] border-l-[6px] p-0 ${accentBorderClass} ${className}`}
        cardID={cardID}
        style={style}
        interactive={interactive}
        openDetailsLabel={`${t('common.details')}: ${title}`}
        debugLabel={routeGuardFrameDebugLabel}
        onOpen={onOpen}
      >
        <div className="account-card-list-row grid gap-3 px-3 py-2.5">
          <div className="account-card-list-identity grid min-w-0 gap-1.5">
            <div className="account-card-list-status flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 ${accentFillClass}`} />
              <span className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {listStatusText || listEyebrow}
              </span>
            </div>
            <h3 className="truncate text-[length:var(--font-size-ui-xl)] font-black uppercase leading-tight tracking-normal text-[var(--text-primary)]">
              {title}
            </h3>
            {secondaryCopy ? (
              <div
                className={`account-card-list-endpoint flex min-w-0 items-center gap-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.06em] ${
                  failureReason ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
                }`}
              >
                <span className="shrink-0 text-[length:var(--font-size-ui-2xs)] tracking-[0.16em] opacity-70">
                  {failureReason ? t('common.status') : t('accounts.ui_base_url')}
                </span>
                <span className="min-w-0 truncate">{secondaryCopy}</span>
              </div>
            ) : null}
          </div>
          {topActions ? <div className="account-card-list-actions justify-self-start">{topActions}</div> : null}
        </div>
        {customBody ? <div className="border-t-2 border-[var(--border-color)]">{customBody}</div> : null}
        {footer ? <div className="px-3 pb-3">{footer}</div> : null}
        {overlay ? <div className={overlayFrameClass}>{overlay}</div> : null}
      </AccountCardFrame>
    );
  }

  return (
    <AccountCardFrame
      className={`border-l-[6px] p-0 ${accentBorderClass} ${className}`}
      cardID={cardID}
      style={style}
      interactive={interactive}
      openDetailsLabel={`${t('common.details')}: ${title}`}
      debugLabel={routeGuardFrameDebugLabel}
      onOpen={onOpen}
    >
      <div className="account-card-header relative flex min-h-[112px] items-start gap-4 border-b-[3px] border-[var(--border-color)] px-4 py-4">
        {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}
        <div className={`min-w-0 flex-1 space-y-3 ${topActions ? 'pr-10' : ''}`}>
          {eyebrow || eyebrowPrefix ? (
            <div className="flex min-w-0 items-center gap-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {eyebrowPrefix ? (
                <span className="shrink-0 tracking-normal text-[var(--text-primary)]">{eyebrowPrefix}</span>
              ) : null}
              {eyebrow ? <span className="min-w-0 truncate">{eyebrow}</span> : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className={`h-2.5 w-2.5 shrink-0 ${accentFillClass}`} />
              <h3 className="truncate text-[length:var(--font-size-ui-xl-plus)] font-black leading-tight tracking-[0.02em] text-[var(--text-primary)]">
                {title}
              </h3>
            </div>
            {subtitle ? (
              <div className="break-all font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {subtitle}
              </div>
            ) : null}
            {failureReason ? (
              <div className="text-[length:var(--font-size-ui-sm)] font-black leading-relaxed text-[var(--color-status-danger)]">{failureReason}</div>
            ) : null}
          </div>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={`${badge.label}-${badge.tone || 'neutral'}`}
                  title={badge.label}
                  style={badge.backgroundColor ? { backgroundColor: badge.backgroundColor } : undefined}
                  className={`border px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] ${
                    ATTRIBUTION_CARD_BADGE_TONE_CLASS[badge.tone || 'neutral']
                  }`}
                >
                  {badge.shortLabel || badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {topActions ? <div className="account-card-top-actions absolute right-4 top-4 z-10">{topActions}</div> : null}
      </div>

      <QuotaBars quotaDisplay={resolvedQuotaDisplay} t={t} />
      <BillingBalance billing={billing} />
      <RateLimitGuard rateLimitStatus={rateLimitStatus} usageSummary={usageSummary} refreshing={rateLimitRefreshing || usageRefreshing} t={t} />

      {customBody ? <div className="shrink-0 border-t-2 border-[var(--border-color)]">{customBody}</div> : null}
      {footer ? <div className="mt-auto border-t border-[var(--border-color)] px-4 pb-4 pt-3">{footer}</div> : null}
      {overlay ? <div className={overlayFrameClass}>{overlay}</div> : null}
    </AccountCardFrame>
  );
}
