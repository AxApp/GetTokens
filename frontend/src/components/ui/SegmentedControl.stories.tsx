import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import SegmentedControl from './SegmentedControl';

const meta = {
  title: 'Design System/通用组件/分段控制',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function useSegmentedSamples() {
  const { locale } = useI18n();
  const themes: ReadonlyArray<{ id: string; label: string }> =
    locale === 'zh'
      ? [
          { id: 'system', label: '跟随系统' },
          { id: 'light', label: '浅色' },
          { id: 'dark', label: '深色' },
        ]
      : [
          { id: 'system', label: 'SYSTEM' },
          { id: 'light', label: 'LIGHT' },
          { id: 'dark', label: 'DARK' },
        ];
  const density: ReadonlyArray<{ id: string; label: string }> =
    locale === 'zh'
      ? [
          { id: 'full', label: '完整' },
          { id: 'compact', label: '缩略' },
          { id: 'list', label: '列表' },
        ]
      : [
          { id: 'full', label: 'FULL' },
          { id: 'compact', label: 'COMPACT' },
          { id: 'list', label: 'LIST VIEW' },
        ];

  return { density, locale, themes };
}

function SegmentedOverview() {
  const { density, locale, themes } = useSegmentedSamples();
  const [themeValue, setThemeValue] = useState('system');
  const [densityValue, setDensityValue] = useState('compact');
  const [longValue, setLongValue] = useState('list');
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-5xl gap-4 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-normal">SegmentedControl</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '同一基础样式下检查短标签、长标签、窄容器和当前选中态，便于回归主题和字号变化。'
            : 'One base style checked across short labels, long labels, narrow width, and selected states for theme and text-scale review.'}
        </p>
      </div>

      <section className="grid gap-4 border-[1px] border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase tracking-normal">{zh ? '基础样式' : 'Base Style'}</h3>

        <div className="grid gap-4">
          <div className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-center">
            <span className="font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-normal text-[var(--text-muted)]">
              {zh ? '短标签' : 'Short'}
            </span>
            <DesignSystemStoryFrame>
              <SegmentedControl options={themes} value={themeValue} onChange={setThemeValue} />
            </DesignSystemStoryFrame>
          </div>

          <div className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-center">
            <span className="font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-normal text-[var(--text-muted)]">
              {zh ? '长标签' : 'Long'}
            </span>
            <DesignSystemStoryFrame>
              <div className="max-w-xl">
                <SegmentedControl options={density} value={longValue} onChange={setLongValue} />
              </div>
            </DesignSystemStoryFrame>
          </div>

          <div className="grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)] md:items-center">
            <span className="font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-normal text-[var(--text-muted)]">
              {zh ? '窄容器' : 'Narrow'}
            </span>
            <DesignSystemStoryFrame>
              <div className="w-56 max-w-full">
                <SegmentedControl options={density} value={densityValue} onChange={setDensityValue} />
              </div>
            </DesignSystemStoryFrame>
          </div>
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <SegmentedOverview />,
};
