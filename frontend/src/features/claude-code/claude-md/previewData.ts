import type { main } from '../../../../wailsjs/go/models';

export const previewUserClaudeMd = {
  scope: 'user',
  path: '~/.claude/CLAUDE.md',
  exists: true,
  size: 1024,
  content: '# Claude Code User Memory\n\n## Preferences\n- Use concise responses\n- Prefer functional patterns\n\n@AGENTS.md\n@.claude/code-style.md',
  imports: [
    { raw: 'AGENTS.md', resolved: '/Users/dev/project/AGENTS.md', exists: true, depth: 1 },
    { raw: '.claude/code-style.md', resolved: '/Users/dev/project/.claude/code-style.md', exists: true, depth: 1 },
  ],
} as unknown as main.ClaudeCodeMemoryFileRecordDTO;

export const previewProjectClaudeMd = {
  scope: 'project',
  path: '/Users/dev/project/CLAUDE.md',
  exists: true,
  size: 2048,
  content: '# Project CLAUDE.md\n\n## Architecture\n- Wails v2 + React\n- Go backend\n\n@.claude/testing.md',
  imports: [
    { raw: '.claude/testing.md', resolved: '/Users/dev/project/.claude/testing.md', exists: true, depth: 1 },
  ],
} as unknown as main.ClaudeCodeMemoryFileRecordDTO;

export const previewLocalClaudeMd = {
  scope: 'local',
  path: '/Users/dev/project/CLAUDE.local.md',
  exists: true,
  gitIgnored: true,
  size: 512,
  content: '# Local-override CLI preferences\n- ANTHROPIC_BASE_URL=https://local-relay.example.com/v1',
  imports: [],
} as unknown as main.ClaudeCodeMemoryFileRecordDTO;

export const previewLocalNotGitignored = {
  scope: 'local',
  path: '/Users/dev/project/CLAUDE.local.md',
  exists: true,
  gitIgnored: false,
  size: 512,
  content: '# Local-override preferences',
  imports: [],
} as unknown as main.ClaudeCodeMemoryFileRecordDTO;

export const previewMissingImportFile = {
  scope: 'project',
  path: '/Users/dev/project/CLAUDE.md',
  exists: true,
  size: 512,
  content: '# Project\n\n@AGENTS.md\n@nonexistent/file.md',
  imports: [
    { raw: 'AGENTS.md', resolved: '/Users/dev/project/AGENTS.md', exists: true, depth: 1 },
    { raw: 'nonexistent/file.md', resolved: '/Users/dev/project/nonexistent/file.md', exists: false, depth: 1 },
  ],
} as unknown as main.ClaudeCodeMemoryFileRecordDTO;

export const previewDeepImportFile = {
  scope: 'user',
  path: '~/.claude/CLAUDE.md',
  exists: true,
  size: 256,
  content: '# Deep imports\n\n@a.md',
  imports: [
    { raw: 'a.md', resolved: '/path/a.md', exists: true, depth: 1 },
    { raw: 'b.md', resolved: '/path/b.md', exists: true, depth: 2 },
    { raw: 'c.md', resolved: '/path/c.md', exists: true, depth: 3 },
    { raw: 'd.md', resolved: '/path/d.md', exists: true, depth: 4 },
    { raw: 'e.md', resolved: '/path/e.md', exists: true, depth: 5 },
  ],
} as unknown as main.ClaudeCodeMemoryFileRecordDTO;

export const previewAllFilesSnapshot = {
  projectPath: '/Users/dev/project',
  files: [previewUserClaudeMd, previewProjectClaudeMd, previewLocalClaudeMd],
  warnings: [],
} as unknown as main.ClaudeCodeMemoryFilesSnapshotDTO;

export const previewPartialFilesSnapshot = {
  projectPath: '/Users/dev/project',
  files: [previewUserClaudeMd, { scope: 'project', path: '/Users/dev/project/CLAUDE.md', exists: false, size: 0 } as unknown as main.ClaudeCodeMemoryFileRecordDTO],
  warnings: [],
} as unknown as main.ClaudeCodeMemoryFilesSnapshotDTO;

export const previewMissingImportSnapshot = {
  projectPath: '/Users/dev/project',
  files: [previewMissingImportFile],
  warnings: ['@import "nonexistent/file.md" not found'],
} as unknown as main.ClaudeCodeMemoryFilesSnapshotDTO;

export const previewLocalNotGitignoredSnapshot = {
  projectPath: '/Users/dev/project',
  files: [previewLocalNotGitignored],
  warnings: ['CLAUDE.local.md is not in .gitignore — sensitive local config may be committed'],
} as unknown as main.ClaudeCodeMemoryFilesSnapshotDTO;

export const previewDeepImportSnapshot = {
  projectPath: '/Users/dev/project',
  files: [previewDeepImportFile],
  warnings: ['import depth exceeds max (5 levels)'],
} as unknown as main.ClaudeCodeMemoryFilesSnapshotDTO;

export const previewEmptySnapshot = {
  projectPath: '/Users/dev/project',
  files: [
    { scope: 'user', path: '~/.claude/CLAUDE.md', exists: false, size: 0 },
    { scope: 'project', path: '/Users/dev/project/CLAUDE.md', exists: false, size: 0 },
    { scope: 'local', path: '/Users/dev/project/CLAUDE.local.md', exists: false, size: 0 },
  ],
  warnings: [],
} as unknown as main.ClaudeCodeMemoryFilesSnapshotDTO;

export const previewEditContent = `# Project CLAUDE.md

## Architecture
- Wails v2 + React
- Go backend
- TDD with Go tests and Node tests

## Style
- Use functional components
- No default exports except pages
`;
