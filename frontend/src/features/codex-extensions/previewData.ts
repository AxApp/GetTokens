import type { CodexSkillRecord, McpServerRecord } from './model';

export const previewSkills: CodexSkillRecord[] = [
  {
    id: 'system-openai-docs',
    name: 'openai-docs',
    description: '查询 OpenAI 官方文档、模型能力和 API 迁移建议。',
    enabled: true,
    rootLabel: '$CODEX_HOME/skills/.system',
    rootPath: '~/.codex/skills/.system/openai-docs',
    sourceKind: 'system',
    origin: 'bundled',
    versionLabel: 'system',
    files: [
      {
        path: 'SKILL.md',
        kind: 'skill',
        previewable: true,
        content: `---
name: openai-docs
description: Use official OpenAI docs for product and API questions.
---

# OpenAI Docs

Use this skill when an answer depends on current OpenAI API behavior, model names, or migration guidance.

## Workflow

1. Prefer official documentation.
2. Cite the source.
3. Distinguish stable API facts from product recommendations.`,
      },
      { path: 'references/models.md', kind: 'other', previewable: true, content: '# Models\n\nUse official model docs before making recommendations.' },
    ],
    skillMarkdown: `---
name: openai-docs
description: Use official OpenAI docs for product and API questions.
---

# OpenAI Docs

Use this skill when an answer depends on current OpenAI API behavior, model names, or migration guidance.

## Workflow

1. Prefer official documentation.
2. Cite the source.
3. Distinguish stable API facts from product recommendations.`,
  },
  {
    id: 'user-design',
    name: 'design',
    description: '构建 UI 页面或组件时锁定视觉方向、组件层级和浏览器检查。',
    enabled: true,
    rootLabel: '$HOME/.agents/skills',
    rootPath: '~/.agents/skills/design',
    sourceKind: 'user',
    origin: 'local',
    versionLabel: 'local',
    files: [
      {
        path: 'SKILL.md',
        kind: 'skill',
        previewable: true,
        content: `---
name: design
description: Invoke when building any UI, component, page, or visual interface.
---

# Design

For app-shell surfaces, avoid decorative backgrounds and prioritize utility density.

## Checks

- Use existing project components first.
- Verify desktop and mobile browser rendering.
- Avoid nested cards when a flat list or section separator works better.`,
      },
      { path: 'references/design-reference.md', kind: 'other', previewable: true, content: '# Design Reference\n\nUse the project component system and keep workspace surfaces dense.' },
    ],
    skillMarkdown: `---
name: design
description: Invoke when building any UI, component, page, or visual interface.
---

# Design

For app-shell surfaces, avoid decorative backgrounds and prioritize utility density.

## Checks

- Use existing project components first.
- Verify desktop and mobile browser rendering.
- Avoid nested cards when a flat list or section separator works better.`,
  },
  {
    id: 'github-skill-installer',
    name: 'skill-installer',
    description: '从 curated 列表或 Git 源安装 Codex Skills，并支持手动更新。',
    enabled: false,
    rootLabel: '$CODEX_HOME/skills',
    rootPath: '~/.codex/skills/skill-installer',
    sourceKind: 'github',
    origin: 'tk://github.com/openai/codex?ref=main&path=skills/skill-installer',
    versionLabel: 'main@4f8a91c',
    files: [
      {
        path: 'SKILL.md',
        kind: 'skill',
        previewable: true,
        content: `---
name: skill-installer
description: Install Codex skills into CODEX_HOME/skills from a Git source.
---

# Skill Installer

Install a skill from an allowlisted Git source.

## Update

Updates are user-triggered. The UI should show the current ref and last fetched revision before replacing files.`,
      },
      { path: 'scripts/install_skill.py', kind: 'script', previewable: true, content: 'def install_skill(source: str) -> None:\n    print(f"install {source}")\n' },
    ],
    skillMarkdown: `---
name: skill-installer
description: Install Codex skills into CODEX_HOME/skills from a Git source.
---

# Skill Installer

Install a skill from an allowlisted Git source.

## Update

Updates are user-triggered. The UI should show the current ref and last fetched revision before replacing files.`,
  },
];

export const previewMcpServers: McpServerRecord[] = [
  {
    id: 'filesystem',
    label: 'filesystem',
    enabled: true,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '~/Projects'],
    env: [{ key: 'NODE_ENV', value: 'production' }],
    envVarsRaw: '["GITHUB_TOKEN", { name = "REMOTE_TOKEN", source = "remote" }]',
    cwd: '~/Projects',
    required: true,
    supportsParallelToolCalls: true,
    startupTimeoutSec: '10',
    toolTimeoutSec: '30',
    defaultToolsApprovalMode: 'prompt',
    enabledTools: ['read_file', 'list_directory'],
    disabledTools: ['write_file'],
    scopes: [],
    tools: [
      { name: 'read_file', approvalMode: 'auto' },
      { name: 'write_file', approvalMode: 'approve' },
    ],
    sourcePath: '~/.codex/config.toml',
    status: 'ready',
  },
  {
    id: 'linear',
    label: 'linear',
    enabled: true,
    transport: 'streamable_http',
    url: 'https://mcp.linear.app/mcp',
    bearerTokenEnvVar: 'LINEAR_API_KEY',
    httpHeaders: [{ key: 'X-Client', value: 'GetTokens' }],
    envHttpHeaders: [{ key: 'Authorization', value: 'LINEAR_AUTH_HEADER' }],
    scopes: ['read', 'write'],
    oauthResource: 'https://api.linear.app',
    sourcePath: '~/.codex/config.toml',
    status: 'missing-env',
  },
  {
    id: 'playwright',
    label: 'playwright',
    enabled: false,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    sourcePath: '~/.codex/config.toml',
    status: 'disabled',
  },
];

export const previewConfigToml = `model = "gpt-5.4"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "~/Projects"]
env = { NODE_ENV = "production" }
env_vars = ["GITHUB_TOKEN", { name = "REMOTE_TOKEN", source = "remote" }]
cwd = "~/Projects"
required = true
supports_parallel_tool_calls = true
startup_timeout_sec = 10
tool_timeout_sec = 30
default_tools_approval_mode = "prompt"
enabled_tools = ["read_file", "list_directory"]
disabled_tools = ["write_file"]

[mcp_servers.filesystem.tools.read_file]
approval_mode = "auto"

[mcp_servers.filesystem.tools.write_file]
approval_mode = "approve"

[mcp_servers.linear]
url = "https://mcp.linear.app/mcp"
bearer_token_env_var = "LINEAR_API_KEY"
http_headers = { X-Client = "GetTokens" }
env_http_headers = { Authorization = "LINEAR_AUTH_HEADER" }
scopes = ["read", "write"]
oauth_resource = "https://api.linear.app"

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]
enabled = false
`;
