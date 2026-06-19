import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react';

type AccountDetailTone = 'neutral' | 'success' | 'warning' | 'danger';
export type AccountDetailSectionDensity = 'standard' | 'dense' | 'hero';
export type AccountDetailModuleStackLayout = 'flow' | 'cards' | 'bands';
export type AccountDetailSectionSpan = 'auto' | 'wide';

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
  standard: 'gap-2.5 p-4',
  dense: 'gap-2 p-3',
  hero: 'gap-3 p-5',
};

const sectionBodyDensityClassNames: Record<AccountDetailSectionDensity, string> = {
  standard: 'space-y-3',
  dense: 'space-y-2.5',
  hero: 'space-y-4',
};

const accountDetailSectionHeaderDividerClass =
  'border-b border-[var(--gt-border-subtle)] pb-2';
const accountDetailSectionTitleRowClass =
  'flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1';
const accountDetailSectionEyebrowClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailSectionTitleClass =
  'text-[length:var(--font-size-ui-md-compact)] font-semibold italic leading-snug tracking-normal text-[var(--text-primary)]';
const accountDetailSectionMetaClass =
  'min-w-0 break-words font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailBandShellClass =
  'grid min-w-0 grid-cols-[10.5rem_minmax(0,1fr)] border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const accountDetailBandMutedClass =
  'bg-[var(--gt-surface-muted)]';
const accountDetailBandRailClass =
  'min-w-0 border-r border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-4';
const accountDetailBandRailTitleClass =
  'mt-2 text-[length:var(--font-size-ui-lg-compact)] font-semibold italic leading-tight tracking-normal text-[var(--text-primary)]';
const accountDetailBandContentClass =
  'min-w-0 px-4 py-4';
const accountDetailBandActionDividerClass =
  'border-b border-[var(--gt-border-subtle)] pb-2';
const accountDetailSectionCardBorderClass =
  'border bg-[var(--gt-surface-canvas)]';
const accountDetailSectionTopBorderClass =
  'border-t';
const accountDetailSectionNoTopBorderClass =
  'border-t-0';
const accountDetailSectionShellBaseClass =
  'grid border-[var(--gt-border-subtle)]';
const accountDetailSectionMutedClass =
  'bg-[var(--gt-surface-muted)]';
const accountDetailBodyClass =
  'bg-[var(--gt-surface-canvas)]';
const accountDetailModuleSideClass =
  'min-w-0 border-t border-[var(--gt-border-subtle)] xl:border-l xl:border-t-0 xl:pl-6';
const accountDetailModuleBandsClass =
  'min-w-0 border-t border-[var(--gt-border-subtle)]';

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
  topBorder?: boolean;
  headerDivider?: boolean;
  bandActionDivider?: boolean;
  railControls?: ReactNode;
  className?: string;
}

interface AccountDetailSectionHeaderProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  divider?: boolean;
}

