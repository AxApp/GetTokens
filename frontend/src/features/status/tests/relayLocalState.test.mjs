import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  getCodexLocalApplyPreflight,
  resolveCodexLocalApplyState,
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
    authStrategy: 'replace_auth_with_apikey',
  });

  assert.match(diff, /--- CODEX_HOME\/auth\.json/);
  assert.match(diff, /\+"OPENAI_API_KEY": "sk-getto\.\.\.cdef"/);
  assert.match(diff, /\+model = "gpt-5.4"/);
  assert.match(diff, / model_provider = "gettokens" # current user provider preserved/);
  assert.match(diff, /\+wire_api = "responses"/);
});

test('buildCodexLocalApplyDiff preserves ChatGPT auth and writes experimental bearer token in preserve mode', () => {
  const diff = buildCodexLocalApplyDiff({
    apiKey: 'sk-gettokens-1234567890abcdef',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'gpt-5.4',
    reasoningEffort: 'high',
    providerID: 'relay-bridge',
    providerName: 'Relay Bridge',
    supportsWebsockets: true,
    authStrategy: 'preserve_chatgpt_auth',
  });

  assert.match(diff, /CODEX_HOME\/auth\.json \(read-only preflight\)/);
  assert.match(diff, /auth_mode must be ChatGPT-compatible and tokens must exist/);
  assert.match(diff, /existing ChatGPT login tokens stay in place/);
  assert.match(diff, /auth_mode \/ OPENAI_API_KEY \/ tokens \/ account metadata are not rewritten/);
  assert.match(diff, /\+experimental_bearer_token = "sk-getto\.\.\.cdef"/);
  assert.match(diff, /-env_key = "OPENAI_API_KEY"/);
});

test('buildCodexLocalApplyDiff writes OAuth auth and ChatGPT Codex backend in OAuth mode', () => {
  const diff = buildCodexLocalApplyDiff({
    apiKey: '',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'gpt-5.4',
    reasoningEffort: 'high',
    providerID: 'team-codex-relay',
    providerName: 'Team Codex Relay',
    supportsWebsockets: true,
    authStrategy: 'replace_auth_with_oauth',
  });

  assert.match(diff, /\+"auth_mode": "chatgpt"/);
  assert.match(diff, /\+"tokens": "<selected OAuth account tokens>"/);
  assert.match(diff, /\+base_url = "https:\/\/chatgpt\.com\/backend-api\/codex"/);
  assert.match(diff, /-experimental_bearer_token = "<previous token>"/);
  assert.match(diff, /-env_key = "OPENAI_API_KEY"/);
});

test('buildCodexLocalApplyDiff removes openai_base_url in builtin OpenAI OAuth mode', () => {
  const diff = buildCodexLocalApplyDiff({
    apiKey: '',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'gpt-5.4',
    reasoningEffort: 'high',
    providerID: 'openai',
    providerName: 'OpenAI',
    supportsWebsockets: true,
    authStrategy: 'replace_auth_with_oauth',
  });

  assert.match(diff, /-openai_base_url = "<previous override if present>"/);
  assert.match(diff, /uses ChatGPT Codex backend when auth_mode=chatgpt/);
  assert.doesNotMatch(diff, /\+openai_base_url = "http:\/\/127\.0\.0\.1:8317\/v1"/);
});

