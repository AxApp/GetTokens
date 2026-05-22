import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import ClaudeCodeSettingsScopeStack from './ClaudeCodeSettingsScopeStack';
import {
  previewAllLayersSnapshot,
  previewPartialLayersSnapshot,
  previewParseErrorSnapshot,
  previewEmptySnapshot,
  previewSavingDiffJson,
} from '../settings/previewData';

const meta: Meta<typeof ClaudeCodeSettingsScopeStack> = {
  title: 'Design System/业务组件/Claude Code Settings Scope Stack',
  component: ClaudeCodeSettingsScopeStack,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaudeCodeSettingsScopeStack>;
type StackProps = ComponentProps<typeof ClaudeCodeSettingsScopeStack>;

function SettingsScopeSample({ label, props }: { label: string; props: StackProps }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <ClaudeCodeSettingsScopeStack {...props} />
    </DesignSystemStoryFrame>
  );
}

function ClaudeCodeSettingsScopeStackOverview() {
  return (
    <div className="space-y-6">
      <SettingsScopeSample label="DS-CLAUDE-SETTINGS-ALL" props={{ snapshot: previewAllLayersSnapshot, state: 'all-layers-valid' }} />
      <SettingsScopeSample label="DS-CLAUDE-SETTINGS-PARTIAL" props={{ snapshot: previewPartialLayersSnapshot, state: 'partial-layers' }} />
      <SettingsScopeSample label="DS-CLAUDE-SETTINGS-PARSE" props={{ snapshot: previewParseErrorSnapshot, state: 'parse-error', stateMessage: 'Some layers have parse errors' }} />
      <SettingsScopeSample label="DS-CLAUDE-SETTINGS-EMPTY" props={{ snapshot: previewEmptySnapshot, state: 'all-layers-empty' }} />
      <SettingsScopeSample label="DS-CLAUDE-SETTINGS-SAVING" props={{ snapshot: previewAllLayersSnapshot, state: 'saving-diff', editingScope: 'user', savePreview: previewSavingDiffJson }} />
    </div>
  );
}

export const Overview: Story = {
  render: () => <ClaudeCodeSettingsScopeStackOverview />,
};

export const AllLayersValid: Story = {
  render: () => <SettingsScopeSample label="DS-CLAUDE-SETTINGS-ALL" props={{ snapshot: previewAllLayersSnapshot, state: 'all-layers-valid' }} />,
};

export const PartialLayers: Story = {
  render: () => <SettingsScopeSample label="DS-CLAUDE-SETTINGS-PARTIAL" props={{ snapshot: previewPartialLayersSnapshot, state: 'partial-layers' }} />,
};

export const ParseError: Story = {
  render: () => <SettingsScopeSample label="DS-CLAUDE-SETTINGS-PARSE" props={{ snapshot: previewParseErrorSnapshot, state: 'parse-error', stateMessage: 'Some layers have parse errors' }} />,
};

export const ManagedReadonly: Story = {
  render: () => <SettingsScopeSample label="DS-CLAUDE-SETTINGS-MANAGED" props={{ snapshot: previewAllLayersSnapshot, state: 'managed-readonly' }} />,
};

export const AllLayersEmpty: Story = {
  render: () => <SettingsScopeSample label="DS-CLAUDE-SETTINGS-EMPTY" props={{ snapshot: previewEmptySnapshot, state: 'all-layers-empty' }} />,
};

export const SavingDiff: Story = {
  render: () => <SettingsScopeSample label="DS-CLAUDE-SETTINGS-SAVING" props={{ snapshot: previewAllLayersSnapshot, state: 'saving-diff', editingScope: 'user', savePreview: previewSavingDiffJson }} />,
};
