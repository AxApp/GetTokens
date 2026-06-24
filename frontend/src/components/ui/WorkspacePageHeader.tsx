import type { ReactNode } from 'react';

interface WorkspacePageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  align?: 'end' | 'center';
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  metaClassName?: string;
  actionsClassName?: string;
}

export default function WorkspacePageHeader({
  title,
  subtitle,
  meta,
  actions,
  align = 'end',
  className = '',
  titleClassName = '',
  subtitleClassName = '',
  metaClassName = '',
  actionsClassName = '',
}: WorkspacePageHeaderProps) {
  return (
    <header
      data-design-system-component="true"
      data-design-system-component-name="WorkspacePageHeader"
      className={`flex flex-wrap justify-between gap-4 border-b border-[var(--gt-border-subtle)] pb-4 ${
        align === 'center' ? 'items-center' : 'items-end'
      } ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <h2
          className={`font-sans text-[length:var(--gt-font-size-page-title)] font-semibold text-[var(--gt-ink-primary)] ${titleClassName}`}
        >
          {title}
        </h2>
        {subtitle ? (
          <div
            className={`mt-1 max-w-[min(42rem,70vw)] truncate whitespace-nowrap font-sans text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)] ${subtitleClassName}`}
          >
            {subtitle}
          </div>
        ) : null}
        {meta ? <div className={`mt-2 min-w-0 ${metaClassName}`.trim()}>{meta}</div> : null}
      </div>
      {actions ? <div className={`flex items-center justify-end gap-3 ${actionsClassName}`}>{actions}</div> : null}
    </header>
  );
}
