import type { CSSProperties, ReactNode } from 'react';
import AccountCardFrame from './AccountCardFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { BillingDisplay } from '../../../types';
import type { QuotaDisplay, Translator } from '../model/types';
import { resolveAccountCardValueSection } from '../model/accountQuota';
import {
  AccountMiniMetrics,
  BillingBalance,
  QuotaBars,
  RateLimitGuard,
  TrafficSection,
  UnsupportedQuotaPlaceholder,
  UsageMetrics,
} from './CardSections';
import {
  ATTRIBUTION_CARD_BADGE_TONE_CLASS,
  ATTRIBUTION_CARD_TONE_BORDER_CLASS,
  ATTRIBUTION_CARD_TONE_FILL_CLASS,
  type AttributionCardTone,
} from './attributionCardTone';

type AttributionCardDensity = 'full' | 'compact' | 'list';

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
  failureReason?: string;
  badges?: AttributionCardBadge[];
  usageSummary?: AccountUsageSummary;
  quotaDisplay?: QuotaDisplay;
  billing?: BillingDisplay;
  rateLimitStatus?: RateLimitState;
  tone?: AttributionCardTone;
  density?: AttributionCardDensity;
  leadingAction?: ReactNode;
  topActions?: ReactNode;
  customBody?: ReactNode;
  footer?: ReactNode;
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
  failureReason = '',
  badges = [],
  usageSummary,
  quotaDisplay,
  billing,
  rateLimitStatus,
  tone = 'neutral',
  density = 'full',
  leadingAction,
  topActions,
  customBody,
  footer,
  className = '',
  cardID,
  style,
  interactive = true,
  onOpen,
}: AttributionCardProps) {
  const showAttribution = density !== 'compact';
  const accentBorderClass = ATTRIBUTION_CARD_TONE_BORDER_CLASS[tone];
  const accentFillClass = ATTRIBUTION_CARD_TONE_FILL_CLASS[tone];
  const resolvedQuotaDisplay = quotaDisplay ?? { status: 'unsupported', planType: '', windows: [] };
  const compactValueSection = resolveAccountCardValueSection(resolvedQuotaDisplay, billing);

  if (density === 'list') {
    return (
      <AccountCardFrame
        className={`min-h-[5rem] border-l-[8px] p-0 ${accentBorderClass} ${className}`}
        cardID={cardID}
        style={style}
        interactive={interactive}
        onOpen={onOpen}
      >
        <div className="account-card-list-row grid gap-3 px-3 py-3">
          <div className="grid min-w-0 gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-3 w-3 shrink-0 ${accentFillClass}`} />
              <h3 className="truncate text-[length:var(--font-size-ui-lg)] font-black uppercase leading-tight tracking-normal text-[var(--text-primary)]">
                {title}
              </h3>
              {eyebrow ? (
                <span className="shrink-0 border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {eyebrow}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {failureReason || subtitle || '—'}
            </div>
            {badges.length > 0 ? (
              <div className="flex min-w-0 flex-wrap gap-1">
                {badges.slice(0, 4).map((badge) => (
                  <span
                    key={`${badge.label}-${badge.tone || 'neutral'}`}
                    className={`border px-1.5 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] ${
                      ATTRIBUTION_CARD_BADGE_TONE_CLASS[badge.tone || 'neutral']
                    }`}
                  >
                    {badge.label}
                  </span>
                ))}
                {badges.length > 4 ? (
                  <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    +{badges.length - 4}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <AccountMiniMetrics usageSummary={usageSummary} quotaDisplay={resolvedQuotaDisplay} t={t} />

          {topActions ? <div className="account-card-list-actions justify-self-start">{topActions}</div> : null}
        </div>
        {customBody ? <div className="border-t-2 border-[var(--border-color)]">{customBody}</div> : null}
        {footer ? <div className="px-3 pb-3">{footer}</div> : null}
      </AccountCardFrame>
    );
  }

  return (
    <AccountCardFrame
      className={`border-l-[6px] p-0 ${accentBorderClass} ${className}`}
      cardID={cardID}
      style={style}
      interactive={interactive}
      onOpen={onOpen}
    >
      <div className="account-card-header relative flex min-h-[112px] items-start gap-4 border-b-[3px] border-[var(--border-color)] px-4 py-4">
        {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}
        <div className={`min-w-0 flex-1 space-y-3 ${topActions ? 'pr-10' : ''}`}>
          {eyebrow ? (
            <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {eyebrow}
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

      {density === 'compact' ? (
        compactValueSection === 'quota' ? (
          <QuotaBars quotaDisplay={resolvedQuotaDisplay} t={t} />
        ) : compactValueSection === 'billing' ? (
          <BillingBalance billing={billing} />
        ) : (
          <UnsupportedQuotaPlaceholder quotaDisplay={resolvedQuotaDisplay} billing={billing} t={t} />
        )
      ) : null}

      {showAttribution ? (
        <>
          <TrafficSection usageSummary={usageSummary} t={t} />

          <UsageMetrics usageSummary={usageSummary} t={t} />

          <QuotaBars quotaDisplay={resolvedQuotaDisplay} t={t} />
          <BillingBalance billing={billing} />
          <UnsupportedQuotaPlaceholder
            quotaDisplay={resolvedQuotaDisplay}
            billing={billing}
            t={t}
          />

          <RateLimitGuard rateLimitStatus={rateLimitStatus} />
        </>
      ) : null}

      {customBody ? <div className="shrink-0 border-t-2 border-[var(--border-color)]">{customBody}</div> : null}
      {footer ? <div className="mt-auto px-4 pb-4">{footer}</div> : null}
    </AccountCardFrame>
  );
}
