import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from 'antd';
import type { ReactNode } from 'react';
import { useI18n } from '../../context/I18nContext';

const familyRows = [
  ['--gt-font-family-sans', '界面字族', 'Interface family'],
  ['--gt-font-family-mono', '等宽字族', 'Monospace family'],
] as const;

const typeRows = [
  ['--gt-font-size-3xs', '3XS 极小标记', '3XS micro marker'],
  ['--gt-font-size-2xs', '2XS 标签', '2XS label'],
  ['--gt-font-size-xs', 'XS 徽标', 'XS badge'],
  ['--gt-font-size-sm', 'SM 元信息', 'SM metadata'],
  ['--gt-font-size-sm-plus', 'SM+ 代码辅助', 'SM+ code assist'],
  ['--gt-font-size-md-compact', 'MD 紧凑正文', 'MD compact body'],
  ['--gt-font-size-md', 'MD 控件', 'MD control'],
  ['--gt-font-size-lg-compact', 'LG 紧凑数值', 'LG compact metric'],
  ['--gt-font-size-lg', 'LG 正文', 'LG body'],
  ['--gt-font-size-xl', 'XL 区块状态', 'XL section status'],
  ['--gt-font-size-xl-plus', 'XL+ 卡片标题', 'XL+ card title'],
  ['--gt-font-size-2xl', '2XL 行标题', '2XL row title'],
  ['--gt-font-size-3xl', '3XL 小标题', '3XL small heading'],
  ['--gt-font-size-4xl', '4XL 指标标题', '4XL metric heading'],
  ['--gt-font-size-5xl', '5XL 页面标题', '5XL page title'],
  ['--gt-font-size-6xl', '6XL 大标题', '6XL large heading'],
  ['--gt-font-size-display', 'Display 工作台标题', 'Display workspace title'],
] as const;

const lineHeightRows = [
  ['--gt-line-height-none', '无行高压缩', 'Compressed'],
  ['--gt-line-height-tight', '紧凑标题', 'Tight heading'],
  ['--gt-line-height-body', '默认正文', 'Default body'],
  ['--gt-line-height-snug', '密集说明', 'Dense description'],
  ['--gt-line-height-relaxed', '长文本说明', 'Long-form copy'],
  ['--gt-line-height-loose', '宽松段落', 'Loose paragraph'],
] as const;

const tailwindRows = [
  ['text-xs', '--gt-font-size-xs'],
  ['text-sm', '--gt-font-size-lg'],
  ['text-base', '--gt-font-size-2xl'],
  ['text-lg', '--gt-font-size-3xl'],
  ['text-xl', '--gt-font-size-4xl'],
  ['text-2xl', '--gt-font-size-5xl'],
  ['text-3xl', '--gt-font-size-6xl'],
  ['text-4xl', '--gt-font-size-display'],
] as const;

const meta = {
  title: 'Design System/令牌/字体',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function TokenSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-5">
      <div>
        <h3 className="text-xl font-semibold tracking-normal">{title}</h3>
        <p className="mt-1 max-w-4xl text-[length:var(--gt-font-size-md)] font-semibold leading-relaxed text-[var(--gt-ink-muted)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ScaleSample() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid gap-5 bg-[var(--gt-surface-muted)] p-6 text-[var(--gt-ink-primary)]">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">字体系统</h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-[var(--gt-ink-muted)]">
          字族、字号、行高和 Tailwind 常用文字类都映射到设计系统 token。业务代码需要特殊尺寸时，使用
          {' '}text-[length:var(--gt-font-size-*)]，不再直接写 rem 字面量。
        </p>
      </div>

      <TokenSection title="字族 token" description="应用界面和等宽内容统一从 CSS 变量读取字体栈。">
        <div className="grid gap-3 md:grid-cols-2">
          {familyRows.map(([token, zhLabel, enLabel]) => (
            <Card key={token} size="small">
              <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">{token}</div>
              <div className="mt-2 break-all text-[length:var(--gt-font-size-lg)] font-semibold tracking-normal" style={{ fontFamily: `var(${token})` }}>
                {zh ? zhLabel : enLabel} / GetTokens / openai-compatible-provider
              </div>
            </Card>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="字号 token" description="覆盖当前项目中出现的所有固定 rem 字号，包含紧凑表格、卡片、标题和工作台展示字号。">
        <div className="grid gap-3">
          {typeRows.map(([token, zhLabel, enLabel]) => (
            <Card key={token} size="small">
              <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">{token}</div>
              <div className="mt-2 font-semibold tracking-normal" style={{ fontSize: `var(${token})` }}>
                {zh ? zhLabel : enLabel} / 长中文标签 / openai-compatible-provider-with-long-name / 1234567890
              </div>
            </Card>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="行高 token" description="常用 line-height 也进入设计系统，Tailwind leading 类作为语义映射保留。">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lineHeightRows.map(([token, zhLabel, enLabel]) => (
            <Card key={token} size="small">
              <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">{token}</div>
              <p className="mt-2 text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]" style={{ lineHeight: `var(${token})` }}>
                {zh ? zhLabel : enLabel} / 这是一段用于验证行高的说明文本，覆盖中文、英文和数字 123456。
              </p>
            </Card>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Tailwind 映射" description="项目里保留 text-xs / text-sm / text-2xl 等常用类，但它们现在由 tailwind.config.js 指向 token。">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {tailwindRows.map(([className, token]) => (
            <div key={className} className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3">
              <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">{className}</div>
              <div className="mt-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">{token}</div>
              <div className={`${className} mt-2 font-semibold tracking-normal`}>
                {zh ? '中文预览' : 'Preview'} / GT
              </div>
            </div>
          ))}
        </div>
      </TokenSection>
    </div>
  );
}

export const Scale: Story = {
  render: () => <ScaleSample />,
};
