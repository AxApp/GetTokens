import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUnifiedComposeCodexAPIKeyInput,
  shouldCreateUnifiedComposeAsCodexAPIKey,
} from '../model/unifiedComposeCreateTarget.ts';
import { getVendorPreset } from '../model/vendorPresets.ts';

test('DeepSeek vendor preset creates a codex api key payload with balance curls', () => {
  const preset = getVendorPreset('deepseek');
  assert.ok(preset, 'deepseek preset should exist');
  assert.equal(shouldCreateUnifiedComposeAsCodexAPIKey(preset), true);

  const input = buildUnifiedComposeCodexAPIKeyInput({
    providerName: ' DeepSeek ',
    apiKey: ' sk-test ',
    baseUrl: ' https://api.deepseek.com/v1/ ',
    formatBaseUrls: {
      anthropic: ' https://api.deepseek.com/anthropic/ ',
      openai_chat: ' https://api.deepseek.com/v1/ ',
      openai_responses: ' ',
    },
    models: [
      { name: 'deepseek-v4-pro', alias: '' },
      { name: ' ', alias: 'ignored' },
    ],
    quotaCurl: preset.quotaCurlTemplate,
    quotaEnabled: true,
    billingCurl: preset.billingCurlTemplate,
    billingEnabled: true,
    platformCookie: ' ',
    curlVariables: { platformCookie: ' ', region: ' cn ' },
  });

  assert.equal(input.label, 'DeepSeek');
  assert.equal(input.apiKey, 'sk-test');
  assert.equal(input.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(input.quotaEnabled, true);
  assert.match(input.quotaCurl, /api\.deepseek\.com\/user\/balance/);
  assert.equal(input.billingEnabled, true);
  assert.match(input.billingCurl, /api\.deepseek\.com\/user\/balance/);
  assert.deepEqual(input.formatBaseUrls, {
    anthropic: 'https://api.deepseek.com/anthropic',
    openai_chat: 'https://api.deepseek.com/v1',
  });
  assert.deepEqual(input.models, [{ name: 'deepseek-v4-pro', alias: '' }]);
  assert.deepEqual(input.curlVariables, { region: 'cn' });
});

test('plain provider presets without quota or billing stay openai-compatible', () => {
  const preset = getVendorPreset('anthropic');
  assert.ok(preset, 'anthropic preset should exist');
  assert.equal(shouldCreateUnifiedComposeAsCodexAPIKey(preset), false);
});
