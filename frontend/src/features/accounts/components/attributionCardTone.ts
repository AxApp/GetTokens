export type AttributionCardTone = 'neutral' | 'positive' | 'warning' | 'critical';

export const ATTRIBUTION_CARD_TONE_BORDER_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border-l-[var(--border-color)]',
  positive: 'border-l-green-600',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
};

export const ATTRIBUTION_CARD_TONE_FILL_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'bg-[var(--text-primary)]',
  positive: 'bg-[var(--color-status-success)]',
  warning: 'bg-[var(--color-status-warning)]',
  critical: 'bg-[var(--color-status-danger)]',
};

export const ATTRIBUTION_CARD_BADGE_TONE_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)]',
  positive: 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]',
  warning: 'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] text-[var(--color-status-warning)]',
  critical: 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]',
};
