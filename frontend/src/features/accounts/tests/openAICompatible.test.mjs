import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyOpenAICompatibleProviderPreset,
  buildProviderConfigSignature,
  buildHeadersText,
  buildModelRows,
  buildOpenAICompatibleProviderDraft,
  emptyOpenAICompatibleProviderForm,
  getOpenAICompatibleProviderPreset,
  maskProviderAPIKey,
  normalizeProviderModels,
  openAICompatibleProviderPresets,
  parseHeadersText,
  renameProviderVerifyState,
  resolveProviderDetailModelOptions,
  resolveOpenAICompatibleProviderPreset,
  resolveOpenAICompatibleProviderPresetID,
  shouldRefreshRemoteModels,
} from '../model/openAICompatible.ts';

test('maskProviderAPIKey keeps short keys and masks long keys', () => {
  assert.equal(maskProviderAPIKey(''), '—');
  assert.equal(maskProviderAPIKey('sk-1234'), 'sk-1234');
  assert.equal(maskProviderAPIKey('sk-1234567890'), 'sk-1...7890');
});

test('emptyOpenAICompatibleProviderForm starts with blank fields', () => {
  assert.deepEqual(emptyOpenAICompatibleProviderForm, {
    name: '',
    baseUrl: '',
    apiKey: '',
  });
});

test('openAICompatibleProviderPresets exposes cherry-studio vendor defaults adapted for this workspace', () => {
  assert.deepEqual(openAICompatibleProviderPresets.slice(0, 3), [
    {
      id: 'deepseek',
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKeyPlaceholder: 'sk-...',
      models: [
        { name: 'deepseek-chat', alias: 'Chat' },
        { name: 'deepseek-reasoner', alias: 'Reasoner' },
      ],
    },
    {
      id: 'siliconflow',
      label: 'SiliconFlow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKeyPlaceholder: 'sk-...',
      models: [
        { name: 'deepseek-ai/DeepSeek-V3.2', alias: 'DeepSeek V3.2' },
        { name: 'Qwen/Qwen3-8B', alias: 'Qwen3-8B' },
      ],
    },
    {
      id: 'zhipu',
      label: 'Zhipu',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKeyPlaceholder: 'sk-...',
      models: [
        { name: 'glm-5', alias: 'GLM-5' },
        { name: 'glm-4.7', alias: 'GLM-4.7' },
        { name: 'glm-4.5-flash', alias: 'GLM-4.5-Flash' },
      ],
    },
  ]);
});

test('applyOpenAICompatibleProviderPreset fills provider name and base url while keeping user secrets intact', () => {
  assert.deepEqual(
    applyOpenAICompatibleProviderPreset(
      {
        name: '',
        baseUrl: '',
        apiKey: 'sk-test',
      },
      'openrouter',
    ),
    {
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
    },
  );
});

test('getOpenAICompatibleProviderPreset returns null for unknown providers', () => {
  assert.equal(getOpenAICompatibleProviderPreset('unknown-provider'), null);
});

test('resolveOpenAICompatibleProviderPresetID matches provider by name or base url', () => {
  assert.equal(resolveOpenAICompatibleProviderPresetID({ name: 'DeepSeek' }), 'deepseek');
  assert.equal(resolveOpenAICompatibleProviderPresetID({ baseUrl: 'https://openrouter.ai/api/v1/' }), 'openrouter');
  assert.equal(resolveOpenAICompatibleProviderPresetID({ name: 'custom', baseUrl: 'https://relay.example.com/v1' }), '');
});

test('resolveOpenAICompatibleProviderPreset returns preset details for matching provider', () => {
  assert.deepEqual(resolveOpenAICompatibleProviderPreset({ name: 'deepseek' }), {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'deepseek-chat', alias: 'Chat' },
      { name: 'deepseek-reasoner', alias: 'Reasoner' },
    ],
  });
});

test('buildOpenAICompatibleProviderDraft keeps editable provider basics and verify model', () => {
  assert.deepEqual(
    buildOpenAICompatibleProviderDraft(
      {
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        models: [{ name: 'deepseek-chat', alias: 'chat' }],
      },
    ),
    {
      currentName: 'deepseek',
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      headersText: '',
      models: [{ name: 'deepseek-chat', alias: 'chat' }],
      verifyModel: 'deepseek-chat',
    },
  );
});

