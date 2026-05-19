import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';

const typeRows = [
  ['--font-size-ui-2xs', '2XS 标签', '2XS label'],
  ['--font-size-ui-xs', 'XS 徽标', 'XS badge'],
  ['--font-size-ui-sm', 'SM 元信息', 'SM metadata'],
  ['--font-size-ui-md', 'MD 控件', 'MD control'],
  ['--font-size-ui-lg', 'LG 正文', 'LG body'],
] as const;

const meta = {
  title: 'Design System/Tokens/Typography',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ScaleSample() {
  const { locale } = useI18n();
  return (
    <div className="grid gap-4 bg-[var(--bg-surface)] p-8">
      {typeRows.map(([token, zhLabel, enLabel]) => (
        <div key={token} className="card-swiss">
          <div className="font-mono text-[0.625rem] font-black text-[var(--text-muted)]">{token}</div>
          <div className="mt-2 font-black uppercase italic tracking-normal" style={{ fontSize: `var(${token})` }}>
            {locale === 'zh' ? zhLabel : enLabel} / 长中文标签 / openai-compatible-provider-with-long-name / 1234567890
          </div>
        </div>
      ))}
    </div>
  );
}

export const Scale: Story = {
  render: () => <ScaleSample />,
};
