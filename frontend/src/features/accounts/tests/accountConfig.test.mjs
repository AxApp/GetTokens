import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildApiKeyConfigDraft,
  buildBillingCurlSetupGuide,
  buildBillingCurlTemplate,
  buildQuotaCurlSetupGuide,
  buildQuotaCurlTemplate,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  resolveManagementBaseUrl,
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
import {
  getFormatBaseUrl,
  getVendorPreset,
} from '../model/vendorPresets.ts';

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
      formatBaseUrls: {
        openai_chat: 'https://api.deepseek.com/v1',
        openai_responses: 'https://api.deepseek.com/responses',
        anthropic: 'https://api.deepseek.com/anthropic',
      },
      prefix: '/relay/',
      quotaCurl: 'quota',
      quotaEnabled: true,
      billingCurl: 'billing',
      billingEnabled: true,
      platformCookie: '',
      curlVariables: {},
      proxyUrl: 'socks5://127.0.0.1:7890',
    }),
    {
      label: '',
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/v1',
      formatBaseUrls: {
        openai_chat: 'https://api.deepseek.com/v1',
        openai_responses: 'https://api.deepseek.com/responses',
        anthropic: 'https://api.deepseek.com/anthropic',
      },
      prefix: '/relay/',
      models: [],
      quotaCurl: 'quota',
      quotaEnabled: true,
      billingCurl: 'billing',
      billingEnabled: true,
      platformCookie: '',
      curlVariables: {},
      proxyUrl: 'socks5://127.0.0.1:7890',
    },
  );
});

test('resolveManagementBaseUrl prefers the openai-compatible endpoint for management scripts', () => {
  assert.equal(
    resolveManagementBaseUrl({
      baseUrl: ' https://relay.example.com/codex/v1/ ',
      formatBaseUrls: {
        openai_chat: ' https://relay.example.com/openai/v1/ ',
        openai_responses: ' https://relay.example.com/responses/v1/ ',
        anthropic: ' https://relay.example.com/anthropic/ ',
      },
    }),
    'https://relay.example.com/openai/v1',
  );

  assert.equal(
    resolveManagementBaseUrl({
      baseUrl: ' https://relay.example.com/codex/v1/ ',
      formatBaseUrls: {
        openai_chat: ' ',
      },
    }),
    'https://relay.example.com/codex/v1',
  );
});

test('buildApiKeyConfigDraft seeds generic quota templates from the management endpoint', () => {
  const draft = buildApiKeyConfigDraft({
    displayName: 'Relay Gateway',
    provider: 'codex',
    apiKey: 'sk-test',
    baseUrl: 'https://relay.example.com/codex/v1',
    formatBaseUrls: {
      openai_chat: 'https://relay.example.com/openai/v1',
      openai_responses: 'https://relay.example.com/codex/v1',
      anthropic: 'https://relay.example.com/anthropic',
    },
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
    billingCurl: '',
    billingEnabled: false,
    proxyUrl: '',
  });

  assert.match(draft.quotaCurl, /https:\/\/relay\.example\.com\/openai\/v1\/api\/codex\/usage/);
});

test('buildApiKeyConfigDraft matches vendor billing templates through the management endpoint', () => {
  const draft = buildApiKeyConfigDraft({
    displayName: 'DeepSeek Relay',
    provider: 'codex',
    apiKey: 'sk-test',
    baseUrl: 'https://relay.example.com/codex/v1',
    formatBaseUrls: {
      openai_chat: 'https://api.deepseek.com/v1',
      openai_responses: 'https://relay.example.com/codex/v1',
      anthropic: 'https://relay.example.com/anthropic',
    },
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
    billingCurl: '',
    billingEnabled: false,
    proxyUrl: '',
  });

  assert.equal(
    draft.billingCurl,
    'curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"',
  );
});

test('hasApiKeyConfigChanges detects per-format endpoint edits', () => {
  const account = {
    apiKey: 'sk-test',
    baseUrl: 'https://relay.example.com/v1',
    formatBaseUrls: {
      openai_chat: 'https://relay.example.com/v1',
      openai_responses: 'https://relay.example.com/responses',
      anthropic: 'https://relay.example.com/anthropic',
    },
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
      formatBaseUrls: {
        ...account.formatBaseUrls,
        openai_responses: 'https://relay.example.com/codex',
      },
    }),
    true,
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
    displayName: 'Xiaomi MiMo Token Plan',
    provider: 'codex',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  });

  assert.match(template, /https:\/\/platform\.xiaomimimo\.com\/api\/v1\/tokenPlan\/usage/);
  assert.match(template, /\{\{platformCookie\}\}/);
  assert.doesNotMatch(template, /api-platform_serviceToken=/);
});

