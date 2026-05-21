import type { ClaudeCodeAssetWorkbenchProps } from './components/ClaudeCodeAssetWorkbench';

export const claudeCodePreviewSkills: ClaudeCodeAssetWorkbenchProps['skills'] = [
  {
    id: 'user-reviewer',
    name: 'reviewer',
    description: 'Reviews repository changes with Claude Code project context and restricted tools.',
    scope: 'user',
    path: '~/.claude/skills/reviewer/SKILL.md',
    frontmatterStatus: 'valid',
    invocation: 'auto',
    modelInvocation: 'enabled',
    removable: true,
    fileCount: 3,
  },
  {
    id: 'project-release-check',
    name: 'release-check',
    description: 'Project-scoped release validation skill with filesystem and qmd conventions.',
    scope: 'project',
    path: '.claude/skills/release-check/SKILL.md',
    frontmatterStatus: 'valid',
    invocation: 'manual',
    modelInvocation: 'disabled',
    removable: false,
    fileCount: 5,
  },
  {
    id: 'legacy-deploy-command',
    name: '/deploy-preview',
    description: 'Legacy custom command kept visible as a compatibility asset.',
    scope: 'legacy-command',
    path: '.claude/commands/deploy-preview.md',
    frontmatterStatus: 'missing',
    invocation: 'legacy',
    modelInvocation: 'enabled',
    removable: false,
    fileCount: 1,
    risk: 'migration hint only; do not create new commands here',
  },
];

export const claudeCodePreviewSkillsWithError: ClaudeCodeAssetWorkbenchProps['skills'] = [
  ...claudeCodePreviewSkills,
  {
    id: 'broken-frontmatter',
    name: 'broken-frontmatter',
    description: 'Visible even when YAML frontmatter fails to parse.',
    scope: 'project',
    path: '.claude/skills/broken/SKILL.md',
    frontmatterStatus: 'invalid',
    invocation: 'manual',
    modelInvocation: 'enabled',
    removable: false,
    fileCount: 1,
    risk: 'frontmatter parse failed near allowed-tools',
  },
];

export const claudeCodePreviewMcpServers: ClaudeCodeAssetWorkbenchProps['mcpServers'] = [
  {
    id: 'context7',
    label: 'context7',
    transport: 'stdio',
    scope: 'user',
    sourcePath: '~/.claude.json',
    endpoint: 'npx -y @upstash/context7-mcp',
    active: true,
    secretState: 'none',
  },
  {
    id: 'sentry',
    label: 'sentry',
    transport: 'http',
    scope: 'project',
    sourcePath: '.mcp.json',
    endpoint: 'https://mcp.sentry.example.com/mcp',
    active: true,
    secretState: 'redacted',
    dirty: true,
  },
  {
    id: 'sentry',
    label: 'sentry',
    transport: 'sse',
    scope: 'user',
    sourcePath: '~/.claude.json',
    endpoint: 'https://mcp.sentry.example.com/sse',
    active: false,
    secretState: 'redacted',
    shadowedBy: 'project:sentry',
  },
];

export const claudeCodePreviewPlannedAssets: ClaudeCodeAssetWorkbenchProps['plannedAssets'] = [
  {
    id: 'settings-scope-stack',
    name: 'Settings scope stack',
    status: 'candidate',
    owner: 'P1 / settings',
    note: 'User, project, local and managed settings stay visible before specialized editors.',
  },
  {
    id: 'memory-files',
    name: 'CLAUDE.md memory files',
    status: 'candidate',
    owner: 'P1 / memory',
    note: 'Import validation comes before automatic writes or AGENTS sync.',
  },
  {
    id: 'runtime-doctor',
    name: 'Runtime doctor',
    status: 'deferred',
    owner: 'P2 / binary-runtime',
    note: 'Only PATH, version and env conflict checks. No installer management.',
  },
];

export const claudeCodePreviewDiff: ClaudeCodeAssetWorkbenchProps['diffPreview'] = {
  title: 'sentry project MCP',
  sourcePath: '.mcp.json',
  lines: [
    '  "mcpServers": {',
    '    "sentry": {',
    '-     "url": "https://mcp.sentry.example.com/sse",',
    '+     "type": "http",',
    '+     "url": "https://mcp.sentry.example.com/mcp",',
    '      "headers": { "Authorization": "[REDACTED]" }',
    '    }',
    '  }',
  ],
};
