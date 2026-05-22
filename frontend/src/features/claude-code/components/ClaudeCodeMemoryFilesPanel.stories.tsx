import type { Meta, StoryObj } from '@storybook/react';
import type { main } from '../../../../wailsjs/go/models';
import ClaudeCodeMemoryFilesPanel from './ClaudeCodeMemoryFilesPanel';
import {
  previewAllFilesSnapshot,
  previewPartialFilesSnapshot,
  previewMissingImportSnapshot,
  previewLocalNotGitignoredSnapshot,
  previewDeepImportSnapshot,
  previewEmptySnapshot,
  previewEditContent,
} from '../claude-md/previewData';

const meta: Meta<typeof ClaudeCodeMemoryFilesPanel> = {
  title: 'Design System/Business Components/Claude Code Memory Files Panel',
  component: ClaudeCodeMemoryFilesPanel,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaudeCodeMemoryFilesPanel>;

export const AllFilesPresent: Story = {
  args: {
    snapshot: previewAllFilesSnapshot,
    state: 'all-files-present',
  },
};

export const PartialFiles: Story = {
  args: {
    snapshot: previewPartialFilesSnapshot,
    state: 'partial-files',
  },
};

export const ImportExists: Story = {
  args: {
    snapshot: previewAllFilesSnapshot,
    state: 'import-exists',
  },
};

export const ImportMissing: Story = {
  args: {
    snapshot: previewMissingImportSnapshot,
    state: 'import-missing',
    stateMessage: 'Some @imports could not be resolved',
  },
};

export const ImportRecursion: Story = {
  args: {
    snapshot: previewDeepImportSnapshot,
    state: 'import-recursion',
    stateMessage: 'Import depth exceeds max (5 levels)',
  },
};

export const ImportDepthLimit: Story = {
  args: {
    snapshot: previewDeepImportSnapshot,
    state: 'import-depth-limit',
  },
};

export const LocalNotGitignored: Story = {
  args: {
    snapshot: previewLocalNotGitignoredSnapshot,
    state: 'local-not-gitignored',
  },
};

export const SavePreview: Story = {
  args: {
    snapshot: previewAllFilesSnapshot,
    state: 'save-preview',
    editingPath: '/Users/dev/project/CLAUDE.md',
    editContent: previewEditContent,
    savePreview: previewEditContent,
  },
};

export const Empty: Story = {
  args: {
    snapshot: previewEmptySnapshot,
    state: 'empty',
  },
};

export const ParseError: Story = {
  args: {
    snapshot: {
      projectPath: '/Users/dev/project',
      files: [
        { scope: 'project', path: '/Users/dev/project/CLAUDE.md', exists: true, size: 128, content: '# Broken markdown' },
      ],
      warnings: [],
    } as unknown as main.ClaudeCodeMemoryFilesSnapshot,
    state: 'parse-error',
  },
};
