import type { Meta, StoryObj } from '@storybook/react';
import type { main } from '../../../../wailsjs/go/models';
import ClaudeCodeSubagentCatalog from './ClaudeCodeSubagentCatalog';
import {
  previewFullSnapshot,
  previewErrorSnapshot,
  previewEmptySnapshot,
  previewNewAgentContent,
} from '../subagents/previewData';

const meta: Meta<typeof ClaudeCodeSubagentCatalog> = {
  title: 'Design System/Business Components/Claude Code Subagent Catalog',
  component: ClaudeCodeSubagentCatalog,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaudeCodeSubagentCatalog>;

export const ValidAgents: Story = {
  args: {
    snapshot: previewFullSnapshot,
    state: 'valid-agents',
  },
};

export const MissingName: Story = {
  args: {
    snapshot: previewErrorSnapshot,
    state: 'missing-name',
    stateMessage: '1 agent missing required name field',
  },
};

export const MissingDescription: Story = {
  args: {
    snapshot: {
      ...previewFullSnapshot,
      agents: [previewFullSnapshot.agents[2]],
    } as unknown as main.ClaudeCodeSubagentsSnapshot,
    state: 'missing-description',
  },
};

export const PluginIgnoredFields: Story = {
  args: {
    snapshot: previewFullSnapshot,
    state: 'plugin-ignored-fields',
  },
};

export const ParseError: Story = {
  args: {
    snapshot: previewErrorSnapshot,
    state: 'parse-error',
    stateMessage: '1 agent has parse errors',
  },
};

export const Empty: Story = {
  args: {
    snapshot: previewEmptySnapshot,
    state: 'empty',
  },
};

export const CreatingAgent: Story = {
  args: {
    snapshot: previewFullSnapshot,
    state: 'creating-agent',
    creatingNew: true,
    draftName: 'planner',
    draftDescription: 'Helps with task planning and decomposition',
    draftBody: previewNewAgentContent,
  },
};

export const SavingAgent: Story = {
  args: {
    snapshot: previewFullSnapshot,
    state: 'saving-agent',
    editingPath: '~/.claude/agents/code-reviewer.md',
    draftName: 'code-reviewer-v2',
    draftDescription: 'Enhanced code reviewer with additional security checks',
    savePreview: '---\nname: code-reviewer-v2\ndescription: Enhanced code reviewer with additional security checks\n---\n\n# Code Reviewer v2\n\nYou are a thorough code reviewer...',
  },
};
