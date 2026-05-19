import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';

const colorTokens = [
  ['--bg-main', '主应用背景', 'Primary app background'],
  ['--bg-surface', '二级页面表面', 'Secondary page surface'],
  ['--bg-muted', '弱化内嵌表面', 'Muted inset surface'],
  ['--border-color', '主要结构线', 'Primary structure line'],
  ['--text-primary', '主文本', 'Primary text'],
  ['--text-muted', '辅助文本', 'Secondary text'],
  ['--accent-red', '品牌 / 操作强调色', 'Brand/action accent'],
  ['--shadow-color', '硬阴影颜色', 'Hard shadow color'],
] as const;

const meta = {
  title: 'Design System/Tokens/Colors',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function PaletteSample() {
  const { locale } = useI18n();
  return (
    <div className="grid gap-4 bg-[var(--bg-surface)] p-8 md:grid-cols-2">
      {colorTokens.map(([token, zhUsage, enUsage]) => (
        <div key={token} className="card-swiss flex items-center gap-4">
          <div
            className="h-16 w-16 shrink-0 border-2 border-[var(--border-color)]"
            style={{ backgroundColor: `var(${token})` }}
          />
          <div className="min-w-0">
            <div className="font-mono text-[0.75rem] font-black">{token}</div>
            <div className="mt-1 text-[0.625rem] font-bold uppercase tracking-normal text-[var(--text-muted)]">
              {locale === 'zh' ? zhUsage : enUsage}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const Palette: Story = {
  render: () => <PaletteSample />,
};
