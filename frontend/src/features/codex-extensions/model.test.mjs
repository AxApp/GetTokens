import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildMcpChangePreview,
  isEditableMcpTransport,
  parseMcpArgs,
  parseMcpEnv,
  parseTkGitSkillSource,
  parseMcpTools,
  removeCodexSkillByID,
  serializeMcpArgs,
  serializeMcpEnv,
  serializeMcpTools,
  validateMcpEnvRows,
  validateMcpToolRows,
  stripSkillFrontmatter,
  updateCodexSkillEnabled,
} from './model.ts';

test('stripSkillFrontmatter removes yaml metadata from SKILL.md preview', () => {
  assert.equal(
    stripSkillFrontmatter(`---
name: demo
description: Demo skill.
---

# Demo

Body`),
    '# Demo\n\nBody',
  );
  assert.equal(stripSkillFrontmatter('# Plain\n\nBody'), '# Plain\n\nBody');
});

test('parseTkGitSkillSource accepts github and gitlab tk sources only', () => {
  assert.deepEqual(parseTkGitSkillSource('tk://github.com/acme/tools?ref=v1&path=skills/demo'), {
    provider: 'github',
    host: 'github.com',
    repo: 'acme/tools',
    ref: 'v1',
    path: 'skills/demo',
  });
  assert.deepEqual(parseTkGitSkillSource('tk://gitlab.com/platform/agents/skills?path=codex/demo'), {
    provider: 'gitlab',
    host: 'gitlab.com',
    repo: 'platform/agents/skills',
    ref: 'main',
    path: 'codex/demo',
  });
  assert.equal(parseTkGitSkillSource('https://github.com/acme/tools'), null);
  assert.equal(parseTkGitSkillSource('tk://example.com/acme/tools'), null);
});

test('parseTkGitSkillSource rejects unsafe source paths before install planning', () => {
  assert.equal(parseTkGitSkillSource('tk://github.com/acme/tools?path='), null);
  assert.equal(parseTkGitSkillSource('tk://github.com/acme/tools?path=../skills/demo'), null);
  assert.equal(parseTkGitSkillSource('tk://github.com/acme/tools?path=skills/../demo'), null);
  assert.equal(parseTkGitSkillSource('tk://github.com/acme/tools?path=/tmp/skill'), null);
  assert.equal(parseTkGitSkillSource('tk://github.com/acme/tools?path=C:%5Ctmp%5Cskill'), null);
});

test('isEditableMcpTransport marks backend diagnostic transports as read-only', () => {
  assert.equal(isEditableMcpTransport('stdio'), true);
  assert.equal(isEditableMcpTransport('streamable_http'), true);
  assert.equal(isEditableMcpTransport('conflict'), false);
  assert.equal(isEditableMcpTransport('unknown'), false);
});

test('updateCodexSkillEnabled patches one skill without rebuilding other rows', () => {
  const first = {
    id: '/skills/one/SKILL.md',
    name: 'one',
    description: '',
    enabled: true,
    rootLabel: 'user',
    rootPath: '/skills/one',
    sourceKind: 'user',
    origin: 'local',
    versionLabel: 'local',
    files: [],
    skillMarkdown: '# One',
  };
  const second = {
    id: '/skills/two/SKILL.md',
    name: 'two',
    description: '',
    enabled: false,
    rootLabel: 'user',
    rootPath: '/skills/two',
    sourceKind: 'user',
    origin: 'local',
    versionLabel: 'local',
    files: [],
    skillMarkdown: '# Two',
  };

  const updated = updateCodexSkillEnabled([first, second], second.id, true);

  assert.equal(updated[0], first);
  assert.notEqual(updated[1], second);
  assert.equal(updated[1].enabled, true);
});

test('removeCodexSkillByID removes only the selected skill', () => {
  const first = {
    id: '/skills/one/SKILL.md',
    name: 'one',
    description: '',
    enabled: true,
    rootLabel: 'user',
    rootPath: '/skills/one',
    sourceKind: 'user',
    origin: 'local',
    versionLabel: 'local',
    files: [],
    skillMarkdown: '# One',
  };
  const second = {
    ...first,
    id: '/skills/two/SKILL.md',
    name: 'two',
    rootPath: '/skills/two',
    skillMarkdown: '# Two',
  };

  assert.deepEqual(removeCodexSkillByID([first, second], first.id), [second]);
});

