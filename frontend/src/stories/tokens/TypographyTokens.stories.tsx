import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useI18n } from '../../context/I18nContext';

const familyRows = [
  ['--font-family-ui', '界面字族', 'Interface family'],
  ['--font-family-mono', '等宽字族', 'Monospace family'],
] as const;

const typeRows = [
  ['--font-size-ui-3xs', '3XS 极小标记', '3XS micro marker'],
  ['--font-size-ui-2xs', '2XS 标签', '2XS label'],
  ['--font-size-ui-xs', 'XS 徽标', 'XS badge'],
  ['--font-size-ui-sm', 'SM 元信息', 'SM metadata'],
  ['--font-size-ui-sm-plus', 'SM+ 代码辅助', 'SM+ code assist'],
  ['--font-size-ui-md-compact', 'MD 紧凑正文', 'MD compact body'],
  ['--font-size-ui-md', 'MD 控件', 'MD control'],
  ['--font-size-ui-lg-compact', 'LG 紧凑数值', 'LG compact metric'],
  ['--font-size-ui-lg', 'LG 正文', 'LG body'],
  ['--font-size-ui-xl', 'XL 区块状态', 'XL section status'],
  ['--font-size-ui-xl-plus', 'XL+ 卡片标题', 'XL+ card title'],
  ['--font-size-ui-2xl', '2XL 行标题', '2XL row title'],
  ['--font-size-ui-3xl', '3XL 小标题', '3XL small heading'],
  ['--font-size-ui-4xl', '4XL 指标标题', '4XL metric heading'],
  ['--font-size-ui-5xl', '5XL 页面标题', '5XL page title'],
  ['--font-size-ui-6xl', '6XL 大标题', '6XL large heading'],
  ['--font-size-ui-display', 'Display 工作台标题', 'Display workspace title'],
] as const;

const lineHeightRows = [
  ['--line-height-ui-none', '无行高压缩', 'Compressed'],
  ['--line-height-ui-tight', '紧凑标题', 'Tight heading'],
  ['--line-height-ui-normal', '默认正文', 'Default body'],
  ['--line-height-ui-snug', '密集说明', 'Dense description'],
  ['--line-height-ui-relaxed', '长文本说明', 'Long-form copy'],
  ['--line-height-ui-loose', '宽松段落', 'Loose paragraph'],
] as const;

const tailwindRows = [
  ['text-xs', '--font-size-ui-xs'],
  ['text-sm', '--font-size-ui-lg'],
  ['text-base', '--font-size-ui-2xl'],
  ['text-lg', '--font-size-ui-3xl'],
  ['text-xl', '--font-size-ui-4xl'],
  ['text-2xl', '--font-size-ui-5xl'],
  ['text-3xl', '--font-size-ui-6xl'],
  ['text-4xl', '--font-size-ui-display'],
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
    <section className="grid gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-5">
      <div>
        <h3 className="text-xl font-black uppercase italic tracking-normal">{title}</h3>
        <p className="mt-1 max-w-4xl text-[length:var(--font-size-ui-md)] font-bold leading-relaxed text-[var(--text-muted)]">
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
    <div className="grid gap-5 bg-[var(--bg-surface)] p-6 text-[var(--text-primary)]">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">字体系统</h2>
        <p className="mt-2 max-w-4xl text-sm font-bold leading-relaxed text-[var(--text-muted)]">
          字族、字号、行高和 Tailwind 常用文字类都映射到设计系统 token。业务代码需要特殊尺寸时，使用
          {' '}text-[length:var(--font-size-*)]，不再直接写 rem 字面量。
        </p>
      </div>

      <TokenSection title="字族 token" description="应用界面和等宽内容统一从 CSS 变量读取字体栈。">
        <div className="grid gap-3 md:grid-cols-2">
          {familyRows.map(([token, zhLabel, enLabel]) => (
            <div key={token} className="card-swiss">
              <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-muted)]">{token}</div>
              <div className="mt-2 break-all text-[length:var(--font-size-ui-lg)] font-black uppercase italic tracking-normal" style={{ fontFamily: `var(${token})` }}>
                {zh ? zhLabel : enLabel} / GetTokens / openai-compatible-provider
              </div>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="字号 token" description="覆盖当前项目中出现的所有固定 rem 字号，包含紧凑表格、卡片、标题和工作台展示字号。">
        <div className="grid gap-3">
          {typeRows.map(([token, zhLabel, enLabel]) => (
            <div key={token} className="card-swiss">
              <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-muted)]">{token}</div>
              <div className="mt-2 font-black uppercase italic tracking-normal" style={{ fontSize: `var(${token})` }}>
                {zh ? zhLabel : enLabel} / 长中文标签 / openai-compatible-provider-with-long-name / 1234567890
              </div>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="行高 token" description="常用 line-height 也进入设计系统，Tailwind leading 类作为语义映射保留。">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lineHeightRows.map(([token, zhLabel, enLabel]) => (
            <div key={token} className="card-swiss">
              <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-muted)]">{token}</div>
              <p className="mt-2 text-[length:var(--font-size-ui-md)] font-bold text-[var(--text-primary)]" style={{ lineHeight: `var(${token})` }}>
                {zh ? zhLabel : enLabel} / 这是一段用于验证行高的说明文本，覆盖中文、英文和数字 123456。
              </p>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Tailwind 映射" description="项目里保留 text-xs / text-sm / text-2xl 等常用类，但它们现在由 tailwind.config.js 指向 token。">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {tailwindRows.map(([className, token]) => (
            <div key={className} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
              <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-muted)]">{className}</div>
              <div className="mt-1 font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">{token}</div>
              <div className={`${className} mt-2 font-black uppercase italic tracking-normal`}>
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
