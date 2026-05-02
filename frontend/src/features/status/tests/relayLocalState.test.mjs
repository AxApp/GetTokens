import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  resolveUnifiedDiffLineTone,
  updateLocalCliTargetDraft,
} from '../model/relayLocalState.ts';

test('buildCodexLocalApplyDiff includes Codex auth and config controlled fields', () => {
  const diff = buildCodexLocalApplyDiff({
    apiKey: 'sk-gettokens-1234567890abcdef',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'gpt-5.4',
    reasoningEffort: 'high',
    providerID: 'gettokens',
    providerName: 'GetTokens',
  });

  assert.match(diff, /--- CODEX_HOME\/auth\.json/);
  assert.match(diff, /\+"OPENAI_API_KEY": "sk-getto\.\.\.cdef"/);
  assert.match(diff, /\+model = "gpt-5.4"/);
  assert.match(diff, /\+model_provider = "gettokens"/);
  assert.match(diff, /\+wire_api = "responses"/);
});

test('buildClaudeCodeSettingsDiff previews only Claude Code settings env fields', () => {
  const diff = buildClaudeCodeSettingsDiff({
    apiKey: 'sk-gettokens-1234567890abcdef',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'claude-sonnet-4-5',
  });

  assert.match(diff, /--- ~\/\.claude\/settings\.json/);
  assert.match(diff, /\+\s+"ANTHROPIC_API_KEY": "sk-getto\.\.\.cdef"/);
  assert.match(diff, /\+\s+"ANTHROPIC_BASE_URL": "http:\/\/127\.0\.0\.1:8317\/v1"/);
  assert.match(diff, /\+\s+"ANTHROPIC_MODEL": "claude-sonnet-4-5"/);
  assert.match(diff, /ANTHROPIC_AUTH_TOKEN/);
  assert.match(diff, /permissions \/ hooks \/ statusLine/);
});

test('updateLocalCliTargetDraft keeps Codex and Claude drafts isolated', () => {
  const initial = {
    codex: {
      relayKeyIndex: 0,
      endpointID: 'localhost',
      model: 'gpt-5.4',
      providerID: 'openai',
    },
    claude: {
      relayKeyIndex: 1,
      baseUrl: 'http://127.0.0.1:8317/v1',
      model: 'claude-sonnet-4-5',
      authField: 'ANTHROPIC_API_KEY',
    },
  };

  const afterCodexEdit = updateLocalCliTargetDraft(initial, 'codex', {
    model: 'gpt-5.5',
    providerID: 'gettokens',
  });
  const afterClaudeEdit = updateLocalCliTargetDraft(afterCodexEdit, 'claude', {
    baseUrl: 'http://localhost:8317/v1',
  });

  assert.equal(afterClaudeEdit.codex.model, 'gpt-5.5');
  assert.equal(afterClaudeEdit.codex.providerID, 'gettokens');
  assert.equal(afterClaudeEdit.claude.baseUrl, 'http://localhost:8317/v1');
  assert.equal(initial.codex.model, 'gpt-5.4');
  assert.equal(initial.claude.baseUrl, 'http://127.0.0.1:8317/v1');
});

test('resolveUnifiedDiffLineTone marks only real add and remove lines as red or green', () => {
  assert.equal(resolveUnifiedDiffLineTone('+++ CODEX_HOME/auth.json'), 'file');
  assert.equal(resolveUnifiedDiffLineTone('--- CODEX_HOME/auth.json'), 'file');
  assert.equal(resolveUnifiedDiffLineTone('@@ env @@'), 'hunk');
  assert.equal(resolveUnifiedDiffLineTone('+"ANTHROPIC_API_KEY": "KEY"'), 'add');
  assert.equal(resolveUnifiedDiffLineTone('-"ANTHROPIC_API_KEY": "OLD"'), 'remove');
  assert.equal(resolveUnifiedDiffLineTone('# preserved: permissions'), 'meta');
  assert.equal(resolveUnifiedDiffLineTone('  "env": {'), 'context');
});
