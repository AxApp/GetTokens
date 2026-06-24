import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { getVendorPresets } from '../../features/accounts/model/vendorPresets';

interface ColorToken {
  name: string;
  usage: string;
}

interface FixedColor {
  name: string;
  value: string;
  usage: string;
  source: string;
}

const themeTokens: ColorToken[] = [
  { name: '--gt-surface-canvas', usage: '主应用背景、输入框背景、按钮默认背景' },
  { name: '--gt-surface-panel', usage: '面板和页面二级表面' },
  { name: '--gt-surface-raised', usage: '抬升卡片和浮层表面' },
  { name: '--gt-surface-muted', usage: '弱化内嵌表面、骨架屏、低权重块背景' },
  { name: '--gt-ink-primary', usage: '主文本、主图标、强对比图形' },
  { name: '--gt-ink-secondary', usage: '辅助文本 token' },
  { name: '--gt-ink-muted', usage: '说明文字、弱 meta' },
  { name: '--gt-ink-inverse', usage: '强调色、状态色上的反白文本' },
  { name: '--gt-border-subtle', usage: '弱分割线和卡片边界' },
  { name: '--gt-border-default', usage: '默认控件边框' },
  { name: '--gt-border-strong', usage: '主要结构线、强控件边框' },
  { name: '--gt-focus-ring', usage: '键盘焦点和高优先级可操作控件描边' },
  { name: '--gt-accent-primary', usage: '当前皮肤的品牌强调色' },
  { name: '--gt-accent-hover', usage: '主强调色悬停态' },
  { name: '--gt-shadow-overlay', usage: '模态遮罩与浮层遮罩' },
];

const semanticColors: FixedColor[] = [
  { name: '--color-status-success', value: 'var(--color-status-success)', usage: '成功状态、复制成功、健康状态', source: 'style.css token' },
  { name: '--color-status-success-soft', value: 'var(--color-status-success-soft)', usage: 'Vendor Status 在线文本', source: 'style.css token' },
  { name: '--color-status-success-bar', value: 'var(--color-status-success-bar)', usage: 'Vendor Status 在线条', source: 'style.css token' },
  { name: '--color-status-warning', value: 'var(--color-status-warning)', usage: '警告状态、接近限额', source: 'style.css token' },
  { name: '--color-status-warning-soft', value: 'var(--color-status-warning-soft)', usage: 'Vendor Status 降级文本', source: 'style.css token' },
  { name: '--color-status-warning-bar', value: 'var(--color-status-warning-bar)', usage: 'Vendor Status 降级条', source: 'style.css token' },
  { name: '--color-status-danger', value: 'var(--color-status-danger)', usage: '错误状态、验证失败', source: 'style.css token' },
  { name: '--color-status-danger-soft', value: 'var(--color-status-danger-soft)', usage: 'Vendor Status 故障文本', source: 'style.css token' },
  { name: '--color-status-danger-bar', value: 'var(--color-status-danger-bar)', usage: 'Vendor Status 故障条', source: 'style.css token' },
];

const analyticsColors: FixedColor[] = [
  { name: '--color-chart-primary', value: 'var(--color-chart-primary)', usage: 'Usage Desk 主曲线、主柱状图', source: 'style.css token' },
  { name: '--color-chart-primary-area', value: 'var(--color-chart-primary-area)', usage: 'Usage Desk 主面积填充', source: 'style.css token' },
  { name: '--color-chart-secondary', value: 'var(--color-chart-secondary)', usage: 'Usage Desk 对比曲线、失败柱', source: 'style.css token' },
  { name: '--color-chart-secondary-area', value: 'var(--color-chart-secondary-area)', usage: 'Usage Desk 对比面积填充', source: 'style.css token' },
  { name: '--color-chart-blue', value: 'var(--color-chart-blue)', usage: '用量投影图表色', source: 'style.css token' },
  { name: '--color-chart-peak', value: 'var(--color-chart-peak)', usage: '归因卡峰值点', source: 'style.css token' },
  { name: '--color-chart-attribution', value: 'var(--color-chart-attribution)', usage: '归因卡流量曲线', source: 'style.css token' },
];

