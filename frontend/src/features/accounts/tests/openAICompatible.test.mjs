import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
import {
  buildOpenAICompatibleCardBadges,
  resolveOpenAICompatibleCardEyebrow,
  resolveOpenAICompatibleCardTone,
  resolveOpenAICompatibleVerifyMessage,
} from '../model/openAICompatibleCard.ts';
import {
  getFormatBaseUrl,
  getVendorPreset,
} from '../model/vendorPresets.ts';

const t = (key) =>
  ({
    'accounts.ui_openai_compatible_badge': '兼容 OpenAI',
    'accounts.rotation_disabled_badge': '已禁用',
    'accounts.openai_provider_test_success': '账号验证成功',
    'accounts.openai_provider_test_failed': '账号验证失败',
    'accounts.openai_provider_test_idle': '尚未执行验证',
    'accounts.card_asset': '账号 ID',
    'accounts.card_source_type': '数据源',
    'accounts.ui_models': '模型',
    'accounts.openai_provider_last_verified': '最近验证时间',
  })[key] || key;

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

test('maskProviderAPIKey keeps short keys and masks long keys', () => {
  assert.equal(maskProviderAPIKey(''), '—');
  assert.equal(maskProviderAPIKey('sk-1234'), 'sk-1234');
  assert.equal(maskProviderAPIKey('sk-1234567890'), 'sk-1...7890');
});

test('openai-compatible card helpers resolve shared top-region metadata', () => {
  const provider = {
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-test',
    disabled: false,
  };
  const verifyState = {
    model: 'deepseek-chat',
    status: 'success',
    message: '',
    lastVerifiedAt: 1747288800000,
  };

  assert.equal(resolveOpenAICompatibleCardTone(provider, verifyState), 'positive');
  assert.equal(resolveOpenAICompatibleCardEyebrow(t, provider, verifyState), '账号验证成功');
  assert.deepEqual(buildOpenAICompatibleCardBadges(t, provider), [{ label: '兼容 OpenAI' }]);
  assert.equal(resolveOpenAICompatibleVerifyMessage(t, verifyState), '尚未执行验证');
});

test('openai-compatible card helpers expose disabled warning state', () => {
  const provider = {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-test',
    disabled: true,
  };
  const verifyState = {
    model: '',
    status: 'idle',
    message: '',
    lastVerifiedAt: null,
  };

  assert.equal(resolveOpenAICompatibleCardTone(provider, verifyState), 'warning');
  assert.equal(resolveOpenAICompatibleCardEyebrow(t, provider, verifyState), '已禁用');
  assert.deepEqual(buildOpenAICompatibleCardBadges(t, provider), [
    { label: '兼容 OpenAI' },
    { label: '已禁用', tone: 'warning' },
  ]);
});

test('openai compatible provider card uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/OpenAICompatibleProviderCard.tsx', import.meta.url), 'utf8');
  const targetSource = [
    sourceBlock(source, 'export default function OpenAICompatibleProviderCard', 'function openAICompatibleProviderIdentity'),
    sourceBlock(source, 'function RegionHead', 'function MetricPanel'),
    sourceBlock(source, 'function MetricPanel', null),
  ].join('\n');

  assert.match(source, /const openAICompatibleProviderCardBodyClass =/);
  assert.match(source, /const openAICompatibleProviderCardPanelClass =/);
  assert.match(source, /const openAICompatibleProviderCardButtonClass =/);
  assert.match(source, /const openAICompatibleProviderCardDangerButtonClass =/);
  assert.match(source, /const openAICompatibleProviderCardStatusClass =/);
  assert.match(targetSource, /data-openai-compatible-provider-card-body/);
  assert.match(targetSource, /data-openai-compatible-provider-card-models/);
  assert.match(targetSource, /data-openai-compatible-provider-card-actions/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(targetSource, /btn-swiss/);
  assert.doesNotMatch(targetSource, /border-2|border-t-2|border-b-2/);
  assert.doesNotMatch(targetSource, /border-dashed/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(targetSource, /color-status-/);
  assert.doesNotMatch(targetSource, /font-black/);
  assert.doesNotMatch(targetSource, /uppercase/);
  assert.doesNotMatch(targetSource, /tracking-\[0\.04em\]|tracking-\[0\.06em\]|tracking-\[0\.08em\]|tracking-\[0\.16em\]/);
  assert.doesNotMatch(targetSource, /shadow-\[/);
});

test('vendor logo mark uses quiet provider badge tokens', async () => {
  const source = await readFile(new URL('../components/VendorLogoMark.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-provider-logo=\{logo\.kind\}/);
  assert.match(source, /--vendor-logo-color/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-surface-muted/);
  assert.doesNotMatch(source, /--border-color/);
  assert.doesNotMatch(source, /--bg-main/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /\buppercase\b/);
});

test('openai compatible compose modal uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/OpenAICompatibleComposeModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const openAICompatibleComposeOverlayClass =/);
  assert.match(source, /const openAICompatibleComposePanelClass =/);
  assert.match(source, /const openAICompatibleComposeHeaderClass =/);
  assert.match(source, /const openAICompatibleComposeInputClass =/);
  assert.match(source, /const openAICompatibleComposeButtonClass =/);
  assert.match(source, /const openAICompatibleComposeErrorClass =/);
  assert.match(source, /data-openai-compatible-compose-modal/);
  assert.match(source, /data-openai-compatible-compose-header/);
  assert.match(source, /data-openai-compatible-compose-body/);
  assert.match(source, /data-openai-compatible-compose-error/);
  assert.match(source, /data-openai-compatible-compose-footer/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /btn-swiss|input-swiss|select-swiss|card-swiss/);
  assert.doesNotMatch(source, /border-2|border-t-2|border-b-2|border-dashed/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-main\)\]|bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(source, /font-black|\buppercase\b|shadow-hard|shadow-\[/);
  assert.doesNotMatch(source, /tracking-\[/);
});

test('openai compatible workspace uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/OpenAICompatibleWorkspace.tsx', import.meta.url), 'utf8');

  assert.match(source, /const openAICompatibleWorkspaceShellClass =/);
  assert.match(source, /const openAICompatibleWorkspaceActionButtonClass =/);
  assert.match(source, /const openAICompatibleWorkspacePrimaryButtonClass =/);
  assert.match(source, /const openAICompatibleWorkspaceStateClass =/);
  assert.match(source, /data-openai-compatible-workspace="quiet"/);
  assert.match(source, /data-openai-compatible-workspace-actions="quiet"/);
  assert.match(source, /data-openai-compatible-workspace-state/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2/);
  assert.doesNotMatch(source, /border-dashed/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /\buppercase\b/);
  assert.doesNotMatch(source, /tracking-\[0\.2em\]|tracking-tight/);
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
        { name: 'deepseek-v4-pro[1m]', alias: '' },
        { name: 'deepseek-v4-flash', alias: '' },
        { name: 'deepseek-v4-pro', alias: '' },
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
        { name: 'glm-5.2[1m]', alias: 'GLM-5.2 1M' },
        { name: 'glm-5.2', alias: 'GLM-5.2' },
        { name: 'glm-4.5-air', alias: 'GLM-4.5-Air' },
        { name: 'glm-5', alias: 'GLM-5' },
        { name: 'glm-4.7', alias: 'GLM-4.7' },
      ],
    },
  ]);
});

