import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../context/I18nContext';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import SnippetPre from './SnippetPre';

const meta = {
  title: 'Design System/通用组件/代码片段区域',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const plainLines = [
  '[model_providers.gettokens]',
  'name = "GetTokens Relay"',
  'base_url = "http://127.0.0.1:18317/v1"',
  'wire_api = "responses"',
];

const longLines = [
  '[workspace]',
  'relay_endpoint = "http://127.0.0.1:18317/v1/very/long/path/that/should/scroll/horizontally/instead/of-breaking-layout"',
  'model = "gpt-5.2"',
];

function SnippetPreSample({ long = false }: { long?: boolean }) {
  const lines = long ? longLines : plainLines;

  return (
    <DesignSystemStoryFrame>
      <SnippetPre className="max-h-56">
        {lines.map((line, index) => (
          <code key={`${index}-${line}`} className="block min-h-6 whitespace-pre text-[var(--text-primary)]">
            {line}
          </code>
        ))}
      </SnippetPre>
    </DesignSystemStoryFrame>
  );
}

function SnippetPreOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full max-w-5xl gap-4 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">SnippetPre</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '统一配置片段和 diff 预览的 pre 容器，让滚动、字号、底色和设计系统标记保持一致。'
            : 'Shared pre container for config snippets and diff previews, keeping scroll, type size, surface color, and design-system markers consistent.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '普通片段' : 'Plain snippet'}</h3>
          <SnippetPreSample />
        </section>
        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '长行滚动' : 'Long line'}</h3>
          <SnippetPreSample long />
        </section>
      </div>
    </div>
  );
}

export const Overview: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <SnippetPreOverview />,
};

export const Plain: Story = {
  render: () => (
    <div className="w-[32rem]">
      <SnippetPreSample />
    </div>
  ),
};

export const LongLine: Story = {
  render: () => (
    <div className="w-[32rem]">
      <SnippetPreSample long />
    </div>
  ),
};
