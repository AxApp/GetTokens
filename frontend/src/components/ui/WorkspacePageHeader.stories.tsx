import type { Meta, StoryObj } from '@storybook/react-vite';
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
    <div className="bg-[var(--bg-surface)] p-8">
      <DesignSystemStoryFrame>
        <WorkspacePageHeader
          title={locale === 'zh' ? '设计系统' : 'DESIGN SYSTEM'}
          subtitle={locale === 'zh' ? '组件工作台 / Token / 状态' : 'COMPONENT WORKBENCH / TOKENS / STATES'}
          actions={
            <div className="flex gap-3">
              <button type="button" className="btn-swiss">
                {locale === 'zh' ? '刷新' : 'Refresh'}
              </button>
              <button type="button" className="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]">
                {locale === 'zh' ? '发布' : 'Publish'}
              </button>
            </div>
          }
        />
      </DesignSystemStoryFrame>
    </div>
  );
}

function LongSubtitleSample() {
  const { locale } = useI18n();
  return (
    <div className="bg-[var(--bg-surface)] p-8">
      <DesignSystemStoryFrame>
        <WorkspacePageHeader
          title={locale === 'zh' ? '账号路由' : 'ACCOUNT ROUTING'}
          subtitle={
            locale === 'zh'
              ? '用于验证密集工作台页头行为的很长中文副标题'
              : 'VERY LONG SUBTITLE USED TO VERIFY TRUNCATION AND DENSE WORKBENCH HEADER BEHAVIOR'
          }
        />
      </DesignSystemStoryFrame>
    </div>
  );
}

function CenterAlignedSample() {
  const { locale } = useI18n();
  return (
    <div className="bg-[var(--bg-surface)] p-8">
      <DesignSystemStoryFrame>
        <WorkspacePageHeader
          align="center"
          title={locale === 'zh' ? '会话管理' : 'SESSION MANAGEMENT'}
          subtitle={locale === 'zh' ? '供应商 / 会话 / 消息' : 'PROVIDERS / SESSIONS / MESSAGES'}
          actions={
            <button type="button" className="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]">
              {locale === 'zh' ? '同步' : 'Sync'}
            </button>
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
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">WorkspacePageHeader</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '同屏检查普通动作、长副标题和垂直居中对齐。'
            : 'Standard actions, long subtitle, and center-aligned variants on one page.'}
        </p>
      </div>

      <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
        <HeaderWithActionsSample />
      </section>
      <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
        <LongSubtitleSample />
      </section>
      <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
        <CenterAlignedSample />
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <WorkspacePageHeaderOverview />,
};

export const WithActions: Story = {
  render: () => <HeaderWithActionsSample />,
};

export const LongSubtitle: Story = {
  render: () => <LongSubtitleSample />,
};
