import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMcpChangePreview,
  parseMcpArgs,
  parseMcpEnv,
  parseTkGitSkillSource,
  serializeMcpArgs,
  serializeMcpEnv,
  stripSkillFrontmatter,
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

test('mcp args and env helpers preserve editable parameter values', () => {
  assert.deepEqual(parseMcpArgs('npx -y @modelcontextprotocol/server-filesystem ~/Projects'), [
    'npx',
    '-y',
    '@modelcontextprotocol/server-filesystem',
    '~/Projects',
  ]);
  assert.equal(serializeMcpArgs(['-y', '@playwright/mcp@latest']), '-y @playwright/mcp@latest');
  assert.deepEqual(parseMcpEnv('TOKEN=abc\nEMPTY='), [
    { key: 'TOKEN', value: 'abc' },
    { key: 'EMPTY', value: '' },
  ]);
  assert.equal(serializeMcpEnv([{ key: 'TOKEN', value: 'abc' }]), 'TOKEN=abc');
});

test('buildMcpChangePreview reports only modified server fields', () => {
  const original = {
    id: 'linear',
    label: 'linear',
    enabled: true,
    transport: 'streamable_http',
    url: 'https://mcp.linear.app/mcp',
    bearerTokenEnvVar: 'LINEAR_API_KEY',
    sourcePath: '~/.codex/config.toml',
    status: 'ready',
  };
  const draft = {
    ...original,
    enabled: false,
    bearerTokenEnvVar: 'LINEAR_TOKEN',
  };

  assert.deepEqual(buildMcpChangePreview(original, draft), [
    { key: 'enabled', before: 'true', after: 'false' },
    { key: 'bearer_token_env_var', before: 'LINEAR_API_KEY', after: 'LINEAR_TOKEN' },
  ]);
});
