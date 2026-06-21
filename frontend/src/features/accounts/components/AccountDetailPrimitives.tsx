import { type ReactNode } from 'react';

export type AccountDetailSectionSpan = 'auto' | 'wide';

/* ── Section ── */

export function AccountDetailSection({
  eyebrow,
  title,
  meta,
  actions,
  children,
  componentName = 'AccountDetailSection',
  className = '',
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  componentName?: string;
  className?: string;
  // Legacy props (ignored, kept for backward compatibility)
  density?: string;
  span?: string;
  inset?: boolean;
  muted?: boolean;
  topBorder?: boolean;
  headerDivider?: boolean;
  bandActionDivider?: boolean;
  railControls?: ReactNode;
}) {
  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name={componentName}
      className={`space-y-3 ${className}`}
    >
      {(title || actions) && (
        <div className="space-y-2" style={{ userSelect: 'text' }}>
          {title && (
            <h3 className="font-semibold text-[var(--gt-ink-secondary)]" style={{ fontFamily: 'var(--gt-font-family-sans)' }}>
              {title}
            </h3>
          )}
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div style={{ userSelect: 'text' }}>{children}</div>
    </section>
  );
}

/* ── Stat Grid ── */

export function AccountDetailStatGrid({
  columns = 3,
  children,
  className = '',
}: {
  columns?: 2 | 3 | 6;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid overflow-hidden rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] ${columns === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailStatCell({
  label,
  value,
  meta,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 border-b border-r border-[var(--gt-border-subtle)] px-4 py-3 last:border-r-0 ${className}`}>
      <div className="truncate text-xs font-normal tracking-normal text-[var(--gt-ink-muted)]">{label}</div>
      <div className="mt-1 truncate font-semibold tabular-nums text-[var(--gt-ink-primary)]" style={{ fontFamily: 'var(--gt-font-family-sans)' }}>{value}</div>
      {meta && <div className="mt-1 truncate text-xs text-[var(--gt-ink-muted)]">{meta}</div>}
    </div>
  );
}

/* ── Pill ── */

export function AccountDetailPill({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const toneStyles: Record<string, string> = {
    neutral: 'border-[var(--gt-border-default)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
    success: 'border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-success)]',
    warning: 'border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,var(--gt-surface-canvas))] text-[var(--gt-status-warning)]',
    danger: 'border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)]',
  };
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2 py-1 text-xs font-normal ${toneStyles[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ── Notice ── */

export function AccountDetailNotice({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const toneStyles: Record<string, string> = {
    neutral: 'border-[var(--gt-border-default)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
    success: 'border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-success)]',
    warning: 'border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,var(--gt-surface-canvas))] text-[var(--gt-status-warning)]',
    danger: 'border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)]',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 font-normal leading-relaxed ${toneStyles[tone]} ${className}`}>
      {children}
    </div>
  );
}

/* ── Empty State ── */

export function AccountDetailEmptyState({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-6 text-center font-normal text-[var(--gt-ink-muted)] ${className}`}>
      {children}
    </div>
  );
}

/* ── Evidence Row ── */

export function AccountDetailEvidenceGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid overflow-hidden rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailEvidenceRow({
  label,
  value,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 border-b border-[var(--gt-border-subtle)] px-4 py-3 last:border-b-0 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start ${className}`}>
      <div className="truncate text-xs font-normal tracking-normal text-[var(--gt-ink-muted)]">{label}</div>
      <div className="min-w-0 break-all text-[var(--gt-ink-primary)]" style={{ fontFamily: 'var(--gt-font-family-sans)' }}>{value}</div>
    </div>
  );
}

/* ── Legacy backward-compatible exports ── */

export function AccountDetailBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`bg-[var(--gt-surface-canvas)] ${className}`}>{children}</div>;
}

export function AccountDetailModuleStack({
  layout = 'flow',
  children,
  className = '',
}: {
  layout?: string;
  children: ReactNode;
  className?: string;
  cardColumns?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function AccountDetailFieldGrid({
  columns = 2,
  children,
  className = '',
}: {
  columns?: 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-4 border-b border-[var(--gt-border-subtle)] pb-5 last:border-b-0 last:pb-0 ${columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailField({
  label,
  value,
  align = 'left',
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''} ${className}`}>
      <div className="font-normal text-[var(--gt-ink-muted)]">{label}</div>
      <div className="break-all font-normal text-[var(--gt-ink-primary)]">{value}</div>
    </div>
  );
}
