export type AttributionCardTone = 'neutral' | 'positive' | 'warning' | 'critical';

export const ATTRIBUTION_CARD_TONE_BORDER_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border-l-[var(--border-color)]',
  positive: 'border-l-green-600',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
};

export const ATTRIBUTION_CARD_TONE_FILL_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'bg-[var(--text-primary)]',
  positive: 'bg-green-600',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

export const ATTRIBUTION_CARD_BADGE_TONE_CLASS: Record<AttributionCardTone, string> = {
  neutral: 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)]',
  positive: 'border-green-600 bg-green-600/10 text-green-700',
  warning: 'border-yellow-500 bg-yellow-500/10 text-yellow-700',
  critical: 'border-red-500 bg-red-500/10 text-red-500',
};
