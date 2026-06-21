import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import PageLoadingFallback from './PageLoadingFallback';

const meta = {
  title: 'Design System/通用组件/页面加载态',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function PageLoadingFallbackOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-4 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">PageLoadingFallback</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--gt-ink-muted)]">
          {zh
            ? '同屏检查不同容器高度下的动画加载态。'
            : 'Animated loading state across several container heights.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DesignSystemStoryFrame>
          <div className="h-32">
            <PageLoadingFallback />
          </div>
        </DesignSystemStoryFrame>
        <DesignSystemStoryFrame>
          <div className="h-56">
            <PageLoadingFallback />
          </div>
        </DesignSystemStoryFrame>
        <DesignSystemStoryFrame>
          <div className="h-80">
            <PageLoadingFallback />
          </div>
        </DesignSystemStoryFrame>
      </div>
    </div>
  );
}

export const Overview: Story = {
  render: () => <PageLoadingFallbackOverview />,
};

export const Default: Story = {
  render: () => (
    <DesignSystemStoryFrame>
      <div className="h-[22rem] bg-[var(--gt-surface-panel)]">
        <PageLoadingFallback />
      </div>
    </DesignSystemStoryFrame>
  ),
};
