import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildAccountLocalCliPreviewFiles,
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

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  if (!endMarker) {
    return source.slice(start);
  }
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('unknown accounts without compatible local CLI formats do not generate local cli actions', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'unknown-vendor',
      baseUrl: 'https://example.invalid/v1',
      supportedFormats: ['gemini_native'],
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  assert.deepEqual(actions, []);
});

test('custom compatible accounts generate Claude action from anthropic without Codex for openai_chat', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'unknown-vendor',
      displayName: 'Unknown Compatible Relay',
      credentialSource: 'api-key',
      apiKey: 'sk-custom-current-account',
      baseUrl: 'https://example.invalid/v1',
      supportedFormats: ['openai_chat', 'anthropic'],
      formatBaseUrls: {
        anthropic: 'https://example.invalid/anthropic',
      },
      models: [{ name: 'custom-model', alias: '' }],
    }),
    relayKeyItems,
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.deepEqual(actions.map((item) => item.target), ['claude']);
  assert.equal(actions[0].templateID, 'unknown-vendor');
  assert.equal(actions[0].sourceFormatBaseUrl, 'https://example.invalid/anthropic');
  assert.equal(actions[0].draft.claude.model, 'custom-model');
});

test('custom compatible accounts generate Codex and Claude actions from openai_responses and anthropic', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'unknown-vendor',
      displayName: 'Unknown Responses Relay',
      credentialSource: 'api-key',
      apiKey: 'sk-custom-current-account',
      baseUrl: 'https://example.invalid/v1',
      supportedFormats: ['openai_chat', 'openai_responses', 'anthropic'],
      formatBaseUrls: {
        openai_chat: 'https://example.invalid/v1',
        openai_responses: 'https://example.invalid/responses',
        anthropic: 'https://example.invalid/anthropic',
      },
      models: [{ name: 'custom-model', alias: '' }],
    }),
    relayKeyItems,
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.deepEqual(actions.map((item) => item.target).sort(), ['claude', 'codex']);
  assert.equal(actions.find((item) => item.target === 'codex').sourceFormat, 'openai_responses');
  assert.equal(actions.find((item) => item.target === 'codex').draft.codex.baseUrl, 'https://example.invalid/responses');
  assert.equal(actions.find((item) => item.target === 'claude').sourceFormat, 'anthropic');
});

test('DeepSeek official template only generates Claude Code action without openai_responses', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:deepseek',
      provider: 'deepseek',
      displayName: 'DeepSeek Relay',
      credentialSource: 'api-key',
      apiKey: 'sk-deepseek-current-account',
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
  assert.equal(actions[0].draft.claude.baseUrl, 'https://api.deepseek.com/anthropic');
  assert.equal(actions[0].draft.claude.authField, 'ANTHROPIC_AUTH_TOKEN');
});

test('Xiaomi MiMo Token Plan applies official Claude Code remote config directly', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:xiaomi-token-plan',
      provider: 'xiaomimimo-token-plan',
      displayName: 'Xiaomi MiMo Token Plan',
      credentialSource: 'api-key',
      apiKey: 'tp-xiaomi-current-account',
      baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
      supportedFormats: ['openai_chat', 'anthropic'],
      formatBaseUrls: {
        openai_chat: 'https://token-plan-cn.xiaomimimo.com/v1',
        anthropic: 'https://token-plan-cn.xiaomimimo.com/anthropic',
      },
      models: [{ name: 'mimo-v2.5-pro', alias: '' }],
    }),
    relayKeyItems: [],
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'claude');
  assert.equal(actions[0].enabled, true);
  assert.equal(actions[0].status, 'ready');
  assert.equal(actions[0].templateID, 'xiaomimimo-token-plan');
  assert.equal(actions[0].sourceFormat, 'anthropic');
  assert.equal(actions[0].sourceFormatBaseUrl, 'https://token-plan-cn.xiaomimimo.com/anthropic');
  assert.equal(actions[0].draft.claude.apiKey, 'tp-xiaomi-current-account');
  assert.equal(actions[0].draft.claude.baseUrl, 'https://token-plan-cn.xiaomimimo.com/anthropic');
  assert.equal(actions[0].draft.claude.authField, 'ANTHROPIC_AUTH_TOKEN');
  assert.equal(actions[0].draft.claude.model, 'mimo-v2.5-pro');
  assert.equal(actions[0].draft.claude.defaultHaikuModel, 'mimo-v2.5-pro');
  assert.equal(actions[0].draft.claude.defaultSonnetModel, 'mimo-v2.5-pro');
  assert.equal(actions[0].draft.claude.defaultOpusModel, 'mimo-v2.5-pro');
});

