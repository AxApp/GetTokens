import { main } from '../../../../wailsjs/go/models';

const { ClaudeCodeSubagentRecord, ClaudeCodeSubagentsSnapshot } = main;

export const previewValidSubagent = ClaudeCodeSubagentRecord.createFrom({
  name: 'code-reviewer',
  description: 'Reviews code changes with project context and restricted tools',
  path: '~/.claude/agents/code-reviewer.md',
  scope: 'user',
  frontmatterValid: true,
  knownFields: {
    tools: ['Read', 'Grep', 'Bash', 'Write'],
    model: 'claude-sonnet-4-6',
    permissionMode: 'default',
    maxTurns: 25,
  },
  bodyPreview: '# Code Reviewer\n\nYou are a thorough code reviewer. Focus on correctness, security, and performance...',
});

export const previewValidProjectSubagent = ClaudeCodeSubagentRecord.createFrom({
  name: 'test-runner',
  description: 'Runs tests and reports failures with suggested fixes',
  path: '.claude/agents/test-runner.md',
  scope: 'project',
  frontmatterValid: true,
  knownFields: {
    tools: ['Bash(npm test:*:*)'],
    model: 'claude-haiku-4-5',
    maxTurns: 10,
  },
  bodyPreview: '# Test Runner\n\nYou run test suites and report results concisely...',
});

export const previewMissingNameSubagent = ClaudeCodeSubagentRecord.createFrom({
  name: '',
  description: 'Has a description but no name',
  path: '~/.claude/agents/broken.md',
  scope: 'user',
  frontmatterValid: false,
  validationErrors: ['name 为必填字段'],
  knownFields: { description: 'Has a description but no name' },
});

export const previewMissingDescSubagent = ClaudeCodeSubagentRecord.createFrom({
  name: 'incomplete',
  description: '',
  path: '.claude/agents/incomplete.md',
  scope: 'project',
  frontmatterValid: false,
  validationErrors: ['description 为必填字段'],
  knownFields: { tools: ['Read'], model: 'claude-haiku-4-5' },
});

export const previewPluginSubagent = ClaudeCodeSubagentRecord.createFrom({
  name: 'deploy-helper',
  description: 'Plugin-provided deploy helper subagent',
  path: '~/.claude/agents/plugins/deploy-helper.md',
  scope: 'user',
  frontmatterValid: true,
  isPlugin: true,
  ignoredFields: ['hooks', 'mcpServers', 'permissionMode'],
  knownFields: {
    tools: ['Bash'],
    hooks: [{ type: 'command', command: 'deploy.sh' }],
    permissionMode: 'accept-edits',
  },
  bodyPreview: '# Deploy Helper\n\nPlugin-managed...',
});

export const previewParseErrorSubagent = ClaudeCodeSubagentRecord.createFrom({
  name: '',
  description: '',
  path: '.claude/agents/corrupt.md',
  scope: 'project',
  frontmatterValid: false,
  frontmatterError: 'frontmatter YAML 解析失败: yaml: line 3: could not find expected ":"',
  validationErrors: ['name 为必填字段', 'description 为必填字段'],
});

export const previewFullSnapshot = ClaudeCodeSubagentsSnapshot.createFrom({
  userPath: '~/.claude/agents',
  projectPath: '/Users/dev/project',
  agents: [previewValidSubagent, previewValidProjectSubagent, previewMissingDescSubagent, previewPluginSubagent],
  warnings: [],
});

export const previewErrorSnapshot = ClaudeCodeSubagentsSnapshot.createFrom({
  userPath: '~/.claude/agents',
  projectPath: '/Users/dev/project',
  agents: [previewParseErrorSubagent, previewMissingNameSubagent, previewValidSubagent],
  warnings: ['1 agent has parse errors'],
});

export const previewEmptySnapshot = ClaudeCodeSubagentsSnapshot.createFrom({
  userPath: '~/.claude/agents',
  projectPath: '/Users/dev/project',
  agents: [],
  warnings: [],
});

export const previewNewAgentContent = `# New Subagent

## Role
You help with task planning and decomposition.

## Instructions
- Break down large tasks into manageable steps
- Estimate effort for each step
- Identify dependencies between steps
`;
