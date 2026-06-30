import type { ReactNode } from 'react';
import { Card, Flex } from 'antd';
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
      <Flex vertical gap="large" className="w-full">
        <WorkspacePageHeader
          title={title}
          subtitle={subtitle}
          align="center"
          actions={actions}
          actionsClassName={actionsClassName}
        />

        <Card
          size="small"
          variant="outlined"
          className={`flex ${minHeightClassName} flex-col overflow-hidden ${panelClassName}`.trim()}
          styles={{ body: { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, padding: 0 } }}
        >
          {toolbar ? (
            <Flex
              wrap
              gap="small"
              className={`border-b border-[var(--gt-border-subtle)] p-3 ${toolbarClassName}`.trim()}
            >
              {toolbar}
            </Flex>
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
        </Card>
      </Flex>
    </div>
  );
}