test('buildOpenAICompatibleProviderDraft prefers cached verify model when present', () => {
  assert.equal(
    buildOpenAICompatibleProviderDraft(
      {
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        models: [{ name: 'deepseek-chat', alias: 'chat' }],
      },
      {
        model: 'deepseek-reasoner',
        status: 'success',
        message: 'ok',
        lastVerifiedAt: 123,
      },
    ).verifyModel,
    'deepseek-reasoner',
  );
});

test('buildOpenAICompatibleProviderDraft falls back to preset default verify model when provider models are empty', () => {
  assert.equal(
    buildOpenAICompatibleProviderDraft({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      models: [],
    }).verifyModel,
    'deepseek/deepseek-chat',
  );
});

test('resolveProviderDetailModelOptions prefers fetched remote models over local and preset models', () => {
  assert.deepEqual(
    resolveProviderDetailModelOptions({
      draft: {
        currentName: 'deepseek',
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        headersText: '',
        models: [{ name: 'local-model', alias: 'Local' }],
        verifyModel: 'deepseek-chat',
      },
      remoteModelsState: {
        status: 'success',
        message: 'ok',
        models: [
          { name: 'deepseek-chat', alias: '' },
          { name: 'deepseek-reasoner', alias: '' },
        ],
        lastFetchedAt: 123,
      },
    }),
    {
      source: 'remote',
      models: [
        { name: 'deepseek-chat', alias: '' },
        { name: 'deepseek-reasoner', alias: '' },
      ],
    },
  );
});

test('resolveProviderDetailModelOptions falls back to preset models when local and remote models are empty', () => {
  assert.deepEqual(
    resolveProviderDetailModelOptions({
      draft: {
        currentName: 'openrouter',
        name: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-test',
        headersText: '',
        models: [{ name: '', alias: '' }],
        verifyModel: '',
      },
      remoteModelsState: {
        status: 'idle',
        message: '',
        models: [],
        lastFetchedAt: null,
      },
    }).source,
    'preset',
  );
});

test('renameProviderVerifyState moves cached state to the new provider name', () => {
  const states = {
    deepseek: {
      model: 'deepseek-chat',
      status: 'success',
      message: 'ok',
      lastVerifiedAt: 123,
    },
  };

  assert.deepEqual(renameProviderVerifyState(states, 'deepseek', 'deepseek-prod'), {
    'deepseek-prod': {
      model: 'deepseek-chat',
      status: 'success',
      message: 'ok',
      lastVerifiedAt: 123,
    },
  });
});

test('buildHeadersText and parseHeadersText convert between map and textarea text', () => {
  assert.equal(
    buildHeadersText({ Authorization: 'Bearer sk-test', 'X-Team': 'team-a' }),
    'Authorization: Bearer sk-test\nX-Team: team-a',
  );

  assert.deepEqual(
    parseHeadersText('Authorization: Bearer sk-test\nX-Team: team-a\ninvalid-line'),
    {
      Authorization: 'Bearer sk-test',
      'X-Team': 'team-a',
    },
  );
});

test('buildProviderConfigSignature normalizes base url and headers ordering', () => {
  const left = buildProviderConfigSignature({
    baseUrl: 'https://api.deepseek.com/v1/',
    apiKey: ' sk-test ',
    headersText: 'X-Title: GetTokens\nAuthorization: Bearer sk-test',
  });

  const right = buildProviderConfigSignature({
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test',
    headers: {
      Authorization: 'Bearer sk-test',
      'X-Title': 'GetTokens',
    },
  });

  assert.equal(left, right);
});

test('buildModelRows and normalizeProviderModels keep editable model aliases', () => {
  assert.deepEqual(buildModelRows([{ name: 'deepseek-chat', alias: 'chat' }]), [
    { name: 'deepseek-chat', alias: 'chat' },
  ]);

  assert.deepEqual(
    normalizeProviderModels([
      { name: ' deepseek-chat ', alias: ' chat ' },
      { name: '', alias: 'ignored' },
      { name: 'deepseek-chat', alias: 'dup' },
      { name: 'deepseek-reasoner', alias: '' },
    ]),
    [
      { name: 'deepseek-chat', alias: 'chat' },
      { name: 'deepseek-reasoner', alias: '' },
    ],
  );
});

test('shouldRefreshRemoteModels returns true only when cache is empty or stale for one day', () => {
  assert.equal(shouldRefreshRemoteModels(null, 1000), true);
  assert.equal(shouldRefreshRemoteModels(1000, 1000 + 60 * 60 * 1000), false);
  assert.equal(shouldRefreshRemoteModels(1000, 1000 + 24 * 60 * 60 * 1000), true);
});
