import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import StatusSnippetPanel from './StatusSnippetPanel';

const meta = {
  title: 'Design System/业务组件/状态页片段面板',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const plainConfig = `[model_providers.gettokens]
name = "GetTokens Relay"
base_url = "http://127.0.0.1:18317/v1"
wire_api = "responses"
requires_openai_auth = true`;

const diffConfig = `--- CODEX_HOME/config.toml
+++ CODEX_HOME/config.toml
@@ local relay @@
-model = "gpt-5.1"
+model = "gpt-5.2"
+model_provider = "gettokens"
 # existing comments stay in place`;

const longConfig = `[workspace]
profile = "local-preview"
config_path = "/Users/example/.codex/config.toml"
relay_endpoint = "http://127.0.0.1:18317/v1/very/long/path/that/should/scroll/horizontally/instead/of-breaking-layout"
model = "gpt-5.2"
reasoning_effort = "high"`;

function SnippetSample({
  title = 'LOCAL CONFIG',
  content = plainConfig,
  copy = true,
  action = false,
}: {
  title?: string;
  content?: string;
  copy?: boolean;
  action?: boolean;
}) {
  return (
    <DesignSystemStoryFrame label="DS-SNIP">
      <StatusSnippetPanel
        title={title}
        content={content}
        onCopy={copy ? () => undefined : undefined}
        headerAction={
          action ? (
            <Button size="small">
              Preview
            </Button>
          ) : undefined
        }
      />
    </DesignSystemStoryFrame>
  );
}

function StatusSnippetPanelOverview() {
  const { locale } = useI18n();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">状态页片段面板</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          {zh
            ? '把 Status 页里用于展示配置片段和 diff 的代码面板拆成独立组件并纳入设计系统，统一检查复制按钮、额外操作、diff 着色和长行横向滚动。'
            : 'Admitted the Status code snippet panel for copy actions, extra header actions, diff coloring, and horizontal scrolling with long lines.'}
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">{zh ? '配置片段' : 'Config snippets'}</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <SnippetSample />
          <SnippetSample title="READ ONLY" copy={false} action />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">{zh ? 'Diff 与长行' : 'Diff and long lines'}</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <SnippetSample title="CONFIG DIFF" content={diffConfig} action />
          <SnippetSample title="LONG LINE" content={longConfig} />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <StatusSnippetPanelOverview />,
};

export const Plain: Story = {
  render: () => <SnippetSample />,
};

export const Diff: Story = {
  render: () => <SnippetSample title="CONFIG DIFF" content={diffConfig} action />,
};

export const LongLine: Story = {
  render: () => <SnippetSample title="LONG LINE" content={longConfig} />,
};
