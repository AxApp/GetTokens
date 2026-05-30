import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  resolveAccountLocalCliMappings,
} from '../model/accountLocalCliMapping.ts';
import {
  resolveAccountImportPayloadPreview,
} from '../model/accountTransfer.ts';

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

test('OpenRouter template generates direct Codex and Claude Code drafts', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:openrouter',
      provider: 'openrouter',
      displayName: 'OpenRouter',
      credentialSource: 'api-key',
      apiKey: 'sk-or-current-account',
      baseUrl: 'https://openrouter.ai/api',
      supportedFormats: ['openai_chat', 'anthropic'],
      models: [{ name: '~openai/gpt-latest', alias: '' }],
    }),
    relayKeyItems: [],
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 2);
  const codex = actions.find((item) => item.target === 'codex');
  const claude = actions.find((item) => item.target === 'claude');

  assert.equal(codex.enabled, true);
  assert.equal(codex.sourceFormat, 'openai_chat');
  assert.equal(codex.sourceFormatBaseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(codex.draft.codex.apiKey, 'sk-or-current-account');
  assert.equal(codex.draft.codex.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(codex.draft.codex.model, '~openai/gpt-latest');

  assert.equal(claude.enabled, true);
  assert.equal(claude.sourceFormat, 'anthropic');
  assert.equal(claude.sourceFormatBaseUrl, 'https://openrouter.ai/api');
  assert.equal(claude.draft.claude.apiKey, 'sk-or-current-account');
  assert.equal(claude.draft.claude.baseUrl, 'https://openrouter.ai/api');
  assert.equal(claude.draft.claude.authField, 'ANTHROPIC_AUTH_TOKEN');
});

test('OpenAI API key account generates Codex API key draft', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'openai',
      credentialSource: 'api-key',
      apiKey: 'sk-current-openai-account',
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
  assert.equal(actions[0].draft.codex.apiKey, 'sk-current-openai-account');
  assert.equal(actions[0].draft.codex.baseUrl, 'https://api.openai.com/v1');
  assert.equal(actions[0].draft.codex.providerID, 'team-codex-relay');
  assert.equal(actions[0].draft.codex.model, 'GT');
  assert.equal(actions[0].draft.codex.reasoningEffort, 'xhigh');
});

test('Codex API key account apply does not require a relay key', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'openai',
      credentialSource: 'api-key',
      apiKey: 'sk-current-openai-account',
      baseUrl: 'https://api.openai.com/v1',
      supportedFormats: ['openai_responses'],
    }),
    relayKeyItems: [],
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'codex');
  assert.equal(actions[0].enabled, true);
  assert.equal(actions[0].draft.target, 'codex');
  assert.equal(actions[0].draft.codex.apiKey, 'sk-current-openai-account');
});

test('OpenAI auth-file account generates fixed OAuth auth draft', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'auth-file:codex-team.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      name: 'codex-team.json',
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
  assert.equal(actions[0].draft.codex.authStrategy, 'replace_auth_with_oauth');
  assert.equal(actions[0].draft.codex.authFileName, 'codex-team.json');
  assert.equal(actions[0].draft.codex.providerID, 'team-codex-relay');
  assert.equal(actions[0].draft.codex.baseUrl, 'https://chatgpt.com/backend-api/codex');
});

test('Codex OAuth auth-file draft can use builtin openai provider without preserve warning', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'auth-file:codex-team.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      name: 'codex-team.json',
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
  assert.equal(actions[0].draft.codex.authStrategy, 'replace_auth_with_oauth');
  assert.equal(actions[0].warnings.some((warning) => warning.severity === 'blocking'), false);
});

test('Codex OAuth auth-file draft uses explicit auth-file name', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'acct_codex_team',
      accountKind: 'auth-file',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex-team.json',
      name: 'codex-team.json',
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
  assert.equal(actions[0].draft.codex.authStrategy, 'replace_auth_with_oauth');
  assert.equal(actions[0].draft.codex.authFileName, 'codex-team.json');
});

test('Codex OAuth auth-file draft blocks when auth-file name cannot be resolved', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'codex-oauth:missing-name',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'Missing file name',
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
  assert.equal(actions[0].warnings.some((warning) =>
    warning.code === 'missing-oauth-auth-file' &&
    warning.severity === 'blocking'
  ), true);
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

test('AccountLocalCliApplyConfirm exposes editable Claude Code draft fields', async () => {
  const source = await readFile(new URL('../components/AccountLocalCliApplyConfirm.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /onDraftChange/);
  assert.match(source, /ClaudeSettingsField/);
  assert.match(source, /Claude Code 配置/);
  assert.match(source, /field="apiKey"/);
  assert.match(source, /field="baseUrl"/);
  assert.match(source, /field="model"/);
  assert.match(source, /field="defaultHaikuModel"/);
  assert.match(source, /field="defaultSonnetModel"/);
  assert.match(source, /field="defaultOpusModel"/);
  assert.match(source, /field="smallFastModel"/);
  assert.match(source, /field="maxOutputTokens"/);
  assert.match(source, /field="apiTimeoutMs"/);
  assert.match(featureSource, /onDraftChange=\{\(nextDraft\) =>/);
  assert.match(featureSource, /setLocalCliDraft\(nextDraft\)/);
});

test('deep link Codex apply adapter reuses AccountLocalCliApplyConfirm shell', async () => {
  const adapterSource = await readFile(new URL('../components/DeepLinkCodexApplyAdapter.tsx', import.meta.url), 'utf8');
  const confirmSource = await readFile(new URL('../components/AccountLocalCliApplyConfirm.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(adapterSource, /AccountLocalCliApplyConfirm/);
  assert.doesNotMatch(adapterSource, /ModalFrame/);
  assert.match(adapterSource, /deepLinkContext/);
  assert.match(confirmSource, /DeepLinkApplyContext/);
  assert.match(confirmSource, /providerScope/);
  assert.match(confirmSource, /providerRewriteMode/);
  assert.match(confirmSource, /onImportAccountOnly/);
  assert.match(confirmSource, /只导入账号/);
  assert.match(featureSource, /buildDeepLinkAccountImportItems/);
  assert.match(featureSource, /account\.accountType === 'auth-file'/);
  assert.match(featureSource, /account\.authFileJSON/);
});

test('account import preview redacts auth-file and api-key secrets', () => {
  const authPreview = resolveAccountImportPayloadPreview({
    type: 'auth-file',
    name: 'team-auth.json',
    content: JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        id_token: 'id-secret',
      },
      user: { email: 'team@example.com' },
    }),
  });

  assert.doesNotMatch(authPreview, /access-secret|refresh-secret|id-secret/);
  assert.match(authPreview, /\[REDACTED\]/);
  assert.match(authPreview, /team@example.com/);

  const apiKeyPreview = resolveAccountImportPayloadPreview({
    type: 'codex-api-key',
    label: 'Team Relay',
    apiKey: 'sk-secret',
    baseUrl: 'https://api.example.com/v1',
    prefix: '',
  });
  assert.doesNotMatch(apiKeyPreview, /sk-secret/);
  assert.match(apiKeyPreview, /\[REDACTED\]/);
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
