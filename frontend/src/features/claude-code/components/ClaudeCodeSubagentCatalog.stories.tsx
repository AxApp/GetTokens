import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import ClaudeCodeSubagentCatalog from './ClaudeCodeSubagentCatalog';
import {
  previewFullSnapshot,
  previewErrorSnapshot,
  previewEmptySnapshot,
  previewNewAgentContent,
} from '../subagents/previewData';

const meta: Meta<typeof ClaudeCodeSubagentCatalog> = {
  title: 'Design System/业务组件/Claude Code Subagent Catalog',
  component: ClaudeCodeSubagentCatalog,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaudeCodeSubagentCatalog>;
type CatalogProps = ComponentProps<typeof ClaudeCodeSubagentCatalog>;

function CatalogSample({ label, props }: { label: string; props: CatalogProps }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <ClaudeCodeSubagentCatalog {...props} />
    </DesignSystemStoryFrame>
  );
}

function ClaudeCodeSubagentCatalogOverview() {
  return (
    <div className="space-y-6">
      <CatalogSample label="DS-CLAUDE-SUBAGENT-VALID" props={{ snapshot: previewFullSnapshot, state: 'valid-agents' }} />
      <CatalogSample label="DS-CLAUDE-SUBAGENT-MISSING-NAME" props={{ snapshot: previewErrorSnapshot, state: 'missing-name', stateMessage: '1 agent missing required name field' }} />
      <CatalogSample
        label="DS-CLAUDE-SUBAGENT-MISSING-DESC"
        props={{
          snapshot: { ...previewFullSnapshot, agents: [previewFullSnapshot.agents[2]] } as any,
          state: 'missing-description',
        }}
      />
      <CatalogSample label="DS-CLAUDE-SUBAGENT-PLUGIN" props={{ snapshot: previewFullSnapshot, state: 'plugin-ignored-fields' }} />
      <CatalogSample label="DS-CLAUDE-SUBAGENT-PARSE-ERROR" props={{ snapshot: previewErrorSnapshot, state: 'parse-error', stateMessage: '1 agent has parse errors' }} />
      <CatalogSample label="DS-CLAUDE-SUBAGENT-EMPTY" props={{ snapshot: previewEmptySnapshot, state: 'empty' }} />
      <CatalogSample
        label="DS-CLAUDE-SUBAGENT-CREATING"
        props={{
          snapshot: previewFullSnapshot,
          state: 'creating-agent',
          creatingNew: true,
          draftName: 'planner',
          draftDescription: 'Helps with task planning and decomposition',
          draftBody: previewNewAgentContent,
        }}
      />
      <CatalogSample
        label="DS-CLAUDE-SUBAGENT-SAVING"
        props={{
          snapshot: previewFullSnapshot,
          state: 'saving-agent',
          editingPath: '~/.claude/agents/code-reviewer.md',
          draftName: 'code-reviewer-v2',
          draftDescription: 'Enhanced code reviewer with additional security checks',
          savePreview: '---\nname: code-reviewer-v2\ndescription: Enhanced code reviewer with additional security checks\n---\n\n# Code Reviewer v2\n\nYou are a thorough code reviewer...',
        }}
      />
    </div>
  );
}

export const Overview: Story = {
  render: () => <ClaudeCodeSubagentCatalogOverview />,
};

export const ValidAgents: Story = {
  render: () => <CatalogSample label="DS-CLAUDE-SUBAGENT-VALID" props={{ snapshot: previewFullSnapshot, state: 'valid-agents' }} />,
};

export const MissingName: Story = {
  render: () => <CatalogSample label="DS-CLAUDE-SUBAGENT-MISSING-NAME" props={{ snapshot: previewErrorSnapshot, state: 'missing-name', stateMessage: '1 agent missing required name field' }} />,
};

export const MissingDescription: Story = {
  render: () => <CatalogSample label="DS-CLAUDE-SUBAGENT-MISSING-DESC" props={{ snapshot: { ...previewFullSnapshot, agents: [previewFullSnapshot.agents[2]] } as any, state: 'missing-description' }} />,
};

export const PluginIgnoredFields: Story = {
  render: () => <CatalogSample label="DS-CLAUDE-SUBAGENT-PLUGIN" props={{ snapshot: previewFullSnapshot, state: 'plugin-ignored-fields' }} />,
};

export const ParseError: Story = {
  render: () => <CatalogSample label="DS-CLAUDE-SUBAGENT-PARSE-ERROR" props={{ snapshot: previewErrorSnapshot, state: 'parse-error', stateMessage: '1 agent has parse errors' }} />,
};

export const Empty: Story = {
  render: () => <CatalogSample label="DS-CLAUDE-SUBAGENT-EMPTY" props={{ snapshot: previewEmptySnapshot, state: 'empty' }} />,
};

export const CreatingAgent: Story = {
  render: () => (
    <CatalogSample
      label="DS-CLAUDE-SUBAGENT-CREATING"
      props={{
        snapshot: previewFullSnapshot,
        state: 'creating-agent',
        creatingNew: true,
        draftName: 'planner',
        draftDescription: 'Helps with task planning and decomposition',
        draftBody: previewNewAgentContent,
      }}
    />
  ),
};

export const SavingAgent: Story = {
  render: () => (
    <CatalogSample
      label="DS-CLAUDE-SUBAGENT-SAVING"
      props={{
        snapshot: previewFullSnapshot,
        state: 'saving-agent',
        editingPath: '~/.claude/agents/code-reviewer.md',
        draftName: 'code-reviewer-v2',
        draftDescription: 'Enhanced code reviewer with additional security checks',
        savePreview: '---\nname: code-reviewer-v2\ndescription: Enhanced code reviewer with additional security checks\n---\n\n# Code Reviewer v2\n\nYou are a thorough code reviewer...',
      }}
    />
  ),
};