test('legacy openai-compatible preset entries for relay vendors are derived from unified vendor presets', () => {
  for (const id of ['sub2api', 'new-api']) {
    const vendorPreset = getVendorPreset(id);
    const legacyPreset = getOpenAICompatibleProviderPreset(id);
    assert.ok(vendorPreset);
    assert.ok(legacyPreset);
    assert.equal(legacyPreset.label, vendorPreset.name);
    assert.equal(legacyPreset.baseUrl, getFormatBaseUrl(vendorPreset, 'openai_chat'));
    assert.deepEqual(
      legacyPreset.models.map((item) => item.name),
      vendorPreset.modelSuggestions,
    );
  }
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
        { name: 'deepseek-v4-pro[1m]', alias: '' },
        { name: 'deepseek-v4-flash', alias: '' },
        { name: 'deepseek-v4-pro', alias: '' },
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
        proxyUrl: 'http://proxy.local',
        quotaCurl: 'curl https://api.deepseek.com/user/balance',
        quotaEnabled: true,
        billingCurl: 'curl https://api.deepseek.com/user/balance',
        billingEnabled: true,
        platformCookie: 'service=abc',
        curlVariables: { region: 'cn' },
        models: [{ name: 'deepseek-chat', alias: 'chat' }],
      },
    ),
    {
      currentName: 'deepseek',
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      quotaCurl: 'curl https://api.deepseek.com/user/balance',
      quotaEnabled: true,
      billingCurl: 'curl https://api.deepseek.com/user/balance',
      billingEnabled: true,
      platformCookie: 'service=abc',
      curlVariables: { region: 'cn' },
      headersText: '',
      modelFetchApiKey: '',
      modelFetchBaseUrl: '',
      models: [{ name: 'deepseek-chat', alias: 'chat' }],
      verifyModel: 'deepseek-chat',
      proxyUrl: 'http://proxy.local',
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
      { name: 'deepseek-chat', alias: 'dup' },
      { name: 'deepseek-reasoner', alias: '' },
    ]),
    [
      { name: 'deepseek-chat', alias: 'chat' },
      { name: 'deepseek-chat', alias: 'dup' },
      { name: 'deepseek-reasoner', alias: '' },
    ],
  );
});

test('shouldRefreshRemoteModels returns true only when cache is empty or stale for one day', () => {
  assert.equal(shouldRefreshRemoteModels(null, 1000), true);
  assert.equal(shouldRefreshRemoteModels(1000, 1000 + 60 * 60 * 1000), false);
  assert.equal(shouldRefreshRemoteModels(1000, 1000 + 24 * 60 * 60 * 1000), true);
});

test('openai compatible provider detail opens through the unified account detail page', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /function findOpenAICompatibleAccountForProvider/);
  assert.match(source, /setSelectedAccount\(providerAccount\)/);
  assert.match(source, /markAccountDetailInHash\(providerAccount\.id\)/);
  assert.doesNotMatch(source, /OpenAICompatibleDetailModal/);
  assert.doesNotMatch(source, /openAICompatibleState\.openDetailModal/);
});

test('legacy openai compatible detail components are not part of the production detail route', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.equal((featureSource.match(/<UnifiedAccountDetailModal/g) || []).length, 1);
  assert.doesNotMatch(featureSource, /<OpenAICompatibleDetailModal/);
});
