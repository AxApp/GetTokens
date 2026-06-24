import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import DesignSystemStoryFrame from '../../features/design-system/DesignSystemStoryFrame';
import SearchInput from './SearchInput';
import SegmentedControl from './SegmentedControl';
import AssetWorkbenchShell from './AssetWorkbenchShell';

const meta = {
  title: 'Design System/通用组件/资产工作台框架',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function AssetWorkbenchShellOverview() {
  return (
    <div className="grid gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">AssetWorkbenchShell</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          Codex Extensions 与 Claude Code 资产页共用同一个工作台框架，只替换 toolbar、列表内容和右侧预览。
        </p>
      </div>

      <DesignSystemStoryFrame>
        <div className="h-[34rem]">
          <AssetWorkbenchShell
            title="Extension Assets"
            subtitle="3 skills / 2 active MCP / diff preview"
            actions={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="small">
                  Refresh
                </Button>
              </div>
            }
            toolbar={
              <>
                <SegmentedControl
                  options={[
                    { id: 'skills', label: 'SKILLS' },
                    { id: 'mcp', label: 'MCP' },
                  ]}
                  value="skills"
                  onChange={() => undefined}
                />
                <SearchInput value="" onChange={() => undefined} placeholder="Search assets" />
              </>
            }
            notice={
              <div className="border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-panel)] px-4 py-2 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal">
                Preview data loaded
              </div>
            }
            aside={
              <div className="bg-[var(--gt-surface-panel)] p-3">
                <div className="text-sm font-semibold tracking-normal">Preview Rail</div>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--gt-ink-muted)]">
                  Diff、详情和计划项放在同一个固定宽度侧栏。
                </p>
              </div>
            }
          >
            <div className="divide-y-2 divide-[var(--gt-border-strong)]">
              {['skill-installer', 'github-mcp', 'project-command'].map((item) => (
                <div key={item} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 truncate font-mono text-[length:var(--gt-font-size-lg)] font-semibold">{item}</div>
                  <span className="rounded-md border border-[var(--gt-border-subtle)] px-2 py-1 font-mono text-[10px] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                    ready
                  </span>
                </div>
              ))}
            </div>
          </AssetWorkbenchShell>
        </div>
      </DesignSystemStoryFrame>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AssetWorkbenchShellOverview />,
};
