import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import WorkspacePageHeader from './WorkspacePageHeader';

const meta = {
  title: 'Design System/通用组件/工作区页头',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function HeaderWithActionsSample() {
  const { locale } = useI18n();
  return (
    <div className="bg-[var(--gt-surface-panel)] p-8">
      <DesignSystemStoryFrame>
        <WorkspacePageHeader
          title={locale === 'zh' ? '设计系统' : 'DESIGN SYSTEM'}
          subtitle={locale === 'zh' ? '组件工作台 / Token / 状态' : 'COMPONENT WORKBENCH / TOKENS / STATES'}
          actions={
            <div className="flex gap-3">
              <Button>
                {locale === 'zh' ? '刷新' : 'Refresh'}
              </Button>
              <Button type="primary">
                {locale === 'zh' ? '发布' : 'Publish'}
              </Button>
            </div>
          }
        />
      </DesignSystemStoryFrame>
    </div>
  );
}

function WorkspacePageHeaderOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">WorkspacePageHeader</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          {zh
            ? '工作区页头统一使用“设计系统”这一种标准样式。'
            : 'Workspace page headers use the Design System standard style.'}
        </p>
      </div>

      <HeaderWithActionsSample />
    </div>
  );
}

export const Overview: Story = {
  render: () => <WorkspacePageHeaderOverview />,
};
