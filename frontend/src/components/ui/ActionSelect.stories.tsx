import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import ActionSelect from './ActionSelect';

const meta = {
  title: 'Design System/通用组件/操作选择',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ActionSelectSample({
  disabled = false,
  initialValue = 'codex',
  withDelete = false,
}: {
  disabled?: boolean;
  initialValue?: string;
  withDelete?: boolean;
}) {
  const { locale } = useI18n();
  const providerOptions = [
    { value: 'codex', label: 'Codex' },
    { value: 'openai-compatible', label: locale === 'zh' ? 'OpenAI 兼容供应商' : 'OpenAI Compatible' },
    {
      value: 'local-proxy-provider-with-long-name',
      label: locale === 'zh' ? '带长名称的本地代理供应商' : 'Local Proxy Provider With Long Name',
    },
  ];
  const [value, setValue] = useState(initialValue);

  return (
    <DesignSystemStoryFrame>
      <div className="w-full min-w-0">
        <ActionSelect
          title={locale === 'zh' ? '供应商' : 'Provider'}
          value={value}
          options={providerOptions}
          selectDisabled={disabled}
          createDisabled={disabled}
          deleteDisabled={disabled}
          onSelect={setValue}
          onCreate={() => setValue('openai-compatible')}
          onDelete={withDelete ? () => setValue(providerOptions[0].value) : undefined}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function StatePanel({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid min-h-[9rem] gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
      <div>
        <h3 className="text-sm font-black uppercase italic tracking-normal">{title}</h3>
        <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ActionSelectOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-6xl gap-4 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">ActionSelect</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '同一页面展示创建、删除、禁用和长内容状态，便于主题、字号和密度回归。'
            : 'All primary create, delete, disabled, and long-content states on one page for theme, text-scale, and density review.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatePanel
          title={zh ? '仅创建' : 'Create Only'}
          description={zh ? '只提供新增入口，不显示删除动作。' : 'Create action only, without a delete affordance.'}
        >
          <ActionSelectSample />
        </StatePanel>

        <StatePanel
          title={zh ? '创建和删除' : 'Create And Delete'}
          description={zh ? '选择已有项时同时展示新增和删除动作。' : 'Shows both create and delete actions for an existing option.'}
        >
          <ActionSelectSample withDelete />
        </StatePanel>

        <StatePanel
          title={zh ? '长内容' : 'Long Content'}
          description={zh ? '用于检查长供应商名称是否挤压右侧动作。' : 'Checks long provider names against the right-side actions.'}
        >
          <ActionSelectSample initialValue="local-proxy-provider-with-long-name" withDelete />
        </StatePanel>

        <StatePanel
          title={zh ? '禁用' : 'Disabled'}
          description={zh ? '选择、新增和删除动作全部禁用。' : 'Selection, create, and delete controls are all disabled.'}
        >
          <ActionSelectSample disabled withDelete />
        </StatePanel>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <ActionSelectOverview />,
};

export const CreateOnly: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ActionSelectSample />
    </div>
  ),
};

export const CreateAndDelete: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ActionSelectSample withDelete />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[28rem]">
      <ActionSelectSample disabled withDelete />
    </div>
  ),
};