test('mcp args and env helpers preserve editable parameter values', () => {
  assert.deepEqual(parseMcpArgs('npx\n-y\n@modelcontextprotocol/server-filesystem\n~/Projects'), [
    'npx',
    '-y',
    '@modelcontextprotocol/server-filesystem',
    '~/Projects',
  ]);
  assert.deepEqual(parseMcpArgs('--path\n/Users/me/My Project\n--json\n{"root": "/My Project"}'), [
    '--path',
    '/Users/me/My Project',
    '--json',
    '{"root": "/My Project"}',
  ]);
  assert.equal(serializeMcpArgs(['-y', '@playwright/mcp@latest']), '-y\n@playwright/mcp@latest');
  assert.deepEqual(parseMcpEnv('TOKEN=abc\nEMPTY='), [
    { key: 'TOKEN', value: 'abc' },
    { key: 'EMPTY', value: '' },
  ]);
  assert.equal(serializeMcpEnv([{ key: 'TOKEN', value: 'abc' }]), 'TOKEN=abc');
});

test('mcp tool approval helpers preserve structured tool approval rows', () => {
  assert.deepEqual(parseMcpTools('search=approve\ncreate issue=prompt\nempty_mode'), [
    { name: 'search', approvalMode: 'approve' },
    { name: 'create issue', approvalMode: 'prompt' },
    { name: 'empty_mode', approvalMode: '' },
  ]);
  assert.equal(
    serializeMcpTools([
      { name: 'search', approvalMode: 'approve' },
      { name: 'create issue', approvalMode: 'prompt' },
      { name: 'empty_mode', approvalMode: '' },
    ]),
    'search=approve\ncreate issue=prompt\nempty_mode',
  );
});

test('validateMcpToolRows rejects unsupported approval modes while allowing empty mode', () => {
  assert.deepEqual(
    validateMcpToolRows([
      { name: 'search', approvalMode: 'approve' },
      { name: 'ask', approvalMode: 'prompt' },
      { name: 'read', approvalMode: 'auto' },
      { name: 'section_only', approvalMode: '' },
      { name: 'bad', approvalMode: 'always' },
    ]),
    [{ name: 'bad', approvalMode: 'always', reason: 'invalid-approval-mode' }],
  );
});

test('validateMcpEnvRows rejects rows that TOML inline maps cannot preserve', () => {
  assert.deepEqual(
    validateMcpEnvRows([
      { key: 'X-Client', value: 'GetTokens' },
      { key: 'Authorization Header', value: 'token' },
      { key: 'MISSING_EQUALS_LINE', value: '', source: 'missing-separator' },
    ]),
    [
      { key: 'Authorization Header', reason: 'invalid-key' },
      { key: 'MISSING_EQUALS_LINE', reason: 'missing-separator' },
    ],
  );
});

test('buildMcpChangePreview reports only modified server fields', () => {
  const original = {
    id: 'linear',
    label: 'linear',
    enabled: true,
    transport: 'streamable_http',
    url: 'https://mcp.linear.app/mcp',
    bearerTokenEnvVar: 'LINEAR_API_KEY',
    environmentId: 'local',
    sourcePath: '~/.codex/config.toml',
    status: 'ready',
  };
  const draft = {
    ...original,
    enabled: false,
    bearerTokenEnvVar: 'LINEAR_TOKEN',
    environmentId: 'remote',
    startupTimeoutSec: '20',
    oauthClientId: 'eci-prd-pub-codex-123',
    tools: [{ name: 'search', approvalMode: 'approve' }],
  };

  assert.deepEqual(buildMcpChangePreview(original, draft), [
    { key: 'enabled', before: 'true', after: 'false' },
    { key: 'bearer_token_env_var', before: 'LINEAR_API_KEY', after: 'LINEAR_TOKEN' },
    { key: 'environment_id', before: 'local', after: 'remote' },
    { key: 'startup_timeout_sec', before: '-', after: '20' },
    { key: 'oauth.client_id', before: '-', after: 'eci-prd-pub-codex-123' },
    { key: 'tools', before: '-', after: 'search=approve' },
  ]);
});

test('mcp server editor exposes a run-before preflight surface without saving config', async () => {
  const featureSource = await readFile(new URL('./CodexExtensionsFeature.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('./McpModals.tsx', import.meta.url), 'utf8');
  const zhLocale = JSON.parse(await readFile(new URL('../../locales/zh.json', import.meta.url), 'utf8'));
  const enLocale = JSON.parse(await readFile(new URL('../../locales/en.json', import.meta.url), 'utf8'));

  assert.match(featureSource, /PreflightCodexMcpServer/);
  assert.match(featureSource, /runMcpPreflight/);
  assert.match(featureSource, /toBackendMcpServer\(draft\)/);
  assert.match(modalSource, /onPreflight/);
  assert.match(modalSource, /data-codex-mcp-preflight-result="true"/);
  assert.match(modalSource, /mcp_preflight_result/);
  assert.equal(zhLocale.codex_extensions.mcp_preflight, '运行前诊断');
  assert.equal(enLocale.codex_extensions.mcp_preflight, 'Run Preflight');
});
