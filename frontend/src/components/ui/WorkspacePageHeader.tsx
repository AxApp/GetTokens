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
      className={`flex flex-wrap justify-between gap-4 border-b pb-4 ${
        align === 'center' ? 'items-center' : 'items-end'
      } ${className}`.trim()}
      style={{ borderColor: 'var(--gt-border-subtle)' }}
    >
      <div className="min-w-0 flex-1">
        <h2
          className={`text-2xl font-bold ${titleClassName}`}
          style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-sans)' }}
        >
          {title}
        </h2>
        {subtitle ? (
          <div
            className={`mt-1 max-w-[min(42rem,70vw)] truncate whitespace-nowrap text-sm ${subtitleClassName}`}
            style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}
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
