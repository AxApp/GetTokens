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
  { name: '--gt-surface-canvas', usage: '主题画布背景，映射到 --bg-main' },
  { name: '--gt-surface-panel', usage: '面板和页面二级表面，映射到 --bg-surface' },
  { name: '--gt-surface-muted', usage: '弱化块背景，映射到 --bg-muted' },
  { name: '--gt-ink-primary', usage: '主文本和强对比图形，映射到 --text-primary' },
  { name: '--gt-ink-muted', usage: '辅助文本和弱 meta，映射到 --text-muted' },
  { name: '--gt-border-strong', usage: '主要结构线，映射到 --border-color' },
  { name: '--gt-focus-ring', usage: '键盘焦点和高优先级可操作控件描边' },
  { name: '--gt-accent-primary', usage: '当前皮肤的品牌强调色' },
  { name: '--bg-main', usage: '主应用背景、输入框背景、按钮默认背景' },
  { name: '--bg-surface', usage: '二级页面表面、Storybook 画布背景、卡片外层背景' },
  { name: '--bg-muted', usage: '弱化内嵌表面、骨架屏、低权重块背景' },
  { name: '--border-color', usage: '主要结构线、控件边框、卡片硬边' },
  { name: '--text-primary', usage: '主文本、主图标、反色按钮背景' },
  { name: '--text-muted', usage: '辅助文本、说明文字、弱 meta' },
  { name: '--text-secondary', usage: '兼容旧命名的辅助文本 token' },
  { name: '--text-on-accent', usage: '强调色、状态色上的反白文本' },
  { name: '--accent-red', usage: '危险动作、设计组件描边、项目内调试强调' },
  { name: '--accent-green', usage: '兼容旧命名的成功强调色' },
  { name: '--accent-yellow', usage: '兼容旧命名的警告强调色' },
  { name: '--shadow-color', usage: 'Swiss 硬阴影、按钮和卡片立体层' },
  { name: '--shadow-inset-color', usage: '图表和凹陷层的内阴影颜色' },
  { name: '--overlay-scrim-60', usage: '模态遮罩 60% 强度' },
  { name: '--overlay-scrim-70', usage: '模态遮罩 70% 强度' },
  { name: '--overlay-scrim-80', usage: '模态遮罩 80% 强度' },
  { name: '--overlay-scrim-85', usage: '危险确认遮罩 85% 强度' },
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

const neutralScaleColors: FixedColor[] = [
  { name: '--color-swiss-gray-300', value: 'var(--color-swiss-gray-300)', usage: 'Tailwind swiss.gray.300 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-400', value: 'var(--color-swiss-gray-400)', usage: 'Tailwind swiss.gray.400 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-500', value: 'var(--color-swiss-gray-500)', usage: 'Tailwind swiss.gray.500 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-600', value: 'var(--color-swiss-gray-600)', usage: 'Tailwind swiss.gray.600 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-700', value: 'var(--color-swiss-gray-700)', usage: 'Tailwind swiss.gray.700 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-800', value: 'var(--color-swiss-gray-800)', usage: 'Tailwind swiss.gray.800 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-900', value: 'var(--color-swiss-gray-900)', usage: 'Tailwind swiss.gray.900 兼容色阶', source: 'tailwind.config.js token' },
  { name: '--color-swiss-gray-950', value: 'var(--color-swiss-gray-950)', usage: 'Tailwind swiss.gray.950 兼容色阶', source: 'tailwind.config.js token' },
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

function useResolvedColor(cssValue: string, themeClass = '', themePreset = '') {
  const ref = useRef<HTMLDivElement | null>(null);
  const [resolved, setResolved] = useState('');

  useEffect(() => {
    if (!ref.current) return;
    setResolved(window.getComputedStyle(ref.current).backgroundColor);
  }, [cssValue, themeClass, themePreset]);

  return { ref, resolved };
}

function TokenSwatch({
  token,
  themeClass,
  themePreset,
}: {
  token: ColorToken;
  themeClass?: string;
  themePreset?: string;
}) {
  const { ref, resolved } = useResolvedColor(`var(${token.name})`, themeClass, themePreset);

  return (
    <div className={themeClass} data-theme-preset={themePreset}>
      <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 text-[var(--text-primary)]">
        <div
          ref={ref}
          className="h-16 border-2 border-[var(--border-color)]"
          style={{ backgroundColor: `var(${token.name})` }}
        />
        <div className="min-w-0">
          <div className="font-mono text-[length:var(--font-size-ui-md)] font-black">{token.name}</div>
          <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
            {resolved || '解析中'}
          </div>
          <div className="mt-2 text-[length:var(--font-size-ui-sm)] font-bold leading-relaxed text-[var(--text-muted)]">
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
    <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
      <div
        ref={ref}
        className="h-16 border-2 border-[var(--border-color)]"
        style={{ backgroundColor: color.value }}
      />
      <div className="min-w-0">
        <div className="font-mono text-[length:var(--font-size-ui-md)] font-black">{color.name}</div>
        <div className="mt-1 font-mono text-[length:var(--font-size-ui-xs)] font-bold uppercase text-[var(--text-muted)]">
          {color.value}
        </div>
        <div className="mt-1 font-mono text-[length:var(--font-size-ui-xs)] font-bold uppercase text-[var(--text-muted)]">
          {resolved || '解析中'}
        </div>
        <div className="mt-2 text-[length:var(--font-size-ui-sm)] font-bold leading-relaxed text-[var(--text-muted)]">
          {color.usage}
        </div>
        <div className="mt-2 inline-flex border border-[var(--border-color)] px-2 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">
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
    <section className="grid gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-5">
      <div>
        <h3 className="text-lg font-black uppercase italic tracking-normal">{title}</h3>
        <p className="mt-1 max-w-4xl text-[length:var(--font-size-ui-md)] font-bold leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function PaletteSample() {
  return (
    <div className="grid gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">颜色系统</h2>
        <p className="mt-2 max-w-4xl text-sm font-bold leading-relaxed text-[var(--text-muted)]">
          这里展示项目当前实际使用的颜色入口。主题色、状态色、图表色和供应商图标色都从设计系统 token 进入业务代码。
        </p>
      </div>

      <TokenSection
        title="主题 token"
        description="同一组 CSS 变量在浅色和深色主题下分别解析，组件应优先引用这些 token。"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="grid gap-3">
            <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              浅色主题
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {themeTokens.map((token) => (
                <TokenSwatch key={`light-${token.name}`} token={token} />
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              深色主题
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {themeTokens.map((token) => (
                <TokenSwatch key={`dark-${token.name}`} token={token} themeClass="dark" />
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Parchment Trust Console
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {themeTokens.map((token) => (
                <TokenSwatch
                  key={`parchment-${token.name}`}
                  token={token}
                  themePreset="parchment-trust-console"
                />
              ))}
            </div>
          </div>
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
        title="中性色阶"
        description="Tailwind swiss.gray 兼容色阶也进入 token，避免配置里保留孤立 hex。"
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {neutralScaleColors.map((color) => (
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
