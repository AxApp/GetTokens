import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveAccountLocalCliMappings,
} from '../model/accountLocalCliMapping.ts';

const relayKeyItems = [{ value: 'sk-gettokens-test' }];
const relayEndpoint = { id: 'localhost', baseUrl: 'http://127.0.0.1:8317/v1' };
const customProviderState = {
  currentProviderID: 'team-codex-relay',
  currentProviderName: 'Team Codex Relay',
  currentProviderIsBuiltin: false,
  currentProviderExists: true,
  providers: [{ providerID: 'team-codex-relay', providerName: 'Team Codex Relay' }],
};
const localCodexAuthState = {
  canPreserveChatGPTAuth: true,
  hasAuthFile: true,
  hasTokens: true,
};

test('unknown templates do not generate local cli actions', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'unknown-vendor',
      baseUrl: 'https://example.invalid/v1',
      supportedFormats: ['openai_chat'],
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  assert.deepEqual(actions, []);
});

test('DeepSeek official template only generates Claude Code action', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:deepseek',
      provider: 'deepseek',
      displayName: 'DeepSeek Relay',
      baseUrl: 'https://api.deepseek.com/v1',
      supportedFormats: ['openai_chat', 'anthropic'],
      formatBaseUrls: {
        anthropic: 'https://api.deepseek.com/anthropic',
      },
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'claude');
  assert.equal(actions[0].templateID, 'deepseek');
  assert.equal(actions[0].draft.target, 'claude');
});

test('OpenAI API key account generates Codex API key draft', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'openai',
      credentialSource: 'api-key',
      baseUrl: 'https://api.openai.com/v1',
      supportedFormats: ['openai_responses'],
      models: [{ name: 'gpt-5.5', alias: 'GT' }],
    }),
    relayKeyItems,
    relayEndpoint,
    selectedReasoningEffort: 'xhigh',
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'codex');
  assert.equal(actions[0].draft.target, 'codex');
  assert.equal(actions[0].draft.codex.authStrategy, 'replace_auth_with_apikey');
  assert.equal(actions[0].draft.codex.providerID, 'team-codex-relay');
  assert.equal(actions[0].draft.codex.model, 'GT');
  assert.equal(actions[0].draft.codex.reasoningEffort, 'xhigh');
});

test('OpenAI auth-file account generates fixed preserve ChatGPT auth draft', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'auth-file:codex-team.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex-team.json',
      status: 'ACTIVE',
      supportedFormats: ['openai_responses'],
    }),
    relayKeyItems,
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].draft.target, 'codex');
  assert.equal(actions[0].draft.codex.authStrategy, 'preserve_chatgpt_auth');
  assert.equal(actions[0].draft.codex.providerID, 'team-codex-relay');
});

test('Codex preserve draft with builtin openai provider returns blocking warning', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'auth-file:codex-team.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex-team.json',
      status: 'ACTIVE',
      supportedFormats: ['openai_responses'],
    }),
    relayKeyItems,
    relayEndpoint,
    currentCodexProviderState: {
      currentProviderID: 'openai',
      currentProviderName: 'OpenAI',
      currentProviderIsBuiltin: true,
      currentProviderExists: true,
      providers: [],
    },
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].enabled, true);
  assert.equal(actions[0].draft.target, 'codex');
  assert.equal(actions[0].draft.codex.providerID, 'openai');
  assert.ok(actions[0].warnings.some((warning) =>
    warning.code === 'preserve-chatgpt-auth-requires-custom-provider' &&
    warning.severity === 'blocking'
  ));
});

test('Claude draft uses relay endpoint instead of upstream anthropic format URL', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:deepseek',
      provider: 'deepseek',
      displayName: 'DeepSeek Relay',
      baseUrl: 'https://api.deepseek.com/v1',
      supportedFormats: ['openai_chat', 'anthropic'],
      formatBaseUrls: {
        anthropic: 'https://api.deepseek.com/anthropic',
      },
      models: [{ name: 'deepseek-chat', alias: 'deepseek-v4-pro' }],
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  assert.equal(actions[0].draft.target, 'claude');
  assert.equal(actions[0].sourceFormatBaseUrl, 'https://api.deepseek.com/anthropic');
  assert.equal(actions[0].draft.claude.baseUrl, 'http://127.0.0.1:8317/v1');
});

test('disabled account keeps verified action visible but not executable', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'deepseek',
      disabled: true,
      baseUrl: 'https://api.deepseek.com/v1',
      supportedFormats: ['openai_chat', 'anthropic'],
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'claude');
  assert.equal(actions[0].enabled, false);
  assert.equal(actions[0].status, 'disabled-account');
  assert.match(actions[0].disabledReason, /禁用/);
});

function account(overrides = {}) {
  return {
    id: 'codex-api-key:test',
    provider: 'openai',
    credentialSource: 'api-key',
    displayName: 'Test Account',
    status: 'configured',
    priority: 1,
    disabled: false,
    baseUrl: 'https://api.openai.com/v1',
    supportedFormats: ['openai_responses'],
    models: [],
    ...overrides,
  };
}
