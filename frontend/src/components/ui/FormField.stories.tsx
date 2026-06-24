import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import FormField, { SelectField, TextInputField } from './FormField';

const meta = {
  title: 'Design System/通用组件/表单字段',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function FormFieldSample({ variant = 'select' }: { variant?: 'select' | 'input' | 'readonly' }) {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const [provider, setProvider] = useState('openai-compatible');
  const [timeout, setTimeout] = useState('600000');

  return (
    <DesignSystemStoryFrame>
      <div className="w-full min-w-0">
        {variant === 'select' ? (
          <SelectField
            title={zh ? '推理强度' : 'Reasoning Effort'}
            value={provider}
            options={[
              { value: 'minimal', label: 'minimal' },
              { value: 'openai-compatible', label: zh ? 'OpenAI 兼容供应商' : 'OpenAI Compatible' },
              { value: 'xhigh', label: 'xhigh' },
            ]}
            onChange={setProvider}
          />
        ) : variant === 'input' ? (
          <TextInputField
            title={zh ? '请求超时' : 'Request Timeout'}
            value={timeout}
            inputMode="numeric"
            onChange={(event) => setTimeout(event.target.value)}
          />
        ) : (
          <FormField title={zh ? '认证状态' : 'Auth State'} as="div">
            <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-primary)]">
              {zh ? 'ChatGPT 授权已保留' : 'ChatGPT auth preserved'}
            </div>
          </FormField>
        )}
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
    <section className="grid min-h-[9rem] gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
      <div>
        <h3 className="text-sm font-semibold tracking-normal">{title}</h3>
        <p className="mt-1 text-xs font-semibold text-[var(--gt-ink-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function FormFieldOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-5xl gap-4 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">FormField</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          {zh
            ? '统一字段标题、select、input 和只读状态，确保业务区块里的字段标签都可被设计系统追踪。'
            : 'Shared field labels, select, input, and read-only states so business panels remain trackable by the design system.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatePanel
          title={zh ? '选择字段' : 'Select Field'}
          description={zh ? '用于固定选项和配置枚举。' : 'For fixed options and configuration enums.'}
        >
          <FormFieldSample variant="select" />
        </StatePanel>
        <StatePanel
          title={zh ? '输入字段' : 'Input Field'}
          description={zh ? '用于数字、文本和只读 input。' : 'For numeric, text, and read-only inputs.'}
        >
          <FormFieldSample variant="input" />
        </StatePanel>
        <StatePanel
          title={zh ? '只读展示' : 'Read Only'}
          description={zh ? '用于状态摘要或非表单控件内容。' : 'For status summaries or non-control content.'}
        >
          <FormFieldSample variant="readonly" />
        </StatePanel>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <FormFieldOverview />,
};

export const Select: Story = {
  render: () => (
    <div className="w-[24rem]">
      <FormFieldSample variant="select" />
    </div>
  ),
};

export const Input: Story = {
  render: () => (
    <div className="w-[24rem]">
      <FormFieldSample variant="input" />
    </div>
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <div className="w-[24rem]">
      <FormFieldSample variant="readonly" />
    </div>
  ),
};
