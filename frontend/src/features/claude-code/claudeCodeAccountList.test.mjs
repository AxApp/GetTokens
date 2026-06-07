import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CLAUDE_CODE_PROVIDER_DEFAULT_MODEL_PROFILES,
  applyClaudeCodeAccountPriorities,
  buildClaudeCodeAccountPriorityUpdates,
  buildClaudeCodeAccountRows,
  buildClaudeCodeAccountSummary,
  buildClaudeCodeModelMappings,
  buildClaudeCodeProfileMappingDraft,
  moveClaudeCodeAccountRowToEdge,
  normalizeClaudeCodeModelMappingsForProvider,
  reorderClaudeCodeAccountRows,
  resolveClaudeCodeProviderProfile,
} from './model/claudeCodeAccountList.ts';
import { getClaudeCodeAccountListPreviewRows } from './previewData.ts';

test('buildClaudeCodeAccountRows only admits accounts with anthropic supported format', () => {
  const rows = buildClaudeCodeAccountRows([
    {
      id: 'codex-api-key:deepseek',
      provider: 'deepseek',
      credentialSource: 'api-key',
      displayName: 'DeepSeek',
      status: 'configured',
      priority: 3,
      baseUrl: 'https://api.deepseek.com',
      formatBaseUrls: { anthropic: 'https://api.deepseek.com/anthropic' },
      supportedFormats: ['anthropic', 'openai_chat'],
    },
    {
      id: 'codex-api-key:gemini',
      provider: 'gemini',
      credentialSource: 'api-key',
      displayName: 'Gemini',
      status: 'configured',
      priority: 9,
      baseUrl: 'https://generativelanguage.googleapis.com',
      supportedFormats: ['gemini_native'],
    },
    {
      id: 'codex-api-key:claude-provider-without-format',
      provider: 'claude',
      credentialSource: 'api-key',
      displayName: 'Provider Name Is Not Enough',
      status: 'configured',
      priority: 99,
      baseUrl: 'https://example.com',
    },
  ]);

  assert.deepEqual(rows.map((row) => row.id), ['codex-api-key:deepseek']);
  assert.equal(rows[0].baseUrl, 'https://api.deepseek.com/anthropic');
});

