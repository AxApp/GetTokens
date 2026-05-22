import type { Meta, StoryObj } from '@storybook/react';
import ClaudeCodeSettingsScopeStack from './ClaudeCodeSettingsScopeStack';
import {
  previewAllLayersSnapshot,
  previewPartialLayersSnapshot,
  previewParseErrorSnapshot,
  previewEmptySnapshot,
  previewSavingDiffJson,
} from '../settings/previewData';

const meta: Meta<typeof ClaudeCodeSettingsScopeStack> = {
  title: 'Design System/Business Components/Claude Code Settings Scope Stack',
  component: ClaudeCodeSettingsScopeStack,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaudeCodeSettingsScopeStack>;

export const AllLayersValid: Story = {
  args: {
    snapshot: previewAllLayersSnapshot,
    state: 'all-layers-valid',
  },
};

export const PartialLayers: Story = {
  args: {
    snapshot: previewPartialLayersSnapshot,
    state: 'partial-layers',
  },
};

export const ParseError: Story = {
  args: {
    snapshot: previewParseErrorSnapshot,
    state: 'parse-error',
    stateMessage: 'Some layers have parse errors',
  },
};

export const ManagedReadonly: Story = {
  args: {
    snapshot: previewAllLayersSnapshot,
    state: 'managed-readonly',
  },
};

export const AllLayersEmpty: Story = {
  args: {
    snapshot: previewEmptySnapshot,
    state: 'all-layers-empty',
  },
};

export const SavingDiff: Story = {
  args: {
    snapshot: previewAllLayersSnapshot,
    state: 'saving-diff',
    editingScope: 'user',
    savePreview: previewSavingDiffJson,
  },
};
