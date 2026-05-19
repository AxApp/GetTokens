import type { ReactNode } from 'react';

interface WorkspacePageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  align?: 'end' | 'center';
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  actionsClassName?: string;
}

export default function WorkspacePageHeader({
  title,
  subtitle,
  actions,
  align = 'end',
  className = '',
  titleClassName = 'text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]',
  subtitleClassName = 'mt-2 max-w-[min(42rem,70vw)] truncate whitespace-nowrap text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]',
  actionsClassName = 'flex items-center justify-end gap-3',
}: WorkspacePageHeaderProps) {
  return (
    <header
      data-design-system-component="true"
      data-design-system-component-name="WorkspacePageHeader"
      className={`flex flex-wrap justify-between gap-4 border-b-4 border-[var(--border-color)] pb-4 ${
        align === 'center' ? 'items-center' : 'items-end'
      } ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        <h2 className={titleClassName}>{title}</h2>
        {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={actionsClassName}>{actions}</div> : null}
    </header>
  );
}