test('claude account list detail and account-list modals are hash-routed', async () => {
  const source = await readFile(new URL('./ClaudeCodeAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /buildClaudeDetailFrameHash/);
  assert.match(source, /clearClaudeDetailFrameHash/);
  assert.match(source, /buildClaudeModalFrameHash/);
  assert.match(source, /clearClaudeModalFrameHash/);
  assert.match(source, /hashState\?\.page === 'claude' && hashState\.claudeWorkspace === 'account-list'/);
  assert.match(source, /hashState\?\.accountDetailID/);
  assert.match(source, /accountListModal === 'route-probe'/);
  assert.match(source, /accountListModal === 'project-config'/);
});

test('disabled and errored Claude Code accounts stay ordered but are not requestable', () => {
  const rows = buildClaudeCodeAccountRows([
    {
      id: 'codex-api-key:ready',
      provider: 'mimo',
      credentialSource: 'api-key',
      displayName: 'Ready',
      status: 'configured',
      priority: 3,
      baseUrl: 'https://platform.xiaomimimo.com/v1',
      supportedFormats: ['anthropic'],
    },
    {
      id: 'codex-api-key:disabled',
      provider: 'minimax',
      credentialSource: 'api-key',
      displayName: 'Disabled',
      status: 'configured',
      disabled: true,
      priority: 2,
      baseUrl: 'https://api.minimax.chat/v1',
      supportedFormats: ['anthropic'],
    },
    {
      id: 'codex-api-key:error',
      provider: 'bailian',
      credentialSource: 'api-key',
      displayName: 'Errored',
      status: 'error',
      statusMessage: 'quota exceeded',
      priority: 1,
      baseUrl: 'https://dashscope.aliyuncs.com',
      supportedFormats: ['anthropic'],
    },
  ]);

  assert.deepEqual(
    rows.map((row) => [row.id, row.requestable, row.blockReason]),
    [
      ['codex-api-key:ready', true, ''],
      ['codex-api-key:disabled', false, 'disabled'],
      ['codex-api-key:error', false, 'quota exceeded'],
    ],
  );
});

test('Claude Code model mappings display real upstream model to Claude Code alias only for explicit aliases', () => {
  assert.deepEqual(
    buildClaudeCodeModelMappings([
      { name: 'deepseek-v4-pro[1m]', alias: 'claude-sonnet-4-6' },
      { name: 'deepseek-v4-pro[1m]', alias: 'claude-sonnet-4-6' },
      { name: 'deepseek-v4-flash', alias: 'deepseek-v4-flash' },
      { name: 'qwen3.6-plus', alias: '' },
      { name: '', alias: 'claude-opus-4-5' },
    ]),
    [{ realModel: 'deepseek-v4-pro[1m]', codexModel: 'claude-sonnet-4-6' }],
  );
});

test('normalizeClaudeCodeModelMappingsForProvider keeps multiple Claude aliases for one real model', () => {
  assert.deepEqual(
    normalizeClaudeCodeModelMappingsForProvider([
      { realModel: ' mimo-v2.5-pro ', codexModel: ' claude-sonnet-4-6 ' },
      { realModel: 'mimo-v2.5-pro', codexModel: 'claude-opus-4-5' },
      { realModel: 'mimo-v2.5-pro', codexModel: 'claude-opus-4-5' },
      { realModel: 'mimo-v2.5-pro', codexModel: 'mimo-v2.5-pro' },
      { realModel: '', codexModel: 'blank' },
    ]),
    [
      { name: 'mimo-v2.5-pro', alias: 'claude-sonnet-4-6' },
      { name: 'mimo-v2.5-pro', alias: 'claude-opus-4-5' },
      { name: 'mimo-v2.5-pro', alias: '' },
    ],
  );
});

test('official provider profile is authoritative and generates editable mapping draft', () => {
  const deepseek = resolveClaudeCodeProviderProfile('deepseek');
  assert.ok(deepseek);
  assert.equal(deepseek.defaultModel, 'deepseek-v4-pro[1m]');
  assert.deepEqual(
    buildClaudeCodeProfileMappingDraft({
      profile: deepseek,
      sonnetAlias: 'claude-sonnet-4-6',
      opusAlias: 'claude-opus-4-5',
      haikuAlias: 'claude-haiku-4-5',
    }),
    [
      { realModel: 'deepseek-v4-pro[1m]', codexModel: 'claude-sonnet-4-6' },
      { realModel: 'deepseek-v4-pro[1m]', codexModel: 'claude-opus-4-5' },
      { realModel: 'deepseek-v4-flash', codexModel: 'claude-haiku-4-5' },
    ],
  );

  assert.equal(CLAUDE_CODE_PROVIDER_DEFAULT_MODEL_PROFILES.every((profile) => profile.source === 'official'), true);
});


test('Xiaomi MiMo official Claude Code profile includes current switchable chat models', () => {
  const mimo = resolveClaudeCodeProviderProfile('mimo');
  assert.ok(mimo);
  assert.ok(mimo.officialSwitchableModels.includes('mimo-v2-flash'));
  assert.ok(mimo.officialSwitchableModels.includes('mimo-v2-pro'));
  assert.ok(mimo.officialSwitchableModels.includes('mimo-v2-omni'));
});

test('Claude Code request order helpers preserve top-to-bottom runtime order', () => {
  const rows = [
    { id: 'a', priority: 3 },
    { id: 'b', priority: 2 },
    { id: 'c', priority: 1 },
  ];

  const reordered = reorderClaudeCodeAccountRows(rows, 'c', 'a');
  assert.deepEqual(reordered.map((row) => row.id), ['c', 'a', 'b']);
  assert.deepEqual(moveClaudeCodeAccountRowToEdge(rows, 'b', 'top').map((row) => row.id), ['b', 'a', 'c']);
  assert.deepEqual(moveClaudeCodeAccountRowToEdge(rows, 'b', 'bottom').map((row) => row.id), ['a', 'c', 'b']);
  assert.deepEqual(buildClaudeCodeAccountPriorityUpdates(reordered), [
    { id: 'c', priority: 3 },
    { id: 'a', priority: 2 },
    { id: 'b', priority: 1 },
  ]);
  assert.deepEqual(applyClaudeCodeAccountPriorities(reordered).map((row) => row.priority), [3, 2, 1]);
});

test('Claude Code preview rows are stable and exclude non-Anthropic accounts', () => {
  const rows = getClaudeCodeAccountListPreviewRows();
  const summary = buildClaudeCodeAccountSummary(rows);

  assert.deepEqual(rows.map((row) => row.id), [
    'codex-api-key:deepseek-claude',
    'codex-api-key:bailian-coding-plan',
    'codex-api-key:mimo-shared',
    'codex-api-key:minimax-disabled',
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.requestable, 3);
  assert.equal(summary.blocked, 1);
  assert.equal(rows.some((row) => row.provider === 'gemini'), false);
});