test('buildClaudeCodeSettingsDiff previews only Claude Code settings env fields', () => {
  const diff = buildClaudeCodeSettingsDiff({
    apiKey: 'sk-gettokens-1234567890abcdef',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'claude-sonnet-4-5',
    defaultHaikuModel: 'claude-haiku-4-5',
    defaultSonnetModel: 'claude-sonnet-4-5',
    defaultOpusModel: 'claude-opus-4-5',
    smallFastModel: 'claude-haiku-4-5',
    maxOutputTokens: '6000',
    apiTimeoutMs: '600000',
    disableNonEssentialTraffic: true,
  });

  assert.match(diff, /--- ~\/\.claude\/settings\.json/);
  assert.match(diff, /\+\s+"ANTHROPIC_API_KEY": "sk-getto\.\.\.cdef"/);
  assert.match(diff, /\+\s+"ANTHROPIC_BASE_URL": "http:\/\/127\.0\.0\.1:8317\/v1"/);
  assert.match(diff, /\+\s+"ANTHROPIC_MODEL": "claude-sonnet-4-5"/);
  assert.match(diff, /\+\s+"ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5"/);
  assert.match(diff, /\+\s+"ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5"/);
  assert.match(diff, /\+\s+"ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5"/);
  assert.match(diff, /\+\s+"ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4-5"/);
  assert.match(diff, /\+\s+"CLAUDE_CODE_MAX_OUTPUT_TOKENS": "6000"/);
  assert.match(diff, /\+\s+"API_TIMEOUT_MS": "600000"/);
  assert.match(diff, /\+\s+"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"/);
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
      defaultHaikuModel: 'claude-haiku-4-5',
      defaultSonnetModel: 'claude-sonnet-4-5',
      defaultOpusModel: 'claude-opus-4-5',
      smallFastModel: 'claude-haiku-4-5',
      maxOutputTokens: '',
      apiTimeoutMs: '',
      disableNonEssentialTraffic: false,
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

test('getCodexLocalApplyPreflight blocks preserve mode without ChatGPT auth or with builtin openai provider', () => {
  assert.deepEqual(
    getCodexLocalApplyPreflight({
      authStrategy: 'preserve_chatgpt_auth',
      providerID: 'gettokens',
      authState: {
        canPreserveChatGPTAuth: false,
      },
    }),
    {
      canApply: false,
      reason: 'missing_chatgpt_auth',
    }
  );

  assert.deepEqual(
    getCodexLocalApplyPreflight({
      authStrategy: 'preserve_chatgpt_auth',
      providerID: 'openai',
      authState: {
        canPreserveChatGPTAuth: true,
      },
    }),
    {
      canApply: false,
      reason: 'requires_custom_provider',
    }
  );

  assert.deepEqual(
    getCodexLocalApplyPreflight({
      authStrategy: 'replace_auth_with_apikey',
      providerID: 'openai',
      authState: null,
    }),
    {
      canApply: true,
      reason: 'ok',
    }
  );
});

test('resolveCodexLocalApplyState returns actionable recovery for disabled Codex local apply states', () => {
  assert.deepEqual(
    resolveCodexLocalApplyState({
      isApplyingToLocal: false,
      isReady: true,
      selectedRelayKey: '   ',
      selectedProviderID: 'openai',
      providerOptions: [],
      preflight: { canApply: true, reason: 'ok' },
    }),
    {
      canApply: false,
      disabledReason: 'missing_relay_key',
      recoveryAction: 'create_relay_key',
    }
  );

  assert.deepEqual(
    resolveCodexLocalApplyState({
      isApplyingToLocal: false,
      isReady: true,
      selectedRelayKey: 'sk-relay',
      selectedProviderID: 'openai',
      providerOptions: [
        { id: 'openai', name: 'OpenAI' },
        { id: 'gettokens', name: 'GetTokens' },
      ],
      preflight: { canApply: false, reason: 'requires_custom_provider' },
    }),
    {
      canApply: false,
      disabledReason: 'requires_custom_provider',
      recoveryAction: 'switch_to_custom_provider',
      nextProviderID: 'gettokens',
    }
  );

  assert.deepEqual(
    resolveCodexLocalApplyState({
      isApplyingToLocal: false,
      isReady: true,
      selectedRelayKey: 'sk-relay',
      selectedProviderID: 'gettokens',
      providerOptions: [{ id: 'gettokens', name: 'GetTokens' }],
      preflight: { canApply: false, reason: 'missing_chatgpt_auth' },
    }),
    {
      canApply: false,
      disabledReason: 'missing_chatgpt_auth',
      recoveryAction: 'switch_auth_to_apikey',
    }
  );
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