test('buildBillingCurlTemplate resolves Xiaomi MiMo balance preset without secrets', () => {
  const template = buildBillingCurlTemplate({
    displayName: 'Xiaomi MiMo API',
    provider: 'codex',
    baseUrl: 'https://api.xiaomimimo.com/v1',
  });

  assert.match(template, /https:\/\/platform\.xiaomimimo\.com\/api\/v1\/balance/);
  assert.match(template, /\{\{platformCookie\}\}/);
  assert.doesNotMatch(template, /api-platform_serviceToken=/);
});

test('Xiaomi MiMo curl setup guides explain how to copy platform cookies', () => {
  const quotaGuide = buildQuotaCurlSetupGuide({
    displayName: 'Xiaomi MiMo Token Plan',
    provider: 'codex',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  });
  const billingGuide = buildBillingCurlSetupGuide({
    displayName: 'Xiaomi MiMo API',
    provider: 'codex',
    baseUrl: 'https://api.xiaomimimo.com/v1',
  });

  assert.ok(quotaGuide.length >= 3);
  assert.ok(billingGuide.length >= 3);
  assert.match(quotaGuide.join(' '), /Cookie/);
  assert.match(billingGuide.join(' '), /\{\{platformCookie\}\}/);
});


test('Unified compose persists dedicated model fetch credential when creating Token Plan preset', async () => {
  const source = readFileSync(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  assert.match(source, /modelFetchApiKey:\s*unifiedComposeForm\.modelFetchApiKey\?\.trim\(\) \|\| ""/);
  assert.match(source, /modelFetchBaseUrl:\s*unifiedComposeForm\.modelFetchBaseUrl\?\.trim\(\) \|\| ""/);
  assert.match(source, /billingCurl:\s*preset\.billingCurlTemplate \?\? prev\.billingCurl/);
  assert.match(source, /billingEnabled:\s*Boolean\(preset\.billingCurlTemplate\)/);
});


test('vendor presets drive auxiliary credentials and cURL variables generically', () => {
  const composeSource = readFileSync(new URL('../components/UnifiedComposeModal.tsx', import.meta.url), 'utf8');
  const presetSource = readFileSync(new URL('../model/vendorPresets.ts', import.meta.url), 'utf8');
  assert.match(composeSource, /UnifiedComposeCredentialFieldsSection/);
  assert.match(composeSource, /CredentialFieldGroup/);
  assert.match(composeSource, /credentialFields=\{selectedPreset\?\.credentialFields/);
  assert.match(presetSource, /credentialFields: \[XIAOMI_MIMO_PLATFORM_COOKIE_FIELD/);
  assert.match(presetSource, /variableName: "platformCookie"/);
  assert.match(presetSource, /scope: "model_fetch"/);
});

test('relay vendor presets expose OpenAI chat, Codex responses, and Anthropic endpoints', () => {
  const sub2api = getVendorPreset('sub2api');
  assert.ok(sub2api);
  assert.equal(sub2api.category, 'aggregator');
  assert.deepEqual(sub2api.supportedFormats, ['openai_chat', 'openai_responses', 'anthropic']);
  assert.equal(getFormatBaseUrl(sub2api, 'openai_chat'), 'http://localhost:8080/v1');
  assert.equal(getFormatBaseUrl(sub2api, 'openai_responses'), 'http://localhost:8080/v1');
  assert.equal(getFormatBaseUrl(sub2api, 'anthropic'), 'http://localhost:8080/antigravity');

  const newAPI = getVendorPreset('new-api');
  assert.ok(newAPI);
  assert.equal(newAPI.category, 'aggregator');
  assert.deepEqual(newAPI.supportedFormats, ['openai_chat', 'openai_responses', 'anthropic']);
  assert.equal(getFormatBaseUrl(newAPI, 'openai_chat'), 'http://localhost:3000/v1');
  assert.equal(getFormatBaseUrl(newAPI, 'openai_responses'), 'http://localhost:3000/v1');
  assert.equal(getFormatBaseUrl(newAPI, 'anthropic'), 'http://localhost:3000');
});

test('generated Wails account models preserve quota curl fields', () => {
  const source = readFileSync(wailsModelsPath, 'utf8');

  assert.match(source, /export class AccountRecord[\s\S]*statusMessage\?: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*runtimeStatus\?: string;[\s\S]*runtimeReason\?: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*routeable\?: boolean;[\s\S]*registeredModelCount\?: number;/);
  assert.match(source, /export class AccountRecord[\s\S]*runtimeRepairOutcome\?: string;[\s\S]*runtimeRepairAction\?: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*runtimeRepairTriggerStatus\?: string;[\s\S]*lastRuntimeRepairAtUnixMs\?: number;/);
  assert.match(source, /export class AccountRecord[\s\S]*runtimeFailureClass\?: string;[\s\S]*runtimeRepairTriggerClass\?: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*quotaCurl\?: string;[\s\S]*quotaEnabled\?: boolean;/);
  assert.match(source, /export class CreateCodexAPIKeyInput[\s\S]*quotaCurl\?: string;[\s\S]*quotaEnabled\?: boolean;/);
  assert.match(source, /export class UpdateCodexAPIKeyConfigInput[\s\S]*quotaCurl\?: string;[\s\S]*quotaEnabled\?: boolean;/);
  assert.match(source, /export class TestCodexAPIKeyQuotaCurlInput[\s\S]*quotaCurl: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*billingCurl\?: string;[\s\S]*billingEnabled\?: boolean;/);
  assert.match(source, /export class AccountRecord[\s\S]*platformCookie\?: string;/);
  assert.match(source, /export class CreateCodexAPIKeyInput[\s\S]*platformCookie\?: string;/);
  assert.match(source, /export class UpdateCodexAPIKeyConfigInput[\s\S]*platformCookie\?: string;/);
  assert.match(source, /export class TestCodexAPIKeyQuotaCurlInput[\s\S]*platformCookie\?: string;/);
  assert.match(source, /export class AccountRecord[\s\S]*curlVariables\?: Record<string, string>;/);
  assert.match(source, /export class CreateCodexAPIKeyInput[\s\S]*curlVariables\?: Record<string, string>;/);
  assert.match(source, /export class UpdateCodexAPIKeyConfigInput[\s\S]*curlVariables\?: Record<string, string>;/);
  assert.match(source, /export class TestCodexAPIKeyQuotaCurlInput[\s\S]*curlVariables\?: Record<string, string>;/);
  assert.match(source, /export class AccountRecord[\s\S]*modelFetchApiKey\?: string;[\s\S]*modelFetchBaseUrl\?: string;/);
  assert.match(source, /export class CreateCodexAPIKeyInput[\s\S]*billingCurl\?: string;[\s\S]*billingEnabled\?: boolean;/);
  assert.match(source, /export class UpdateCodexAPIKeyConfigInput[\s\S]*billingCurl\?: string;[\s\S]*billingEnabled\?: boolean;/);
  assert.match(source, /export class CodexQuotaResponse[\s\S]*billing\?: CodexQuotaBillingInfo;/);
  assert.match(source, /export class CodexQuotaSourceState[\s\S]*source: string;[\s\S]*nextReset\?: string;/);
  assert.match(source, /export class CodexQuotaResponse[\s\S]*blocked: boolean;[\s\S]*sources: CodexQuotaSourceState\[\];/);
});

test('generated Wails app bindings expose quota curl draft test method', () => {
  const source = readFileSync(wailsAppBindingsPath, 'utf8');

  assert.match(source, /export function TestCodexAPIKeyQuotaCurl\(arg1\)/);
  assert.match(source, /export function TestCodexAPIKeyBillingCurl\(arg1\)/);
});

test('api key config save persists database fields without quota or billing network preflight', () => {
  const source = readFileSync(accountsActionsPath, 'utf8');
  const saveStart = source.indexOf('const updateSelectedApiKeyConfig = useCallback(');
  const saveEnd = source.indexOf('const formatBulkActionMessage = useCallback(', saveStart);
  const saveBlock = source.slice(saveStart, saveEnd);
  const updateIndex = saveBlock.indexOf("'UpdateCodexAPIKeyConfig'");

  assert.ok(saveStart >= 0, 'updateSelectedApiKeyConfig block should exist');
  assert.ok(updateIndex >= 0, 'save action should persist api key config');
  assert.doesNotMatch(saveBlock, /TestCodexAPIKeyQuotaCurl/);
  assert.doesNotMatch(saveBlock, /TestCodexAPIKeyBillingCurl/);
  assert.doesNotMatch(saveBlock, /resolveManagementBaseUrl/);
  assert.doesNotMatch(saveBlock, /nextManagementBaseURL/);
  assert.match(saveBlock, /quotaCurl: nextQuotaCurl/);
  assert.match(saveBlock, /billingCurl: nextBillingCurl/);
});
