import type { ReactNode } from 'react';

interface WorkspacePageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  align?: 'end' | 'center';
  titleClassName?: string;
  subtitleClassName?: string;
  actionsClassName?: string;
}

export default function WorkspacePageHeader({
  title,
  subtitle,
  actions,
  align = 'end',
  titleClassName = 'text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]',
  subtitleClassName = 'mt-1 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]',
  actionsClassName = 'flex items-center justify-end gap-3',
}: WorkspacePageHeaderProps) {
  return (
    <header className={`flex justify-between gap-6 border-b-4 border-[var(--border-color)] pb-4 ${align === 'center' ? 'items-center' : 'items-end'}`}>
      <div className="min-w-0 flex-1">
        <h2 className={titleClassName}>{title}</h2>
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={actionsClassName}>{actions}</div> : null}
    </header>
  );
}
