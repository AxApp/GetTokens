import type { ReactNode } from 'react';

type AccountDetailTone = 'neutral' | 'success' | 'warning' | 'danger';

const toneClassNames: Record<AccountDetailTone, string> = {
  neutral: 'border-[var(--border-color)] text-[var(--text-muted)]',
  success: 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]',
  warning: 'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] text-[var(--color-status-warning)]',
  danger: 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]',
};

interface AccountDetailSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  inset?: boolean;
  muted?: boolean;
  className?: string;
}

export function AccountDetailSection({
  eyebrow,
  title,
  meta,
  actions,
  children,
  inset = false,
  muted = false,
  className = '',
}: AccountDetailSectionProps) {
  return (
    <section className={`${inset ? 'px-6 py-6' : 'space-y-3'} ${muted ? 'border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30' : ''} ${className}`}>
      {eyebrow || title || meta || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {eyebrow ? (
              <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h3 className="text-[length:var(--font-size-ui-sm)] font-black uppercase italic tracking-[0.08em] text-[var(--text-primary)]">
                {title}
              </h3>
            ) : null}
            {meta ? (
              <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {meta}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AccountDetailFieldGrid({
  children,
  columns = 3,
  className = '',
}: {
  children: ReactNode;
  columns?: 2 | 3;
  className?: string;
}) {
  const columnClassName = columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  return (
    <div className={`grid gap-4 border-b-2 border-dashed border-[var(--border-color)] pb-6 ${columnClassName} ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailField({
  label,
  value,
  title,
  align = 'left',
}: {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={`min-w-0 space-y-1 ${align === 'right' ? 'text-right' : ''}`}>
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase italic text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="break-all text-[length:var(--font-size-ui-md-compact)] font-black uppercase text-[var(--text-primary)]"
        title={title}
      >
        {value}
      </div>
    </div>
  );
}

export function AccountDetailPill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: AccountDetailTone;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-h-7 items-center border px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] ${toneClassNames[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function AccountDetailNotice({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: AccountDetailTone;
  className?: string;
}) {
  return (
    <div className={`border-2 px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide ${toneClassNames[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailEmptyState({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-2 border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-widest text-[var(--text-muted)] ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailEvidenceGrid({
  rows,
}: {
  rows: Array<{ label: ReactNode; value: ReactNode; title?: string }>;
}) {
  return (
    <div className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      {rows.map((row, index) => (
        <div key={`${String(row.label)}-${index}`} className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {row.label}
          </div>
          <div
            className="min-w-0 break-all font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]"
            title={row.title}
          >
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