const vendorIconColors = Array.from(
  new Map(
    getVendorPresets()
      .flatMap((preset) => {
        if (!preset.iconColor) {
          return [];
        }
        const color: FixedColor = {
          name: preset.name,
          value: preset.iconColor,
          usage: `${preset.name} 供应商图标`,
          source: 'vendorPresets',
        };
        return [[preset.iconColor.toLowerCase(), color] as const];
      }),
  ).values(),
).sort((left, right) => left.value.localeCompare(right.value));

const meta = {
  title: 'Design System/令牌/颜色',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function useResolvedColor(cssValue: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [resolved, setResolved] = useState('');

  useEffect(() => {
    if (!ref.current) return;
    setResolved(window.getComputedStyle(ref.current).backgroundColor);
  }, [cssValue]);

  return { ref, resolved };
}

function TokenSwatch({
  token,
}: {
  token: ColorToken;
}) {
  const { ref, resolved } = useResolvedColor(`var(${token.name})`);

  return (
    <div>
      <div className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3 text-[var(--gt-ink-primary)]">
        <div
          ref={ref}
          className="h-16 rounded-md border border-[var(--gt-border-subtle)]"
          style={{ backgroundColor: `var(${token.name})` }}
        />
        <div className="min-w-0">
          <div className="font-mono text-[length:var(--gt-font-size-md)] font-semibold">{token.name}</div>
          <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            {resolved || '解析中'}
          </div>
          <div className="mt-2 text-[length:var(--gt-font-size-sm)] font-semibold leading-relaxed text-[var(--gt-ink-muted)]">
            {token.usage}
          </div>
        </div>
      </div>
    </div>
  );
}

function FixedSwatch({ color }: { color: FixedColor }) {
  const { ref, resolved } = useResolvedColor(color.value);

  return (
    <div className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3">
      <div
        ref={ref}
        className="h-16 rounded-md border border-[var(--gt-border-subtle)]"
        style={{ backgroundColor: color.value }}
      />
      <div className="min-w-0">
        <div className="font-mono text-[length:var(--gt-font-size-md)] font-semibold">{color.name}</div>
        <div className="mt-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
          {color.value}
        </div>
        <div className="mt-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
          {resolved || '解析中'}
        </div>
        <div className="mt-2 text-[length:var(--gt-font-size-sm)] font-semibold leading-relaxed text-[var(--gt-ink-muted)]">
          {color.usage}
        </div>
        <div className="mt-2 inline-flex border border-[var(--gt-border-strong)] px-2 py-0.5 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">
          {color.source}
        </div>
      </div>
    </div>
  );
}

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
        <h3 className="text-lg font-semibold tracking-normal">{title}</h3>
        <p className="mt-1 max-w-4xl text-[length:var(--gt-font-size-md)] font-semibold leading-relaxed text-[var(--gt-ink-muted)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function PaletteSample() {
  return (
    <div className="grid gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">颜色系统</h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-[var(--gt-ink-muted)]">
          这里展示项目当前实际使用的颜色入口。主题色、状态色、图表色和供应商图标色都从设计系统 token 进入业务代码。
        </p>
      </div>

      <TokenSection
        title="主题 token"
        description="项目只保留一套运行态 CSS 变量。组件应优先引用这些 token，不再按 App/Web 或系统深浅色维护平行色板。"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {themeTokens.map((token) => (
            <TokenSwatch key={token.name} token={token} />
          ))}
        </div>
      </TokenSection>

      <TokenSection
        title="语义状态色"
        description="成功、警告、错误和供应商状态页使用的语义 token，业务代码不再直接引用 Tailwind 红/绿/黄。"
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {semanticColors.map((color) => (
            <FixedSwatch key={color.name} color={color} />
          ))}
        </div>
      </TokenSection>

      <TokenSection
        title="图表与数据色"
        description="用量、归因和趋势图中使用的数据 token，覆盖主序列、对比序列、投影和峰值标记。"
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {analyticsColors.map((color) => (
            <FixedSwatch key={color.name} color={color} />
          ))}
        </div>
      </TokenSection>

      <TokenSection
        title="供应商图标色"
        description="供应商 preset 中配置的品牌图标色。它们通过 --color-provider-* token 暴露，只用于识别供应商。"
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {vendorIconColors.map((color) => (
            <FixedSwatch key={`${color.value}-${color.name}`} color={color} />
          ))}
        </div>
      </TokenSection>
    </div>
  );
}

export const Palette: Story = {
  render: () => <PaletteSample />,
};
