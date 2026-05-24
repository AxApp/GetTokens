import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react';

type AccountDetailTone = 'neutral' | 'success' | 'warning' | 'danger';
export type AccountDetailSectionDensity = 'standard' | 'dense' | 'hero';
export type AccountDetailModuleStackLayout = 'flow' | 'cards';
type AccountDetailSectionSpan = 'auto' | 'wide';

const AccountDetailModuleLayoutContext = createContext<AccountDetailModuleStackLayout>('flow');

const toneClassNames: Record<AccountDetailTone, string> = {
  neutral: 'border-[var(--border-color)] text-[var(--text-muted)]',
  success: 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]',
  warning: 'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] text-[var(--color-status-warning)]',
  danger: 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]',
};

const sectionDensityClassNames: Record<AccountDetailSectionDensity, string> = {
  standard: 'gap-3 py-4',
  dense: 'gap-2.5 py-3',
  hero: 'gap-4 py-5',
};

const cardSectionDensityClassNames: Record<AccountDetailSectionDensity, string> = {
  standard: 'gap-2.5 p-3',
  dense: 'gap-2 p-2.5',
  hero: 'gap-3 p-4',
};

const sectionBodyDensityClassNames: Record<AccountDetailSectionDensity, string> = {
  standard: 'space-y-3',
  dense: 'space-y-2.5',
  hero: 'space-y-4',
};

interface AccountDetailSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  componentName?: string;
  density?: AccountDetailSectionDensity;
  span?: AccountDetailSectionSpan;
  inset?: boolean;
  muted?: boolean;
  className?: string;
}

interface AccountDetailSectionHeaderProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AccountDetailSectionHeader({
  eyebrow,
  title,
  meta,
  actions,
  className = '',
}: AccountDetailSectionHeaderProps) {
  return (
    <div
      data-account-detail-section-header="standard"
      className={`flex min-w-0 flex-col gap-2 border-b border-dashed border-[var(--border-color)] pb-2 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        ) : null}
        {title ? (
          <h3 className="text-[length:var(--font-size-ui-xs)] font-black uppercase italic leading-snug tracking-[0.06em] text-[var(--text-primary)]">
            {title}
          </h3>
        ) : null}
        {meta ? (
          <div className="break-words font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function AccountDetailSection({
  eyebrow,
  title,
  meta,
  actions,
  children,
  componentName = 'AccountDetailSection',
  density = 'standard',
  span = 'auto',
  inset = false,
  muted = false,
  className = '',
}: AccountDetailSectionProps) {
  const moduleLayout = useContext(AccountDetailModuleLayoutContext);
  const isCardLayout = moduleLayout === 'cards' && !inset;
  const shellClassName = isCardLayout
    ? cardSectionDensityClassNames[density]
    : inset
      ? `px-6 ${sectionDensityClassNames[density]}`
      : sectionDensityClassNames[density];
  const borderClassName = isCardLayout
    ? 'border-2 bg-[var(--bg-main)]'
    : 'border-t-2';
  const spanClassName = isCardLayout && span === 'wide' ? 'lg:col-span-2' : '';
  const heightClassName = isCardLayout ? 'h-full' : '';

  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name={componentName}
      className={`grid border-[var(--border-color)] ${borderClassName} ${shellClassName} ${spanClassName} ${heightClassName} ${muted ? 'bg-[var(--bg-surface)]/35' : ''} ${className}`}
    >
      {eyebrow || title || meta || actions ? (
        <AccountDetailSectionHeader
          eyebrow={eyebrow}
          title={title}
          meta={meta}
          actions={actions}
        />
      ) : null}
      <div data-account-detail-section-body="compact" className={`min-w-0 ${sectionBodyDensityClassNames[density]}`}>
        {children}
      </div>
    </section>
  );
}

export function AccountDetailBody({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} data-account-detail-body="module-surface" className={`space-y-5 bg-[var(--bg-main)] px-6 py-5 ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailOverviewGrid({
  runtime,
  evidence,
  className = '',
}: {
  runtime: ReactNode;
  evidence?: ReactNode;
  className?: string;
}) {
  return (
    <AccountDetailModuleLayoutContext.Provider value="cards">
      <div
        data-account-detail-overview-grid="runtime-evidence"
        data-account-detail-overview-equal-height="true"
        className={`grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] ${className}`}
      >
        <div data-account-detail-overview-slot="runtime" className="min-w-0 h-full">
          {runtime}
        </div>
        {evidence ? (
          <aside data-account-detail-overview-slot="evidence" className="min-w-0 h-full">
            {evidence}
          </aside>
        ) : null}
      </div>
    </AccountDetailModuleLayoutContext.Provider>
  );
}

export function AccountDetailModuleGrid({
  main,
  side,
  className = '',
}: {
  main: ReactNode;
  side?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] ${className}`}>
      <div className="min-w-0">
        {main}
      </div>
      {side ? (
        <aside className="min-w-0 border-t-2 border-[var(--border-color)] xl:border-l-2 xl:border-t-0 xl:pl-6">
          {side}
        </aside>
      ) : null}
    </div>
  );
}

export function AccountDetailModuleStack({
  children,
  layout = 'flow',
  cardColumns = 2,
  className = '',
}: {
  children: ReactNode;
  layout?: AccountDetailModuleStackLayout;
  cardColumns?: 1 | 2;
  className?: string;
}) {
  const layoutClassName = layout === 'cards'
    ? `grid min-w-0 gap-4 ${cardColumns === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`
    : 'min-w-0';

  return (
    <AccountDetailModuleLayoutContext.Provider value={layout}>
      <div data-account-detail-module-layout={layout} className={`${layoutClassName} ${className}`}>
        {children}
      </div>
    </AccountDetailModuleLayoutContext.Provider>
  );
}

export function AccountDetailStatGrid({
  children,
  columns = 3,
  className = '',
}: {
  children: ReactNode;
  columns?: 2 | 3 | 6;
  className?: string;
}) {
  const columnClassName = columns === 6
    ? 'sm:grid-cols-2 xl:grid-cols-6'
    : columns === 2
      ? 'md:grid-cols-2'
      : 'md:grid-cols-3';

  return (
    <div className={`grid overflow-hidden border-2 border-[var(--border-color)] ${columnClassName} ${className}`}>
      {children}
    </div>
  );
}

export function AccountDetailStatCell({
  label,
  value,
  meta,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-r border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3">
      <div className="truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
      {meta ? (
        <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {meta}
        </div>
      ) : null}
    </div>
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
    <div className={`grid gap-4 border-b-2 border-dashed border-[var(--border-color)] pb-5 ${columnClassName} ${className}`}>
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
    <div className={`border-l-4 border-y border-r px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide ${toneClassNames[tone]} ${className}`}>
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
    <div className={`border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-6 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-widest text-[var(--text-muted)] ${className}`}>
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
    <div className="grid overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      {rows.map((row, index) => (
        <div key={`${String(row.label)}-${index}`} className="grid gap-2 border-b border-dashed border-[var(--border-color)] px-3 py-2.5 last:border-b-0 md:grid-cols-[8rem_minmax(0,1fr)] md:items-start">
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
