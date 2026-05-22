import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
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
  title: 'Design System/业务组件/Claude Code Memory Files Panel',
  component: ClaudeCodeMemoryFilesPanel,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaudeCodeMemoryFilesPanel>;
type PanelProps = ComponentProps<typeof ClaudeCodeMemoryFilesPanel>;

function MemoryFilesSample({ label, props }: { label: string; props: PanelProps }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <ClaudeCodeMemoryFilesPanel {...props} />
    </DesignSystemStoryFrame>
  );
}

function ClaudeCodeMemoryFilesPanelOverview() {
  return (
    <div className="space-y-6">
      <MemoryFilesSample label="DS-CLAUDE-MEMORY-ALL" props={{ snapshot: previewAllFilesSnapshot, state: 'all-files-present' }} />
      <MemoryFilesSample label="DS-CLAUDE-MEMORY-PARTIAL" props={{ snapshot: previewPartialFilesSnapshot, state: 'partial-files' }} />
      <MemoryFilesSample label="DS-CLAUDE-MEMORY-IMPORT-MISSING" props={{ snapshot: previewMissingImportSnapshot, state: 'import-missing', stateMessage: 'Some @imports could not be resolved' }} />
      <MemoryFilesSample label="DS-CLAUDE-MEMORY-LOCAL-WARN" props={{ snapshot: previewLocalNotGitignoredSnapshot, state: 'local-not-gitignored' }} />
      <MemoryFilesSample label="DS-CLAUDE-MEMORY-SAVE" props={{ snapshot: previewAllFilesSnapshot, state: 'save-preview', editingPath: '/Users/dev/project/CLAUDE.md', editContent: previewEditContent, savePreview: previewEditContent }} />
      <MemoryFilesSample label="DS-CLAUDE-MEMORY-EMPTY" props={{ snapshot: previewEmptySnapshot, state: 'empty' }} />
    </div>
  );
}

export const Overview: Story = {
  render: () => <ClaudeCodeMemoryFilesPanelOverview />,
};

export const AllFilesPresent: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-ALL" props={{ snapshot: previewAllFilesSnapshot, state: 'all-files-present' }} />,
};

export const PartialFiles: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-PARTIAL" props={{ snapshot: previewPartialFilesSnapshot, state: 'partial-files' }} />,
};

export const ImportExists: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-IMPORT-EXISTS" props={{ snapshot: previewAllFilesSnapshot, state: 'import-exists' }} />,
};

export const ImportMissing: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-IMPORT-MISSING" props={{ snapshot: previewMissingImportSnapshot, state: 'import-missing', stateMessage: 'Some @imports could not be resolved' }} />,
};

export const ImportRecursion: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-IMPORT-RECURSION" props={{ snapshot: previewDeepImportSnapshot, state: 'import-recursion', stateMessage: 'Import depth exceeds max (5 levels)' }} />,
};

export const ImportDepthLimit: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-IMPORT-DEPTH" props={{ snapshot: previewDeepImportSnapshot, state: 'import-depth-limit' }} />,
};

export const LocalNotGitignored: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-LOCAL-WARN" props={{ snapshot: previewLocalNotGitignoredSnapshot, state: 'local-not-gitignored' }} />,
};

export const SavePreview: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-SAVE" props={{ snapshot: previewAllFilesSnapshot, state: 'save-preview', editingPath: '/Users/dev/project/CLAUDE.md', editContent: previewEditContent, savePreview: previewEditContent }} />,
};

export const Empty: Story = {
  render: () => <MemoryFilesSample label="DS-CLAUDE-MEMORY-EMPTY" props={{ snapshot: previewEmptySnapshot, state: 'empty' }} />,
};

export const ParseError: Story = {
  render: () => (
    <MemoryFilesSample
      label="DS-CLAUDE-MEMORY-PARSE"
      props={{
        snapshot: {
          projectPath: '/Users/dev/project',
          files: [
            { scope: 'project', path: '/Users/dev/project/CLAUDE.md', exists: true, size: 128, content: '# Broken markdown' },
          ],
          warnings: [],
        } as any,
        state: 'parse-error',
      }}
    />
  ),
};