test('Zhipu Coding Plan applies official Claude Code remote config directly', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:zhipu',
      provider: 'zhipu',
      displayName: 'Zhipu GLM Coding Plan',
      credentialSource: 'api-key',
      apiKey: 'sk-zhipu-current-account',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      supportedFormats: ['openai_chat', 'anthropic'],
      formatBaseUrls: {
        openai_chat: 'https://open.bigmodel.cn/api/paas/v4',
        anthropic: 'https://open.bigmodel.cn/api/anthropic',
      },
    }),
    relayKeyItems: [],
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'claude');
  assert.equal(actions[0].enabled, true);
  assert.equal(actions[0].status, 'ready');
  assert.equal(actions[0].templateID, 'zhipu');
  assert.equal(actions[0].sourceFormat, 'anthropic');
  assert.equal(actions[0].sourceFormatBaseUrl, 'https://open.bigmodel.cn/api/anthropic');
  assert.equal(actions[0].draft.claude.apiKey, 'sk-zhipu-current-account');
  assert.equal(actions[0].draft.claude.baseUrl, 'https://open.bigmodel.cn/api/anthropic');
  assert.equal(actions[0].draft.claude.authField, 'ANTHROPIC_AUTH_TOKEN');
  assert.equal(actions[0].draft.claude.model, 'glm-5.2[1m]');
  assert.equal(actions[0].draft.claude.defaultHaikuModel, 'glm-4.5-air');
  assert.equal(actions[0].draft.claude.defaultSonnetModel, 'glm-5.2[1m]');
  assert.equal(actions[0].draft.claude.defaultOpusModel, 'glm-5.2[1m]');
  assert.equal(actions[0].draft.claude.apiTimeoutMs, '3000000');
});

for (const scenario of [
  {
    name: 'DeepSeek',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    anthropicBaseUrl: 'https://api.deepseek.com/anthropic',
    apiKey: 'sk-deepseek-current-account',
    model: 'deepseek-v4-pro[1m]',
    haiku: 'deepseek-v4-flash',
    sonnet: 'deepseek-v4-pro[1m]',
    opus: 'deepseek-v4-pro[1m]',
    apiTimeoutMs: '',
  },
  {
    name: 'Kimi Moonshot',
    provider: 'kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    anthropicBaseUrl: 'https://api.moonshot.cn/anthropic',
    apiKey: 'sk-kimi-current-account',
    model: 'kimi-k2.7-code',
    haiku: 'kimi-k2.7-code',
    sonnet: 'kimi-k2.7-code',
    opus: 'kimi-k2.7-code',
    apiTimeoutMs: '',
  },
  {
    name: 'MiniMax',
    provider: 'minimax',
    baseUrl: 'https://api.minimaxi.com/v1',
    anthropicBaseUrl: 'https://api.minimaxi.com/anthropic',
    apiKey: 'sk-minimax-current-account',
    model: 'MiniMax-M3',
    haiku: 'MiniMax-M3',
    sonnet: 'MiniMax-M3',
    opus: 'MiniMax-M3',
    apiTimeoutMs: '3000000',
  },
  {
    name: 'Doubao Ark',
    provider: 'doubao',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    anthropicBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
    apiKey: 'sk-doubao-current-account',
    model: 'ark-code-latest',
    haiku: 'ark-code-latest',
    sonnet: 'ark-code-latest',
    opus: 'ark-code-latest',
    apiTimeoutMs: '',
  },
  {
    name: 'StepFun',
    provider: 'stepfun',
    baseUrl: 'https://api.stepfun.com/v1',
    anthropicBaseUrl: 'https://api.stepfun.com/step_plan',
    apiKey: 'sk-stepfun-current-account',
    model: 'step-3.7-flash',
    haiku: 'step-3.7-flash',
    sonnet: 'step-3.7-flash',
    opus: 'step-3.7-flash',
    apiTimeoutMs: '',
  },
]) {
  test(`${scenario.name} applies official Claude Code remote config directly`, () => {
    const actions = resolveAccountLocalCliMappings({
      account: account({
        id: `openai-compatible:${scenario.provider}`,
        provider: scenario.provider,
        displayName: scenario.name,
        credentialSource: 'api-key',
        apiKey: scenario.apiKey,
        baseUrl: scenario.baseUrl,
        supportedFormats: ['openai_chat', 'anthropic'],
        formatBaseUrls: {
          openai_chat: scenario.baseUrl,
          anthropic: scenario.anthropicBaseUrl,
        },
      }),
      relayKeyItems: [],
      relayEndpoint,
      currentCodexProviderState: customProviderState,
      localCodexAuthState,
      sidecarReady: true,
    });

    assert.equal(actions.length, 1);
    assert.equal(actions[0].target, 'claude');
    assert.equal(actions[0].enabled, true);
    assert.equal(actions[0].status, 'ready');
    assert.equal(actions[0].templateID, scenario.provider);
    assert.equal(actions[0].sourceFormat, 'anthropic');
    assert.equal(actions[0].sourceFormatBaseUrl, scenario.anthropicBaseUrl);
    assert.equal(actions[0].draft.claude.apiKey, scenario.apiKey);
    assert.equal(actions[0].draft.claude.baseUrl, scenario.anthropicBaseUrl);
    assert.equal(actions[0].draft.claude.authField, 'ANTHROPIC_AUTH_TOKEN');
    assert.equal(actions[0].draft.claude.model, scenario.model);
    assert.equal(actions[0].draft.claude.defaultHaikuModel, scenario.haiku);
    assert.equal(actions[0].draft.claude.defaultSonnetModel, scenario.sonnet);
    assert.equal(actions[0].draft.claude.defaultOpusModel, scenario.opus);
    assert.equal(actions[0].draft.claude.apiTimeoutMs, scenario.apiTimeoutMs);
  });
}

