import type { main } from '../../../../wailsjs/go/models';

export const previewUserLayer = {
  scope: 'user',
  path: '~/.claude/settings.json',
  exists: true,
  knownFields: {
    env: { ANTHROPIC_MODEL: 'claude-sonnet-4-6', ANTHROPIC_BASE_URL: 'https://api.example.com/v1', CLAUDE_CODE_ATTRIBUTION_HEADER: '0' },
    permissions: { allow: ['Read', 'Write', 'Bash'], deny: [], defaultMode: 'default' },
    disableAllHooks: false,
    outputStyle: 'default',
  },
} as unknown as main.ClaudeCodeSettingsLayer;

export const previewProjectLayer = {
  scope: 'project',
  path: '.claude/settings.json',
  exists: true,
  knownFields: {
    env: { ANTHROPIC_MODEL: 'claude-opus-4-7' },
    permissions: { allow: ['Bash(npm run build:*:*)'], deny: ['Bash(rm -rf:*)'] },
  },
} as unknown as main.ClaudeCodeSettingsLayer;

export const previewLocalLayer = {
  scope: 'local',
  path: '.claude/settings.local.json',
  exists: true,
  knownFields: {
    env: { ANTHROPIC_API_KEY: 'sk-ant-redacted' },
  },
} as unknown as main.ClaudeCodeSettingsLayer;

export const previewManagedLayer = {
  scope: 'managed',
  path: 'managed-policy',
  exists: true,
  knownFields: {
    permissions: { defaultMode: 'accept-edits' },
    disableAllHooks: true,
  },
} as unknown as main.ClaudeCodeSettingsLayer;

export const previewParseErrorLayer = {
  scope: 'project',
  path: '.claude/settings.json',
  exists: true,
  parseError: 'settings.json 不是有效 JSON: Unexpected token } in JSON at position 42',
} as unknown as main.ClaudeCodeSettingsLayer;

export const previewAllLayersSnapshot = {
  projectPath: '/Users/dev/my-project',
  layers: [previewManagedLayer, previewLocalLayer, previewProjectLayer, previewUserLayer],
  warnings: [],
} as unknown as main.ClaudeCodeSettingsSnapshot;

export const previewPartialLayersSnapshot = {
  projectPath: '/Users/dev/my-project',
  layers: [previewUserLayer],
  warnings: [],
} as unknown as main.ClaudeCodeSettingsSnapshot;

export const previewParseErrorSnapshot = {
  projectPath: '/Users/dev/my-project',
  layers: [previewParseErrorLayer, previewUserLayer],
  warnings: ['project settings parse error: settings.json 不是有效 JSON'],
} as unknown as main.ClaudeCodeSettingsSnapshot;

export const previewEmptySnapshot = {
  projectPath: '/Users/dev/my-project',
  layers: [
    { scope: 'user', path: '~/.claude/settings.json', exists: false },
    { scope: 'project', path: '.claude/settings.json', exists: false },
    { scope: 'local', path: '.claude/settings.local.json', exists: false },
  ],
  warnings: [],
} as unknown as main.ClaudeCodeSettingsSnapshot;

export const previewSavingDiffJson = JSON.stringify(
  {
    env: { ANTHROPIC_MODEL: 'claude-opus-4-7', ANTHROPIC_BASE_URL: 'https://api.example.com/v1' },
    outputStyle: 'compact',
  },
  null,
  2,
);
