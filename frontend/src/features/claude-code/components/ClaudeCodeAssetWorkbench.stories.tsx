import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import {
  ClaudeCodeAssetWorkbench,
  type ClaudeCodeAssetWorkbenchProps,
} from './ClaudeCodeAssetWorkbench';
import {
  claudeCodePreviewDiff,
  claudeCodePreviewMcpServers,
  claudeCodePreviewPlannedAssets,
  claudeCodePreviewSkills,
  claudeCodePreviewSkillsWithError,
} from '../assetPreviewData';

const meta = {
  title: 'Design System/业务组件/Claude Code 资产工作台',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function sampleProps(overrides: Partial<ClaudeCodeAssetWorkbenchProps> = {}): ClaudeCodeAssetWorkbenchProps {
  return {
    state: 'skills-ready',
    workspace: 'skills',
    skills: claudeCodePreviewSkills,
    mcpServers: claudeCodePreviewMcpServers,
    plannedAssets: claudeCodePreviewPlannedAssets,
    diffPreview: claudeCodePreviewDiff,
    ...overrides,
  };
}

function WorkbenchSample({ label, props }: { label: string; props: ClaudeCodeAssetWorkbenchProps }) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <DesignSystemStoryFrame label={label}>
      <ClaudeCodeAssetWorkbench
        {...props}
        onSearchQueryChange={setSearchQuery}
        searchQuery={searchQuery}
      />
    </DesignSystemStoryFrame>
  );
}

function ClaudeCodeAssetWorkbenchOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">Claude Code Asset Workbench</h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          设计系统先固定 Skills / Commands、MCP scope、diff preview、candidate 和 deferred 状态；所有示例只使用 mock 数据。
        </p>
      </div>

      <div className="grid gap-5">
        <WorkbenchSample label="DS-CLAUDE-ASSET-SKILLS-READY" props={sampleProps()} />
        <WorkbenchSample
          label="DS-CLAUDE-ASSET-SKILLS-LEGACY-COMMAND"
          props={sampleProps({
            state: 'skills-legacy-command',
            workspace: 'skills',
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-ASSET-MCP-READY"
          props={sampleProps({
            state: 'mcp-ready',
            workspace: 'mcp-servers',
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-ASSET-MCP-SHADOWED-SCOPE"
          props={sampleProps({
            state: 'mcp-shadowed-scope',
            workspace: 'mcp-servers',
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-ASSET-PARSE-ERROR"
          props={sampleProps({
            state: 'parse-error',
            skills: claudeCodePreviewSkillsWithError,
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-ASSET-EMPTY"
          props={sampleProps({
            state: 'empty',
            skills: [],
            mcpServers: [],
            diffPreview: undefined,
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-ASSET-SAVING-DIFF"
          props={sampleProps({
            state: 'saving-diff',
            workspace: 'mcp-servers',
          })}
        />
      </div>
    </div>
  );
}

export const Overview: Story = {
  render: () => <ClaudeCodeAssetWorkbenchOverview />,
};

export const SkillsReady: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-SKILLS-READY" props={sampleProps()} />,
};

export const LegacyCommand: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-SKILLS-LEGACY-COMMAND" props={sampleProps({ state: 'skills-legacy-command' })} />,
};

export const McpReady: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-MCP-READY" props={sampleProps({ state: 'mcp-ready', workspace: 'mcp-servers' })} />,
};

export const McpShadowedScope: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-MCP-SHADOWED-SCOPE" props={sampleProps({ state: 'mcp-shadowed-scope', workspace: 'mcp-servers' })} />,
};

export const ParseError: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-PARSE-ERROR" props={sampleProps({ state: 'parse-error', skills: claudeCodePreviewSkillsWithError })} />,
};

export const Empty: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-EMPTY" props={sampleProps({ state: 'empty', skills: [], mcpServers: [], diffPreview: undefined })} />,
};

export const SavingDiff: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-ASSET-SAVING-DIFF" props={sampleProps({ state: 'saving-diff', workspace: 'mcp-servers' })} />,
};
