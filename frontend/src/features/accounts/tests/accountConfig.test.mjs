import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildApiKeyConfigDraft,
  buildBillingCurlTemplate,
  buildQuotaCurlTemplate,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
} from '../model/accountDetailConfig.ts';
import {
  buildAPIKeyLabelStorageKey as buildAPIKeyLabelStorageKeyFromConfig,
  buildDefaultCodexQuotaCurl as buildDefaultCodexQuotaCurlFromConfig,
  buildCodexAPIKeyVerifyInput as buildCodexAPIKeyVerifyInputFromConfig,
  buildRelayCodexAuthJSONSnippet as buildRelayCodexAuthJSONSnippetFromConfig,
  buildRelayCodexConfigTomlSnippet as buildRelayCodexConfigTomlSnippetFromConfig,
  buildManagedAuthJSONSnippet as buildManagedAuthJSONSnippetFromConfig,
  buildManagedConfigTomlSnippet as buildManagedConfigTomlSnippetFromConfig,
  normalizeBaseUrl as normalizeBaseUrlFromConfig,
  normalizePrefix as normalizePrefixFromConfig,
} from '../model/accountConfig.ts';

const wailsModelsPath = fileURLToPath(new URL('../../../../wailsjs/go/models.ts', import.meta.url));
const wailsAppBindingsPath = fileURLToPath(new URL('../../../../wailsjs/go/main/App.js', import.meta.url));
const accountsActionsPath = fileURLToPath(new URL('../hooks/useAccountsActions.ts', import.meta.url));

test('normalizeBaseUrl trims and removes trailing slashes', () => {
  assert.equal(normalizeBaseUrlFromConfig(' https://api.example.com/v1/// '), 'https://api.example.com/v1');
});

test('normalizePrefix trims leading and trailing slashes', () => {
  assert.equal(normalizePrefixFromConfig(' /openai-compatible/ '), 'openai-compatible');
});

test('buildAPIKeyLabelStorageKey normalizes url and prefix before serializing', () => {
  assert.equal(
    buildAPIKeyLabelStorageKeyFromConfig(' sk-123 ', 'https://api.example.com/v1///', '/relay/'),
    JSON.stringify({
      apiKey: 'sk-123',
      baseUrl: 'https://api.example.com/v1',
      prefix: 'relay',
    })
  );
});

test('buildDefaultCodexQuotaCurl creates a safe editable quota template', () => {
  assert.equal(
    buildDefaultCodexQuotaCurlFromConfig(' https://api.example.com/v1/ '),
    'curl -sS "https://api.example.com/v1/api/codex/usage" -H "Authorization: Bearer {{apiKey}}" -H "Accept: application/json"'
  );
});

test('buildManagedAuthJSONSnippet writes minimal API key auth payload', () => {
  assert.equal(
    buildManagedAuthJSONSnippetFromConfig({
      apiKey: ' ',
      baseUrl: ' https://api.example.com/v1/// ',
    }),
    JSON.stringify(
      {
        auth_mode: 'apikey',
        OPENAI_API_KEY: '<FILL_API_KEY>',
      },
      null,
      2
    )
  );
});

test('buildManagedConfigTomlSnippet derives provider id from prefix when available', () => {
  const snippet = buildManagedConfigTomlSnippetFromConfig({
    baseUrl: 'https://api.example.com/v1/',
    prefix: '/OpenAI Compatible/',
  });

  assert.match(snippet, /model_provider = "openai-compatible"/);
  assert.match(snippet, /\[model_providers\.openai-compatible\]/);
  assert.match(snippet, /base_url = "https:\/\/api\.example\.com\/v1"/);
});