test('OpenRouter template generates direct Claude Code draft without openai_responses', () => {
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

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'claude');
  assert.equal(actions[0].enabled, true);
  assert.equal(actions[0].sourceFormat, 'anthropic');
  assert.equal(actions[0].sourceFormatBaseUrl, 'https://openrouter.ai/api');
  assert.equal(actions[0].draft.claude.apiKey, 'sk-or-current-account');
  assert.equal(actions[0].draft.claude.baseUrl, 'https://openrouter.ai/api');
  assert.equal(actions[0].draft.claude.authField, 'ANTHROPIC_AUTH_TOKEN');
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
  assert.equal(actions[0].draft.codex.supportsWebsockets, false);
  assert.equal(actions[0].draft.codex.supportsWebsocketsSet, true);
  assert.equal(actions[0].draft.codex.modelCatalogProjectionMode, 'off');
});

test('Codex API key account can carry model catalog projection mode', () => {
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
    modelCatalogProjectionMode: 'gettokens',
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].draft.target, 'codex');
  assert.equal(actions[0].draft.codex.modelCatalogProjectionMode, 'gettokens');
});

test('Codex API draft uses configured openai_responses endpoint before primary base url', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'openai',
      credentialSource: 'api-key',
      apiKey: 'sk-current-openai-account',
      baseUrl: 'https://relay.example.com/v1',
      supportedFormats: ['openai_chat', 'openai_responses'],
      formatBaseUrls: {
        openai_chat: 'https://relay.example.com/openai/v1',
        openai_responses: 'https://relay.example.com/codex/v1',
      },
      models: [{ name: 'gpt-5.5', alias: 'GT' }],
    }),
    relayKeyItems,
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
  });

  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, 'codex');
  assert.equal(actions[0].sourceFormat, 'openai_responses');
  assert.equal(actions[0].sourceFormatBaseUrl, 'https://relay.example.com/codex/v1');
  assert.equal(actions[0].draft.target, 'codex');
  assert.equal(actions[0].draft.codex.baseUrl, 'https://relay.example.com/codex/v1');
});

