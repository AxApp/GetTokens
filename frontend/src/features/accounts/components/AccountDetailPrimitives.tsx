import { type ReactNode } from 'react';
import { Alert, Descriptions, Empty, Tag, Typography } from 'antd';

export type AccountDetailSectionSpan = 'auto' | 'wide';

/* ── Section ── */

export function AccountDetailSection({
  eyebrow,
  title,
  meta,
  actions,
  children,
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
  bandActionDivider?: boolean;
  railControls?: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col w-full min-w-0 space-y-3 py-6 ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-col select-text gap-2">
          {title && (
            <Typography.Title level={5} className="!m-0 !font-semibold">
              {title}
            </Typography.Title>
          )}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      {children}
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
    <Descriptions
      column={columns === 6 ? 6 : columns}
      size="small"
      className={className}
    >
      {children}
    </Descriptions>
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
    <Descriptions.Item label={label} className={className}>
      <div className="font-sans font-semibold tabular-nums">{value}</div>
      {meta && <div className="mt-1 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">{meta}</div>}
    </Descriptions.Item>
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
    <Tag
      color={
        tone === 'success' ? 'success' :
        tone === 'warning' ? 'warning' :
        tone === 'danger' ? 'error' : 'default'
      }
      className={`m-0 ${className}`}
    >
      {children}
    </Tag>
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
  return (
    <Alert
      type={
        tone === 'success' ? 'success' :
        tone === 'warning' ? 'warning' :
        tone === 'danger' ? 'error' : 'info'
      }
      message={children}
      className={className}
      showIcon={false}
    />
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
    <Empty
      description={children}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      className={className}
    />
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
    <Descriptions
      column={2}
      size="small"
      className={className}
    >
      {children}
    </Descriptions>
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
    <Descriptions.Item label={label} className={className}>
      <div className="break-all font-sans">{value}</div>
    </Descriptions.Item>
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
