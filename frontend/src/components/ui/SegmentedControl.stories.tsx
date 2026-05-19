import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import SegmentedControl from './SegmentedControl';

const meta = {
  title: 'Design System/Components/SegmentedControl',
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

function StatefulSegmentedControl({ variant }: { variant: 'theme' | 'density' }) {
  const { density, themes } = useSegmentedSamples();
  const options = variant === 'theme' ? themes : density;
  const [value, setValue] = useState<string>(options[0].id);

  return (
    <DesignSystemStoryFrame>
      <div className="w-96 max-w-full">
        <SegmentedControl options={options} value={value} onChange={setValue} />
      </div>
    </DesignSystemStoryFrame>
  );
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
        <h2 className="text-2xl font-black uppercase italic tracking-normal">SegmentedControl</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '一页查看短标签、长标签和当前选中态，便于检查主题和字号变化。'
            : 'Short labels, long labels, and selected states on one page for theme and text-scale review.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '主题模式' : 'Theme Mode'}</h3>
          <DesignSystemStoryFrame>
            <SegmentedControl options={themes} value={themeValue} onChange={setThemeValue} />
          </DesignSystemStoryFrame>
        </section>

        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '密度模式' : 'Density Mode'}</h3>
          <DesignSystemStoryFrame>
            <SegmentedControl options={density} value={densityValue} onChange={setDensityValue} />
          </DesignSystemStoryFrame>
        </section>

        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 lg:col-span-2">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '长标签压力' : 'Long Label Pressure'}</h3>
          <DesignSystemStoryFrame>
            <div className="max-w-xl">
              <SegmentedControl options={density} value={longValue} onChange={setLongValue} />
            </div>
          </DesignSystemStoryFrame>
        </section>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <SegmentedOverview />,
};

export const ThemeMode: Story = {
  render: () => <StatefulSegmentedControl variant="theme" />,
};

export const LongLabels: Story = {
  render: () => <StatefulSegmentedControl variant="density" />,
};