test('relay presets map Codex to responses endpoint and Claude to anthropic endpoint', () => {
  for (const presetID of ['sub2api', 'new-api']) {
    const actions = resolveAccountLocalCliMappings({
      account: account({
        id: `openai-compatible:${presetID}`,
        provider: presetID,
        displayName: presetID,
        credentialSource: 'api-key',
        apiKey: 'sk-current-relay-account',
        baseUrl: presetID === 'sub2api' ? 'http://localhost:8080/v1' : 'http://localhost:3000/v1',
        supportedFormats: ['openai_chat', 'openai_responses', 'anthropic'],
        formatBaseUrls: presetID === 'sub2api'
          ? {
              openai_chat: 'http://localhost:8080/v1',
              openai_responses: 'http://localhost:8080/v1',
              anthropic: 'http://localhost:8080/antigravity',
            }
          : {
              openai_chat: 'http://localhost:3000/v1',
              openai_responses: 'http://localhost:3000/v1',
              anthropic: 'http://localhost:3000',
            },
      }),
      relayKeyItems,
      relayEndpoint,
      currentCodexProviderState: customProviderState,
      localCodexAuthState,
      sidecarReady: true,
    });

    assert.equal(actions.length, 2, presetID);
    const codex = actions.find((item) => item.target === 'codex');
    const claude = actions.find((item) => item.target === 'claude');
    assert.equal(codex.sourceFormat, 'openai_responses', presetID);
    assert.equal(codex.draft.codex.baseUrl, presetID === 'sub2api' ? 'http://localhost:8080/v1' : 'http://localhost:3000/v1');
    assert.equal(claude.sourceFormat, 'anthropic', presetID);
    assert.equal(claude.sourceFormatBaseUrl, presetID === 'sub2api' ? 'http://localhost:8080/antigravity' : 'http://localhost:3000');
  }
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

test('account local CLI preview files are built in the shared model layer for Codex', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'codex',
      credentialSource: 'api-key',
      apiKey: 'sk-current-account',
      baseUrl: 'https://api.openai.com/v1',
      supportedFormats: ['openai_responses'],
    }),
    relayKeyItems,
    relayEndpoint,
    currentCodexProviderState: customProviderState,
    localCodexAuthState,
    sidecarReady: true,
    modelCatalogProjectionMode: 'gettokens',
  });

  const codex = actions.find((item) => item.target === 'codex');
  const files = buildAccountLocalCliPreviewFiles(codex.draft, relayKeyItems);

  assert.deepEqual(files.map((file) => file.path), ['CODEX_HOME/auth.json', 'CODEX_HOME/config.toml']);
  assert.match(files[0].diff, /OPENAI_API_KEY/);
  assert.match(files[1].diff, /model_catalog_json = "gettokens-model-catalog\.json"/);
});

test('account local CLI preview files are built in the shared model layer for Claude Code', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      supportedFormats: ['anthropic'],
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  const claude = actions.find((item) => item.target === 'claude');
  const files = buildAccountLocalCliPreviewFiles(claude.draft, relayKeyItems);

  assert.deepEqual(files.map((file) => file.path), ['~/.claude/settings.json']);
  assert.match(files[0].diff, /ANTHROPIC_BASE_URL/);
});

test('Claude draft uses relay endpoint instead of upstream anthropic format URL for non-direct templates', () => {
  const actions = resolveAccountLocalCliMappings({
    account: account({
      id: 'openai-compatible:longcat',
      provider: 'longcat',
      displayName: 'Longcat Relay',
      baseUrl: 'https://api.longcat.chat/anthropic',
      supportedFormats: ['openai_chat', 'anthropic'],
      formatBaseUrls: {
        anthropic: 'https://api.longcat.chat/anthropic',
      },
      models: [{ name: 'LongCat-Flash-Chat', alias: '' }],
    }),
    relayKeyItems,
    relayEndpoint,
    sidecarReady: true,
  });

  const claude = actions.find((item) => item.target === 'claude');
  assert.equal(claude.draft.target, 'claude');
  assert.equal(claude.sourceFormatBaseUrl, 'https://api.longcat.chat/anthropic');
  assert.equal(claude.draft.claude.baseUrl, 'http://127.0.0.1:8317/v1');
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

  assert.deepEqual(actions.map((item) => item.target), ['claude']);
  for (const action of actions) {
    assert.equal(action.enabled, false);
    assert.equal(action.status, 'disabled-account');
    assert.match(action.disabledReason, /禁用/);
  }
});

