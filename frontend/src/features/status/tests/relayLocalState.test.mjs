import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  getCodexLocalApplyPreflight,
  loadRelayModelOptions,
  resolveInitialRelayModelSelection,
  resolveInitialRelayProviderSelection,
  resolveRelayEndpointSelection,
  resolveCodexLocalApplyState,
  resolveUnifiedDiffLineTone,
  saveRelayModelOptions,
  updateLocalCliTargetDraft,
} from '../model/relayLocalState.ts';

function installLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
    },
  };
  return {
    store,
    restore: () => {
      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }
    },
  };
}

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

test('resolveInitialRelayProviderSelection follows explicit Codex config provider before stored UI state', () => {
  assert.equal(
    resolveInitialRelayProviderSelection({
      providerOptions: [
        { id: 'openai', name: 'OpenAI' },
        { id: 'gettokens', name: 'GetTokens' },
        { id: 'corp', name: 'Corp Relay' },
      ],
      storedProviderID: 'openai',
      activeProviderID: 'corp',
      hasExplicitActiveProvider: true,
    }),
    'corp'
  );
});

test('resolveInitialRelayProviderSelection defaults to GetTokens when Codex config has no explicit provider', () => {
  assert.equal(
    resolveInitialRelayProviderSelection({
      providerOptions: [
        { id: 'openai', name: 'OpenAI' },
        { id: 'gettokens', name: 'GetTokens' },
      ],
      storedProviderID: 'openai',
      activeProviderID: 'openai',
      hasExplicitActiveProvider: false,
    }),
    'gettokens'
  );
});

test('resolveInitialRelayProviderSelection preserves explicit missing provider IDs from Codex config', () => {
  assert.equal(
    resolveInitialRelayProviderSelection({
      providerOptions: [
        { id: 'openai', name: 'OpenAI' },
        { id: 'gettokens', name: 'GetTokens' },
      ],
      activeProviderID: 'missing-relay',
      hasExplicitActiveProvider: true,
    }),
    'missing-relay'
  );
});

test('resolveInitialRelayModelSelection follows explicit Codex config model before stored UI state', () => {
  assert.equal(
    resolveInitialRelayModelSelection({
      modelOptions: ['gpt-5.4', 'gpt-5.5-codex'],
      storedModel: 'gpt-5.4',
      activeModel: 'gpt-5.5-codex',
      hasExplicitActiveModel: true,
    }),
    'gpt-5.5-codex'
  );
});

test('resolveInitialRelayModelSelection defaults to gpt-5.4 when Codex config has no explicit model', () => {
  assert.equal(
    resolveInitialRelayModelSelection({
      modelOptions: ['gpt-5.4'],
      storedModel: 'legacy-ui-model',
      activeModel: 'gpt-5.4',
      hasExplicitActiveModel: false,
    }),
    'gpt-5.4'
  );
});

test('resolveInitialRelayModelSelection preserves explicit missing model names from Codex config', () => {
  assert.equal(
    resolveInitialRelayModelSelection({
      modelOptions: ['gpt-5.4'],
      activeModel: 'team-model',
      hasExplicitActiveModel: true,
    }),
    'team-model'
  );
});

test('loadRelayModelOptions migrates legacy GT option to gpt-5.4', () => {
  const storage = installLocalStorageMock({
    'gettokens.status.relay-model-options': JSON.stringify(['GT', 'gpt-5.4', 'gpt-5.4']),
  });

  try {
    assert.deepEqual(loadRelayModelOptions(), ['gpt-5.4']);
    saveRelayModelOptions(['GT']);
    assert.deepEqual(JSON.parse(storage.store.get('gettokens.status.relay-model-options')), ['gpt-5.4']);
  } finally {
    storage.restore();
  }
});

test('resolveRelayEndpointSelection prefers LAN endpoint when LAN access is enabled', () => {
  const endpoints = [
    { id: 'localhost', kind: 'localhost', host: '127.0.0.1', baseUrl: 'http://127.0.0.1:8317/v1' },
    { id: 'hostname', kind: 'hostname', host: 'nolon-mac', baseUrl: 'http://nolon-mac:8317/v1' },
    { id: 'lan-1', kind: 'lan', host: '192.168.1.24', baseUrl: 'http://192.168.1.24:8317/v1' },
  ];

  assert.equal(resolveRelayEndpointSelection(endpoints, 'localhost', true), 'lan-1');
  assert.equal(resolveRelayEndpointSelection(endpoints, 'lan-1', false), 'localhost');
  assert.equal(resolveRelayEndpointSelection(endpoints, 'hostname', false), 'hostname');
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

test('buildCodexLocalApplyDiff writes explicit supports_websockets false when provided', () => {
  const diff = buildCodexLocalApplyDiff({
    apiKey: 'sk-gettokens-1234567890abcdef',
    baseUrl: 'http://127.0.0.1:8317/v1',
    model: 'gpt-5.4',
    reasoningEffort: 'high',
    providerID: 'relay-bridge',
    providerName: 'Relay Bridge',
    supportsWebsockets: false,
    supportsWebsocketsSet: true,
    authStrategy: 'replace_auth_with_apikey',
  });

  assert.match(diff, /\+supports_websockets = false/);
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

test('buildClaudeCodeSettingsDiff supports OpenRouter auth token mode', () => {
  const diff = buildClaudeCodeSettingsDiff({
    apiKey: 'sk-or-1234567890',
    baseUrl: 'https://openrouter.ai/api',
    model: 'anthropic/claude-sonnet-4.6',
    defaultHaikuModel: '',
    defaultSonnetModel: 'anthropic/claude-sonnet-4.6',
    defaultOpusModel: 'anthropic/claude-opus-4.7',
    smallFastModel: '',
    maxOutputTokens: '',
    apiTimeoutMs: '',
    disableNonEssentialTraffic: true,
    claudeCodeAttributionHeader: false,
    authField: 'ANTHROPIC_AUTH_TOKEN',
  });

  assert.match(diff, /\+\s+"ANTHROPIC_AUTH_TOKEN": "sk-or-12\.\.\.7890"/);
  assert.match(diff, /\+\s+"ANTHROPIC_API_KEY": ""/);
  assert.match(diff, /https:\/\/openrouter\.ai\/api/);
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

test('status Relay key picker wires a copy action to the selected key', async () => {
  const actionSelectSource = await readFile(new URL('../../../components/ui/ActionSelect.tsx', import.meta.url), 'utf8');
  assert.match(actionSelectSource, /onCopy\?: \(\) => void/);
  assert.match(actionSelectSource, /copyDisabled\?: boolean/);
  assert.match(actionSelectSource, /<Copy className=/);

  const statusPanelsSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');
  assert.match(statusPanelsSource, /selectedRelayKey=\{selectedRelayKey\}/);
  assert.match(statusPanelsSource, /selectedRelayKey=\{selectedClaudeRelayKey\}/);
  assert.match(statusPanelsSource, /onCopySelectedRelayKey/);
  assert.match(statusPanelsSource, /status\.service_key_copied/);
});

test('status local apply form pairs use equal-width field grids', async () => {
  const statusPanelsSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');

  assert.match(statusPanelsSource, /fieldPairGridClass = 'grid gap-3 md:grid-cols-2'/);
  assert.doesNotMatch(statusPanelsSource, /md:grid-cols-\[minmax\(0,1fr\)_12rem\]/);
  assert.doesNotMatch(statusPanelsSource, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_auto\]/);
});