test('buildRelayCodexAuthJSONSnippet only keeps the fields codex actually uses', () => {
  assert.equal(
    buildRelayCodexAuthJSONSnippetFromConfig({
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

test('buildRelayCodexConfigTomlSnippet writes a custom codex provider config', () => {
  const snippet = buildRelayCodexConfigTomlSnippetFromConfig({
    baseUrl: ' http://127.0.0.1:8317/v1/ ',
    model: ' gpt-5.5 ',
    reasoningEffort: ' xhigh ',
    providerID: ' gettokens ',
    providerName: ' GetTokens ',
  });

  assert.equal(
    snippet,
    [
      'model = "gpt-5.5"',
      'model_reasoning_effort = "xhigh"',
      'model_provider = "gettokens"',
      '',
      '[model_providers.gettokens]',
      'name = "GetTokens"',
      'base_url = "http://127.0.0.1:8317/v1"',
      'requires_openai_auth = true',
      'wire_api = "responses"',
    ].join('\n')
  );
});

test('buildRelayCodexConfigTomlSnippet keeps openai provider continuity when selected', () => {
  const snippet = buildRelayCodexConfigTomlSnippetFromConfig({
    baseUrl: ' http://127.0.0.1:8317/v1/ ',
    model: ' gpt-5.4 ',
    reasoningEffort: ' low ',
    providerID: ' openai ',
    providerName: ' OpenAI Relay ',
  });

  assert.equal(
    snippet,
    'model = "gpt-5.4"\nmodel_reasoning_effort = "low"\nopenai_base_url = "http://127.0.0.1:8317/v1"'
  );
});

test('buildCodexAPIKeyVerifyInput trims values and normalizes base url', () => {
  assert.deepEqual(
    buildCodexAPIKeyVerifyInputFromConfig({
      apiKey: ' sk-test ',
      baseUrl: ' https://api.openai.com/v1/ ',
      model: ' gpt-4.1-mini ',
    }),
    {
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    },
  );
});

test('buildApiKeyConfigDraft keeps billing fields for unified detail editing', () => {
  assert.deepEqual(
    buildApiKeyConfigDraft({
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/v1',
      prefix: '/relay/',
      quotaCurl: 'quota',
      quotaEnabled: true,
      billingCurl: 'billing',
      billingEnabled: true,
      proxyUrl: 'socks5://127.0.0.1:7890',
    }),
    {
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/v1',
      prefix: '/relay/',
      quotaCurl: 'quota',
      quotaEnabled: true,
      billingCurl: 'billing',
      billingEnabled: true,
      proxyUrl: 'socks5://127.0.0.1:7890',
    },
  );
});

test('hasApiKeyConfigChanges detects billing edits', () => {
  const account = {
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
    billingCurl: '',
    billingEnabled: false,
    proxyUrl: '',
  };

  assert.equal(hasApiKeyConfigChanges(account, buildApiKeyConfigDraft(account)), false);
  assert.equal(
    hasApiKeyConfigChanges(account, {
      ...buildApiKeyConfigDraft(account),
      billingCurl: 'curl -sS "https://api.deepseek.com/user/balance"',
      billingEnabled: true,
    }),
    true,
  );
});

test('hasApiKeyConfigChanges detects proxy route edits', () => {
  const account = {
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
    billingCurl: '',
    billingEnabled: false,
    proxyUrl: '',
  };

  assert.equal(
    hasApiKeyConfigChanges(account, {
      ...buildApiKeyConfigDraft(account),
      proxyUrl: 'direct',
    }),
    true,
  );
});

test('listApiKeyConfigMissingFields reports required credentials fields only', () => {
  assert.deepEqual(
    listApiKeyConfigMissingFields({
      apiKey: ' ',
      baseUrl: '',
      prefix: '',
      quotaCurl: '',
      quotaEnabled: false,
      billingCurl: '',
      billingEnabled: false,
      proxyUrl: '',
    }),
    ['API Key', 'Base URL'],
  );
});

test('buildBillingCurlTemplate resolves known vendor presets', () => {
  assert.equal(
    buildBillingCurlTemplate({
      displayName: 'DeepSeek',
      provider: 'codex',
      baseUrl: 'https://api.deepseek.com/v1',
    }),
    'curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"',
  );
});

test('buildQuotaCurlTemplate resolves Xiaomi MiMo token plan usage preset without secrets', () => {
  const template = buildQuotaCurlTemplate({
    displayName: 'Xiaomi MiMo',
    provider: 'codex',
    baseUrl: 'https://api.xiaomimimo.com/v1',
  });

  assert.match(template, /https:\/\/platform\.xiaomimimo\.com\/api\/v1\/tokenPlan\/usage/);
  assert.match(template, /<PASTE_PLATFORM_COOKIE>/);
  assert.doesNotMatch(template, /api-platform_serviceToken=/);
});

test('generated Wails account models preserve quota curl fields', () => {
  const source = readFileSync(wailsModelsPath, 'utf8');

  assert.match(source, /export class AccountRecord[\s\S]*statusMessage\?: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*quotaCurl\?: string;[\s\S]*quotaEnabled\?: boolean;/);
  assert.match(source, /export class CreateCodexAPIKeyInput[\s\S]*quotaCurl\?: string;[\s\S]*quotaEnabled\?: boolean;/);
  assert.match(source, /export class UpdateCodexAPIKeyConfigInput[\s\S]*quotaCurl\?: string;[\s\S]*quotaEnabled\?: boolean;/);
  assert.match(source, /export class TestCodexAPIKeyQuotaCurlInput[\s\S]*quotaCurl: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*billingCurl\?: string;[\s\S]*billingEnabled\?: boolean;/);
  assert.match(source, /export class CreateCodexAPIKeyInput[\s\S]*billingCurl\?: string;[\s\S]*billingEnabled\?: boolean;/);
  assert.match(source, /export class UpdateCodexAPIKeyConfigInput[\s\S]*billingCurl\?: string;[\s\S]*billingEnabled\?: boolean;/);
  assert.match(source, /export class CodexQuotaResponse[\s\S]*billing\?: CodexQuotaBillingInfo;/);
});

test('generated Wails app bindings expose quota curl draft test method', () => {
  const source = readFileSync(wailsAppBindingsPath, 'utf8');

  assert.match(source, /export function TestCodexAPIKeyQuotaCurl\(arg1\)/);
  assert.match(source, /export function TestCodexAPIKeyBillingCurl\(arg1\)/);
});

test('api key config save preflights enabled quota curl before persisting', () => {
  const source = readFileSync(accountsActionsPath, 'utf8');
  const testIndex = source.indexOf("'TestCodexAPIKeyQuotaCurl'");
  const updateIndex = source.indexOf("'UpdateCodexAPIKeyConfig'");

  assert.ok(testIndex >= 0, 'save action should test enabled quota curl');
  assert.ok(updateIndex >= 0, 'save action should persist api key config');
  assert.ok(testIndex < updateIndex, 'quota curl test should run before config update');
  assert.match(source, /if \(draft\.quotaEnabled && nextQuotaCurl\)/);
});
