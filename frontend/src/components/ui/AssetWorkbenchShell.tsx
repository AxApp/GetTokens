import type { ReactNode } from 'react';
import WorkspacePageHeader from './WorkspacePageHeader';

interface AssetWorkbenchShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  toolbar?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  dataCollaborationId?: string;
  className?: string;
  panelClassName?: string;
  contentClassName?: string;
  toolbarClassName?: string;
  asideClassName?: string;
  minHeightClassName?: string;
}

export default function AssetWorkbenchShell({
  title,
  subtitle,
  actions,
  actionsClassName,
  toolbar,
  notice,
  children,
  aside,
  dataCollaborationId,
  className = '',
  panelClassName = '',
  contentClassName = '',
  toolbarClassName = '',
  asideClassName = '',
  minHeightClassName = 'min-h-[30rem]',
}: AssetWorkbenchShellProps) {
  return (
    <div
      data-collaboration-id={dataCollaborationId}
      data-design-system-component="true"
      data-design-system-component-name="AssetWorkbenchShell"
      className={`scrollbar-stable h-full w-full overflow-auto p-6 text-[var(--gt-ink-primary)] lg:p-8 ${className}`.trim()}
    >
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={title}
          subtitle={subtitle}
          align="center"
          actions={actions}
          actionsClassName={actionsClassName}
        />

        <section
          className={`flex ${minHeightClassName} flex-col border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm ${panelClassName}`.trim()}
        >
          {toolbar ? (
            <div className={`grid gap-3 border-b border-[var(--gt-border-subtle)] p-3 lg:grid-cols-[minmax(0,24rem)_minmax(16rem,1fr)] ${toolbarClassName}`.trim()}>
              {toolbar}
            </div>
          ) : null}
          {notice}
          {aside ? (
            <div className={`grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] ${contentClassName}`.trim()}>
              <main className="min-w-0">{children}</main>
              <aside className={`grid content-start gap-0 border-t border-[var(--gt-border-subtle)] xl:border-l xl:border-t-0 ${asideClassName}`.trim()}>
                {aside}
              </aside>
            </div>
          ) : (
            <div className={contentClassName}>{children}</div>
          )}
        </section>
      </div>
    </div>
  );
}
