export type AttributionCardTone = 'neutral' | 'positive' | 'warning' | 'critical';

export const ATTRIBUTION_CARD_TONE_FILL_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'bg-[var(--gt-ink-muted)]',
  positive: 'bg-[var(--gt-status-success)]',
  warning: 'bg-[var(--gt-status-warning)]',
  critical: 'bg-[var(--gt-status-danger)]',
};

export const ATTRIBUTION_CARD_TONE_TINT_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'account-card-status-tint account-card-status-tint-neutral',
  positive: 'account-card-status-tint account-card-status-tint-positive',
  warning: 'account-card-status-tint account-card-status-tint-warning',
  critical: 'account-card-status-tint account-card-status-tint-critical',
};

export const ATTRIBUTION_CARD_BADGE_TONE_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border border-[var(--gt-border-default)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
  positive: 'border border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
  warning: 'border border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] text-[var(--gt-status-warning)]',
  critical: 'border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]',
};