export function AccountDetailSectionHeader({
  eyebrow,
  title,
  meta,
  actions,
  className = '',
  divider = true,
}: AccountDetailSectionHeaderProps) {
  const dividerClassName = divider
    ? accountDetailSectionHeaderDividerClass
    : '';
  return (
    <div
      data-account-detail-section-header="standard"
      className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${dividerClassName} ${className}`}
    >
      <div data-account-detail-section-title-row="compact" className={accountDetailSectionTitleRowClass}>
        {eyebrow ? (
          <div className={accountDetailSectionEyebrowClass}>
            {eyebrow}
          </div>
        ) : null}
        {title ? (
          <h3 className={accountDetailSectionTitleClass}>
            {title}
          </h3>
        ) : null}
        {meta ? (
          <div className={accountDetailSectionMetaClass}>
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div data-account-detail-section-action-row="compact" className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{actions}</div> : null}
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
  topBorder = true,
  headerDivider = true,
  bandActionDivider = true,
  railControls,
  className = '',
}: AccountDetailSectionProps) {
  const moduleLayout = useContext(AccountDetailModuleLayoutContext);
  const isBandLayout = moduleLayout === 'bands' && !inset;
  const isCardLayout = moduleLayout === 'cards' && !inset;

  if (isBandLayout) {
    const bandActionDividerClassName = bandActionDivider
      ? accountDetailBandActionDividerClass
      : '';
    return (
      <section
        data-design-system-component="true"
        data-design-system-component-name={componentName}
        data-account-detail-section-layout="band"
        className={`${accountDetailBandShellClass} ${muted ? accountDetailBandMutedClass : ''} ${className}`}
      >
        <aside data-account-detail-band-index="true" className={accountDetailBandRailClass}>
          {eyebrow ? (
            <div className={accountDetailSectionEyebrowClass}>
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <h3 className={accountDetailBandRailTitleClass}>
              {title}
            </h3>
          ) : null}
          {railControls ? (
            <div data-account-detail-band-rail-controls="true" className="mt-5 grid gap-2">
              {railControls}
            </div>
          ) : null}
        </aside>
        <div className={accountDetailBandContentClass}>
          {meta || actions ? (
            <div className={`mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${bandActionDividerClassName}`}>
              {meta ? (
                <div className={accountDetailSectionMetaClass}>
                  {meta}
                </div>
              ) : <span />}
              {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
            </div>
          ) : null}
          <AccountDetailModuleLayoutContext.Provider value="flow">
            <div data-account-detail-section-body="compact" className={`min-w-0 ${sectionBodyDensityClassNames[density]}`}>
              {children}
            </div>
          </AccountDetailModuleLayoutContext.Provider>
        </div>
      </section>
    );
  }

  const shellClassName = isCardLayout
    ? cardSectionDensityClassNames[density]
    : inset
      ? `px-6 ${sectionDensityClassNames[density]}`
      : sectionDensityClassNames[density];
  const borderClassName = isCardLayout
    ? accountDetailSectionCardBorderClass
    : topBorder
      ? accountDetailSectionTopBorderClass
      : accountDetailSectionNoTopBorderClass;
  const spanClassName = isCardLayout && span === 'wide' ? 'lg:col-span-2' : '';
  const heightClassName = isCardLayout ? 'h-full' : '';

  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name={componentName}
      className={`${accountDetailSectionShellBaseClass} ${borderClassName} ${shellClassName} ${spanClassName} ${heightClassName} ${muted ? accountDetailSectionMutedClass : ''} ${className}`}
    >
      {eyebrow || title || meta || actions ? (
        <AccountDetailSectionHeader
          eyebrow={eyebrow}
          title={title}
          meta={meta}
          actions={actions}
          divider={headerDivider}
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
    <div {...props} data-account-detail-body="module-surface" className={`${accountDetailBodyClass} ${className}`}>
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
  const hasEvidence = Boolean(evidence);
  const gridClassName = hasEvidence
    ? 'grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
    : 'min-w-0';

  return (
    <AccountDetailModuleLayoutContext.Provider value="cards">
      <div
        data-account-detail-overview-grid="runtime-evidence"
        data-account-detail-overview-layout={hasEvidence ? 'split-50-50' : 'single'}
        data-account-detail-overview-equal-height={hasEvidence ? 'true' : undefined}
        className={`${gridClassName} ${className}`}
      >
        <div data-account-detail-overview-slot="runtime" className={hasEvidence ? 'min-w-0 h-full' : 'min-w-0'}>
          {runtime}
        </div>
        {hasEvidence ? (
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
        <aside className={accountDetailModuleSideClass}>
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
    : layout === 'bands'
      ? accountDetailModuleBandsClass
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
      <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-md)] font-black uppercase tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
      {meta ? (
        <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
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
      <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase italic text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="break-all text-[length:var(--font-size-ui-md)] font-black uppercase text-[var(--text-primary)]"
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
    <span className={`inline-flex min-h-7 items-center border px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${toneClassNames[tone]} ${className}`}>
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
  compact = false,
}: {
  rows: Array<{ label: ReactNode; value: ReactNode; title?: string }>;
  compact?: boolean;
}) {
  const outerClassName = compact
    ? 'grid mt-2'
    : 'grid overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]';
  const rowClassName = compact
    ? 'grid gap-1 py-1 md:grid-cols-[6rem_minmax(0,1fr)] md:items-start'
    : 'grid gap-2 border-b border-dashed border-[var(--border-color)] px-3 py-2.5 last:border-b-0 md:grid-cols-[8rem_minmax(0,1fr)] md:items-start';
  const labelClassName = compact
    ? 'font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]'
    : 'font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]';
  const valueClassName = compact
    ? 'min-w-0 break-all font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-primary)]'
    : 'min-w-0 break-all font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-normal text-[var(--text-primary)]';

  return (
    <div className={outerClassName}>
      {rows.map((row, index) => (
        <div key={`${String(row.label)}-${index}`} className={rowClassName}>
          <div className={labelClassName}>
            {row.label}
          </div>
          <div
            className={valueClassName}
            title={row.title}
          >
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
