import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import { Combobox } from './Combobox';

const meta = {
  title: 'Design System/通用组件/组合框',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const modelOptions = [
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'claude-sonnet-4-5-20250929',
  'openai-compatible-provider-with-long-model-name',
];

function ComboboxSample({
  align = 'left',
  disabled = false,
  empty = false,
  initialValue,
}: {
  align?: 'left' | 'right';
  disabled?: boolean;
  empty?: boolean;
  initialValue?: string;
}) {
  const { locale } = useI18n();
  const [value, setValue] = useState(empty ? '' : initialValue || modelOptions[0]);

  return (
    <DesignSystemStoryFrame>
      <div className="w-full min-w-0">
        <Combobox
          align={align}
          value={value}
          options={empty ? [] : modelOptions}
          placeholder={locale === 'zh' ? '选择模型' : 'Select model'}
          disabled={disabled}
          onChange={setValue}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function ComboboxOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-6xl gap-4 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Combobox</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '同屏检查默认、长值、空选项、右对齐和禁用状态。'
            : 'Default, long value, empty options, right-aligned, and disabled states on one page.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '默认' : 'Default'}</h3>
          <ComboboxSample />
        </section>
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '长值' : 'Long Value'}</h3>
          <ComboboxSample initialValue="openai-compatible-provider-with-long-model-name" />
        </section>
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '空选项' : 'Empty Options'}</h3>
          <ComboboxSample empty />
        </section>
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '右对齐 / 禁用' : 'Right Aligned / Disabled'}</h3>
          <ComboboxSample align="right" disabled />
        </section>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <ComboboxOverview />,
};

export const Default: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ComboboxSample />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ComboboxSample disabled />
    </div>
  ),
};

export const EmptyOptions: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ComboboxSample empty />
    </div>
  ),
};