test('AccountLocalCliApplyConfirm exposes editable Claude Code draft fields', async () => {
  const source = await readFile(new URL('../components/AccountLocalCliApplyConfirm.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /onDraftChange/);
  assert.match(source, /buildAccountLocalCliPreviewFiles/);
  assert.doesNotMatch(source, /function buildPreviewFiles/);
  assert.doesNotMatch(source, /buildClaudeCodeSettingsDiff|buildCodexLocalApplyDiff/);
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

test('AccountLocalCliApplyConfirm exposes editable Codex local apply settings', async () => {
  const source = await readFile(new URL('../components/AccountLocalCliApplyConfirm.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /Codex 配置/);
  assert.match(source, /buildAccountLocalCliPreviewFiles/);
  assert.doesNotMatch(source, /function buildPreviewFiles/);
  assert.doesNotMatch(source, /buildClaudeCodeSettingsDiff|buildCodexLocalApplyDiff/);
  assert.match(source, /handleCodexTextChange/);
  assert.match(source, /handleCodexBooleanChange/);
  assert.match(source, /handleCodexAuthStrategyChange/);
  assert.match(source, /handleCodexModelCatalogChange/);
  assert.match(source, /field="providerID"/);
  assert.match(source, /field="providerName"/);
  assert.match(source, /field="model"/);
  assert.match(source, /field="reasoningEffort"/);
  assert.match(source, /supports_websockets/);
  assert.match(source, /sync_model_catalog/);
  assert.match(source, /Wire API/);
  assert.match(featureSource, /modelCatalogProjectionMode:\s*draft\.codex\.modelCatalogProjectionMode/);
});

test('AccountLocalCliApplyConfirm uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/AccountLocalCliApplyConfirm.tsx', import.meta.url), 'utf8');

  assert.match(source, /const accountLocalCliPanelClass =/);
  assert.match(source, /const accountLocalCliButtonClass =/);
  assert.match(source, /const accountLocalCliInputClass =/);
  assert.match(source, /const accountLocalCliMetaClass =/);
  assert.match(source, /data-account-local-cli-apply-confirm/);
  assert.match(source, /data-account-local-cli-apply-rail/);
  assert.match(source, /data-account-local-cli-file-list/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-warning/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-r-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[0\.12em\]/);
  assert.doesNotMatch(source, /tracking-\[0\.18em\]/);
});

test('deep link account import confirm renders batch account preview and result summary', async () => {
  const confirmSource = await readFile(new URL('../components/DeepLinkAccountImportConfirm.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(confirmSource, /ModalFrame/);
  assert.match(confirmSource, /导入账号/);
  assert.match(confirmSource, /preview\.accounts/);
  assert.match(confirmSource, /account\.apiKeyPreview/);
  assert.match(confirmSource, /result\?\.accounts/);
  assert.match(confirmSource, /created/);
  assert.match(featureSource, /DeepLinkAccountImportConfirm/);
  assert.match(featureSource, /PreviewDeepLinkImport/);
  assert.match(featureSource, /ApplyDeepLinkImport/);
  assert.doesNotMatch(featureSource, /buildDeepLinkAccountImportItems/);
});

test('deep link account import confirm uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/DeepLinkAccountImportConfirm.tsx', import.meta.url), 'utf8');
  const targetSource = sourceBlock(source, 'export default function DeepLinkAccountImportConfirm', 'function SummaryTile');

  assert.match(source, /const deepLinkImportHeaderClass =/);
  assert.match(source, /const deepLinkImportButtonClass =/);
  assert.match(source, /const deepLinkImportPanelClass =/);
  assert.match(source, /const deepLinkImportSummaryTileClass =/);
  assert.match(source, /const deepLinkImportNoticeToneClass =/);
  assert.match(targetSource, /data-deep-link-import-confirm-header/);
  assert.match(targetSource, /data-deep-link-import-confirm-body/);
  assert.match(targetSource, /data-deep-link-import-confirm-summary/);
  assert.match(targetSource, /data-deep-link-import-confirm-url/);
  assert.match(targetSource, /data-deep-link-import-confirm-account-list/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /border-2|border-t-2|border-b-2/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /color-status-/);
  assert.doesNotMatch(targetSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /shadow-\[/);
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
