import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAPIKeyLabelStorageKey,
  buildRelayCodexAuthJSONSnippet,
  buildRelayCodexConfigTomlSnippet,
  buildManagedAuthJSONSnippet,
  buildManagedConfigTomlSnippet,
  normalizeBaseUrl,
  normalizePrefix,
} from './accountConfig.ts';

test('normalizeBaseUrl trims and removes trailing slashes', () => {
  assert.equal(normalizeBaseUrl(' https://api.example.com/v1/// '), 'https://api.example.com/v1');
});

test('normalizePrefix trims leading and trailing slashes', () => {
  assert.equal(normalizePrefix(' /openai-compatible/ '), 'openai-compatible');
});

test('buildAPIKeyLabelStorageKey normalizes url and prefix before serializing', () => {
  assert.equal(
    buildAPIKeyLabelStorageKey(' sk-123 ', 'https://api.example.com/v1///', '/relay/'),
    JSON.stringify({
      apiKey: 'sk-123',
      baseUrl: 'https://api.example.com/v1',
      prefix: 'relay',
    })
  );
});

test('buildManagedAuthJSONSnippet fills placeholders and normalized base url', () => {
  assert.equal(
    buildManagedAuthJSONSnippet({
      apiKey: ' ',
      baseUrl: ' https://api.example.com/v1/// ',
    }),
    JSON.stringify(
      {
        auth_mode: 'apikey',
        OPENAI_API_KEY: '<FILL_API_KEY>',
        base_url: 'https://api.example.com/v1',
      },
      null,
      2
    )
  );
});

test('buildManagedConfigTomlSnippet derives provider id from prefix when available', () => {
  const snippet = buildManagedConfigTomlSnippet({
    baseUrl: 'https://api.example.com/v1/',
    prefix: '/OpenAI Compatible/',
  });

  assert.match(snippet, /model_provider = "openai-compatible"/);
  assert.match(snippet, /\[model_providers\.openai-compatible\]/);
  assert.match(snippet, /base_url = "https:\/\/api\.example\.com\/v1"/);
});

test('buildRelayCodexAuthJSONSnippet only keeps the fields codex actually uses', () => {
  assert.equal(
    buildRelayCodexAuthJSONSnippet({
      apiKey: ' sk-service-key ',
    }),
    JSON.stringify(
      {
        auth_mode: 'apikey',
        OPENAI_API_KEY: 'sk-service-key',
      },
      null,
      2
    )
  );
});

test('buildRelayCodexConfigTomlSnippet writes the codex base url config', () => {
  const snippet = buildRelayCodexConfigTomlSnippet({
    baseUrl: ' http://127.0.0.1:8317/v1/ ',
  });

  assert.equal(snippet, 'model = "gpt-5.4"\nopenai_base_url = "http://127.0.0.1:8317/v1"');
});
