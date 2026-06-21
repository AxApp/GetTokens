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
  ATTRIBUTION_CARD_TONE_FILL_CLASS,
  ATTRIBUTION_CARD_TONE_GLOW_CLASS,
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

function resolveAttributionCardBadgePriority(badge: AttributionCardBadge) {
  if (badge.tone === 'critical') return 0;
  if (badge.tone === 'warning') return 1;
  if (badge.backgroundColor) return 2;
  return 3;
}

function compareAttributionCardBadges(a: AttributionCardBadge, b: AttributionCardBadge) {
  return resolveAttributionCardBadgePriority(a) - resolveAttributionCardBadgePriority(b);
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
  const accentFillClass = ATTRIBUTION_CARD_TONE_FILL_CLASS[tone];
  const glowClass = ATTRIBUTION_CARD_TONE_GLOW_CLASS[tone];
  const resolvedQuotaDisplay = quotaDisplay ?? { status: 'unsupported', planType: '', windows: [] };
  const priorityBadges = [...badges].sort(compareAttributionCardBadges);
  const overlayFrameClass =
    density === 'list'
      ? 'absolute -inset-y-0.5 -left-2 -right-0.5 z-20'
      : 'absolute -inset-y-0.5 -left-1.5 -right-0.5 z-20';
  const routeGuardFrameDebugLabel = buildRouteGuardFrameDebugLabel(rateLimitStatus);

  // ── List density ──
  if (density === 'list') {
    const planBadge = priorityBadges.find((badge) => badge.backgroundColor) ?? null;
    const firstQuotaWindow = resolvedQuotaDisplay.windows?.[0];
    const quotaStatusText = firstQuotaWindow
      ? `${firstQuotaWindow.label} ${firstQuotaWindow.remainingPercent === null ? '--' : `${firstQuotaWindow.remainingPercent}%`}`
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
    ].filter(Boolean).join(' · ');
    const secondaryCopy = failureReason || subtitle;

    return (
      <AccountCardFrame
        className={`min-h-[4.5rem] p-0 ${glowClass} ${className}`}
        cardID={cardID}
        style={style}
        interactive={interactive}
        openDetailsLabel={`${t('common.details')}: ${title}`}
        debugLabel={routeGuardFrameDebugLabel}
        onOpen={onOpen}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${accentFillClass}`} />
              <span
                className="min-w-0 truncate text-xs font-medium"
                style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}
              >
                {listStatusText || listEyebrow}
              </span>
            </div>
            <h3
              className="truncate text-sm font-semibold leading-tight"
              style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-sans)' }}
            >
              {title}
            </h3>
            {secondaryCopy ? (
              <div
                className="min-w-0 truncate text-xs"
                style={{
                  color: failureReason ? 'var(--gt-status-danger)' : 'var(--gt-ink-muted)',
                  fontFamily: 'var(--gt-font-family-mono)',
                }}
              >
                {secondaryCopy}
              </div>
            ) : null}
          </div>
          {topActions ? <div className="shrink-0">{topActions}</div> : null}
        </div>
        {customBody ? <div style={{ borderTop: '1px solid var(--gt-border-subtle)' }}>{customBody}</div> : null}
        {footer ? <div className="px-3 pb-3">{footer}</div> : null}
        {overlay ? <div className={overlayFrameClass}>{overlay}</div> : null}
      </AccountCardFrame>
    );
  }

  // ── Full density ──
  return (
    <AccountCardFrame
      className={`p-0 ${glowClass} ${className}`}
      cardID={cardID}
      style={style}
      interactive={interactive}
      openDetailsLabel={`${t('common.details')}: ${title}`}
      debugLabel={routeGuardFrameDebugLabel}
      onOpen={onOpen}
    >
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--gt-border-subtle)' }}>
        <div className="min-w-0 space-y-1.5">
          {eyebrow || eyebrowPrefix || priorityBadges.length > 0 || topActions ? (
            <div className="account-card-meta-action-row -mr-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              {eyebrow || eyebrowPrefix || priorityBadges.length > 0 ? (
                <div
                  className="account-card-meta-row col-start-1 flex min-w-0 flex-nowrap items-center gap-x-1.5 overflow-hidden text-[length:var(--gt-font-size-sm-plus)] font-semibold leading-none"
                  style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${accentFillClass}`} />
                  {eyebrowPrefix ? (
                    <span className="shrink-0" style={{ color: 'var(--gt-ink-primary)' }}>{eyebrowPrefix}</span>
                  ) : null}
                  {eyebrow ? <span className="min-w-0 truncate">{eyebrow}</span> : null}
                  {priorityBadges.length > 0 ? (
                    <div className="account-card-meta-badges flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                      {priorityBadges.map((badge) => (
                        <span
                          key={`${badge.label}-${badge.tone || 'neutral'}`}
                          data-account-card-badge-priority={resolveAttributionCardBadgePriority(badge)}
                          title={badge.label}
                          style={badge.backgroundColor ? { backgroundColor: badge.backgroundColor } : undefined}
                          className={`account-card-meta-badge shrink-0 truncate rounded border px-1.5 py-0.5 text-[length:var(--gt-font-size-sm)] font-semibold leading-none ${ATTRIBUTION_CARD_BADGE_TONE_CLASS[badge.tone || 'neutral']}`}
                        >
                          {badge.shortLabel || badge.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {topActions ? <div className="col-start-2 shrink-0 justify-self-end">{topActions}</div> : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <h3
              className="truncate text-sm font-semibold leading-tight"
              style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-sans)' }}
            >
              {title}
            </h3>
          </div>
        </div>
        {subtitle ? (
          <div
            className="mt-1.5 break-all text-xs"
            style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}
          >
            {subtitle}
          </div>
        ) : null}
        {failureReason ? (
          <div className="mt-1.5 text-xs font-medium" style={{ color: 'var(--gt-status-danger)' }}>{failureReason}</div>
        ) : null}
      </div>

      {/* Content sections */}
      <QuotaBars quotaDisplay={resolvedQuotaDisplay} t={t} />
      <BillingBalance billing={billing} />
      <RateLimitGuard rateLimitStatus={rateLimitStatus} usageSummary={usageSummary} refreshing={rateLimitRefreshing || usageRefreshing} t={t} />

      {customBody ? <div className="shrink-0" style={{ borderTop: '1px solid var(--gt-border-subtle)' }}>{customBody}</div> : null}
      {footer ? <div className="mt-auto px-4 pb-3 pt-2" style={{ borderTop: '1px solid var(--gt-border-subtle)' }}>{footer}</div> : null}
      {overlay ? <div className={overlayFrameClass}>{overlay}</div> : null}
    </AccountCardFrame>
  );
}
