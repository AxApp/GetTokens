import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import SearchInput from './SearchInput';

const meta = {
  title: 'Design System/通用组件/搜索输入',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function SearchInputSample({
  disabled = false,
  initialValue = '',
  narrow = false,
}: {
  disabled?: boolean;
  initialValue?: string;
  narrow?: boolean;
}) {
  const { locale, t } = useI18n();
  const [value, setValue] = useState(initialValue);

  return (
    <DesignSystemStoryFrame>
      <div className={narrow ? 'w-56 max-w-full' : 'w-96 max-w-full'}>
        <SearchInput
          value={value}
          onChange={setValue}
          disabled={disabled}
          clearLabel={t('common.reset')}
          placeholder={locale === 'zh' ? '搜索名称 / 命令 / URL' : 'Search name / command / URL'}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function SearchInputOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-5xl gap-4 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-normal">SearchInput</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--gt-ink-muted)]">
          {zh
            ? '统一带搜索图标、清除按钮、禁用态和窄容器压力的搜索输入。'
            : 'Unified search field with icon, clear action, disabled state, and narrow-width pressure.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-3 border-[1px] border-[color:color-mix(in_srgb,var(--gt-border-strong)_55%,transparent)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase tracking-normal">{zh ? '默认' : 'Default'}</h3>
          <SearchInputSample />
        </section>
        <section className="grid gap-3 border-[1px] border-[color:color-mix(in_srgb,var(--gt-border-strong)_55%,transparent)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase tracking-normal">{zh ? '带值' : 'Filled'}</h3>
          <SearchInputSample initialValue="filesystem" />
        </section>
        <section className="grid gap-3 border-[1px] border-[color:color-mix(in_srgb,var(--gt-border-strong)_55%,transparent)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase tracking-normal">{zh ? '窄容器' : 'Narrow'}</h3>
          <SearchInputSample initialValue="tool search" narrow />
        </section>
        <section className="grid gap-3 border-[1px] border-[color:color-mix(in_srgb,var(--gt-border-strong)_55%,transparent)] bg-[var(--gt-surface-canvas)] p-4">
          <h3 className="text-sm font-black uppercase tracking-normal">{zh ? '禁用' : 'Disabled'}</h3>
          <SearchInputSample initialValue="readonly" disabled />
        </section>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <SearchInputOverview />,
};

export const Default: Story = {
  render: () => <SearchInputSample />,
};

export const Filled: Story = {
  render: () => <SearchInputSample initialValue="filesystem" />,
};

export const Disabled: Story = {
  render: () => <SearchInputSample initialValue="readonly" disabled />,
};
