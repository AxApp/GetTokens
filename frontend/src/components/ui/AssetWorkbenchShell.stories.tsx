import type { Meta, StoryObj } from '@storybook/react-vite';
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
    <div className="grid gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">AssetWorkbenchShell</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold text-[var(--text-muted)]">
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
                <button type="button" className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]">
                  Refresh
                </button>
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
              <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide">
                Preview data loaded
              </div>
            }
            aside={
              <div className="bg-[var(--bg-surface)] p-3">
                <div className="text-sm font-black uppercase italic tracking-normal">Preview Rail</div>
                <p className="mt-2 text-xs font-bold leading-5 text-[var(--text-muted)]">
                  Diff、详情和计划项放在同一个固定宽度侧栏。
                </p>
              </div>
            }
          >
            <div className="divide-y-2 divide-[var(--border-color)]">
              {['skill-installer', 'github-mcp', 'project-command'].map((item) => (
                <div key={item} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg)] font-black">{item}</div>
                  <span className="border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
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
