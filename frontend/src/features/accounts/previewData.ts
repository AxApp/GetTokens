import type { AccountRecord, AuthFile } from '../../types';
import type { AccountUsageSummary } from './model/accountUsage';
import type { OpenAICompatibleProvider } from './model/openAICompatible';
import type { RateLimitState } from './model/rateLimit';
import type { CodexQuotaState } from './model/types';

const NOW_MS = Date.parse('2026-05-15T14:00:00+08:00');
const ACCOUNTS_PREVIEW_COUNT_QUERY_PARAM = 'accountsPreviewCount';

const PREVIEW_AUTH_FILES: AuthFile[] = [
  {
    name: 'codex-pro.json',
    type: 'codex',
    provider: 'codex',
    status: 'active',
    priority: 9,
    email: 'ops-pro@example.com',
    planType: 'pro',
    disabled: false,
  },
  {
    name: 'codex-plus-nightly.json',
    type: 'codex',
    provider: 'codex',
    status: 'active',
    priority: 7,
    email: 'nightly-plus@example.com',
    planType: 'plus',
    disabled: false,
  },
  {
    name: 'codex-team.json',
    type: 'codex',
    provider: 'codex',
    status: 'active',
    priority: 5,
    email: 'team-routing@example.com',
    planType: 'team',
    disabled: false,
  },
  {
    name: 'codex-free-low.json',
    type: 'codex',
    provider: 'codex',
    status: 'active',
    priority: 3,
    email: 'free-low@example.com',
    planType: 'free',
    disabled: false,
  },
  {
    name: 'codex-disabled.json',
    type: 'codex',
    provider: 'codex',
    status: 'disabled',
    statusMessage: 'manual route guard enabled',
    priority: 1,
    email: 'disabled-route@example.com',
    planType: 'pro',
    disabled: true,
  },
  {
    name: 'codex-expired.json',
    type: 'codex',
    provider: 'codex',
    status: 'error',
    statusMessage: 'refresh token expired',
    priority: 2,
    email: 'legacy-expired@example.com',
    planType: 'free',
    disabled: false,
  },
  {
    name: 'claude-relay.json',
    type: 'claude',
    provider: 'claude',
    status: 'active',
    priority: 6,
    email: 'claude-relay@example.com',
    planType: 'pro',
    disabled: false,
  },
  {
    name: 'gemini-oauth.json',
    type: 'gemini',
    provider: 'gemini',
    status: 'active',
    priority: 4,
    email: 'gemini-oauth@example.com',
    planType: 'plus',
    disabled: false,
  },
];

const PREVIEW_API_KEY_ACCOUNTS: AccountRecord[] = [
  {
    id: 'codex-api-key:stable-001',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Stable 001',
    status: 'configured',
    priority: 7,
    apiKey: 'sk-preview-stable-001',
    keySuffix: '8D31',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'stable-001',
    proxyUrl: 'direct',
    quotaKey: 'codex-api-key:stable-001',
    quotaEnabled: true,
    quotaCurl: 'curl -s https://api.openai.com/dashboard/billing/usage',
    billingEnabled: true,
    billingCurl: 'curl -s https://api.openai.com/dashboard/billing/credit_grants',
    supportedFormats: ['anthropic', 'openai_responses'],
    models: [
      { name: 'gpt-5.4', alias: 'GPT 5.4' },
      { name: 'gpt-5.4-mini', alias: 'GPT 5.4 Mini' },
    ],
  },
  {
    id: 'codex-api-key:gray-canary',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Gray Canary',
    status: 'configured',
    priority: 4,
    apiKey: 'sk-preview-gray-canary',
    keySuffix: '3F19',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'gray-canary',
    proxyUrl: 'socks5://127.0.0.1:7890',
    quotaKey: 'codex-api-key:gray-canary',
    quotaEnabled: true,
    quotaCurl: 'curl -s https://api.openai.com/dashboard/billing/usage',
    billingEnabled: true,
    billingCurl: 'curl -s https://api.openai.com/dashboard/billing/credit_grants',
    supportedFormats: ['anthropic', 'openai_responses'],
    models: [
      { name: 'gpt-5.4-mini', alias: 'GPT 5.4 Mini' },
      { name: 'o4-mini', alias: 'O4 Mini' },
    ],
  },
  {
    id: 'codex-api-key:billing-usd',
    provider: 'openai',
    credentialSource: 'api-key',
    displayName: 'Billing USD Pool',
    status: 'configured',
    priority: 6,
    apiKey: 'sk-preview-billing-usd',
    keySuffix: '9A42',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'billing-usd',
    proxyUrl: '',
    quotaKey: 'codex-api-key:billing-usd',
    quotaEnabled: false,
    quotaCurl: '',
    billingEnabled: true,
    billingCurl: 'curl -s https://api.openai.com/dashboard/billing/credit_grants',
    supportedFormats: ['anthropic', 'openai_responses'],
    models: [
      { name: 'gpt-5.4', alias: 'GPT 5.4' },
      { name: 'gpt-5.2', alias: 'GPT 5.2' },
    ],
  },
  {
    id: 'codex-api-key:manual-disabled',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Manual Disabled',
    status: 'disabled',
    statusMessage: 'manual disable preview',
    priority: 1,
    disabled: true,
    apiKey: 'sk-preview-disabled',
    keySuffix: '7B20',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'manual-disabled',
    proxyUrl: 'http://127.0.0.1:8080',
    quotaKey: 'codex-api-key:manual-disabled',
    quotaEnabled: true,
    quotaCurl: 'curl -s https://api.openai.com/dashboard/billing/usage',
    supportedFormats: ['anthropic', 'openai_responses'],
  },
];

const PREVIEW_AUTH_FILE_CONTENT_BY_NAME: Record<string, string> = {
  'codex-pro.json': JSON.stringify({
    account_id: 'acct_preview_ops_pro',
    email: 'ops-pro@example.com',
    plan_type: 'pro',
    access_token: 'preview-access-token-redacted',
    refresh_token: 'preview-refresh-token-redacted',
    expires_at: '2026-05-15T18:40:00+08:00',
  }, null, 2),
  'codex-plus-nightly.json': JSON.stringify({
    account_id: 'acct_preview_nightly_plus',
    email: 'nightly-plus@example.com',
    plan_type: 'plus',
    access_token: 'preview-access-token-redacted',
    refresh_token: 'preview-refresh-token-redacted',
    expires_at: '2026-05-15T16:25:00+08:00',
  }, null, 2),
  'codex-team.json': JSON.stringify({
    account_id: 'acct_preview_team',
    email: 'team-routing@example.com',
    plan_type: 'team',
    access_token: 'preview-access-token-redacted',
    refresh_token: 'preview-refresh-token-redacted',
    expires_at: '2026-05-20T09:00:00+08:00',
  }, null, 2),
};

const PREVIEW_AUTH_FILE_MODELS_BY_NAME: Record<string, Array<{ name: string; display_name?: string }>> = {
  'codex-pro.json': [
    { name: 'gpt-5.4', display_name: 'GPT 5.4' },
    { name: 'gpt-5.4-mini', display_name: 'GPT 5.4 Mini' },
    { name: 'o4-mini', display_name: 'O4 Mini' },
  ],
  'codex-plus-nightly.json': [
    { name: 'gpt-5.4-mini', display_name: 'GPT 5.4 Mini' },
    { name: 'gpt-5.2', display_name: 'GPT 5.2' },
  ],
  'codex-team.json': [
    { name: 'gpt-5.4', display_name: 'GPT 5.4' },
    { name: 'gpt-5.4-mini', display_name: 'GPT 5.4 Mini' },
  ],
};

const PREVIEW_OPENAI_COMPATIBLE_PROVIDERS: OpenAICompatibleProvider[] = [
  previewProvider({
    name: 'openai',
    priority: 11,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-preview-openai-compatible',
    proxyUrl: '',
    keyCount: 2,
    modelCount: 3,
    models: [
      { alias: 'codex-gpt-5-4', name: 'gpt-5.4' },
      { alias: 'codex-gpt-5-mini', name: 'gpt-5.4-mini' },
      { alias: 'codex-o4', name: 'o4-mini' },
    ],
  }),
  previewProvider({
    name: 'deepseek',
    priority: 10,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-preview-deepseek',
    proxyUrl: 'socks5://127.0.0.1:7890',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: '', name: 'deepseek-v4-flash' },
      { alias: '', name: 'deepseek-v4-pro' },
    ],
  }),
  previewProvider({
    name: 'siliconflow',
    priority: 9,
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: 'sk-preview-siliconflow',
    proxyUrl: '',
    keyCount: 2,
    modelCount: 3,
    models: [
      { alias: 'sf-deepseek-v3', name: 'deepseek-ai/DeepSeek-V3.2' },
      { alias: 'sf-qwen3', name: 'Qwen/Qwen3-8B' },
      { alias: '', name: 'moonshotai/Kimi-K2-Instruct' },
    ],
  }),
  previewProvider({
    name: 'zhipu',
    priority: 8,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: 'sk-preview-zhipu',
    proxyUrl: 'http://127.0.0.1:7890',
    keyCount: 1,
    modelCount: 3,
    models: [
      { alias: 'glm-5', name: 'glm-5' },
      { alias: 'glm-flash', name: 'glm-4.5-flash' },
      { alias: '', name: 'glm-4.7' },
    ],
  }),
  previewProvider({
    name: 'moonshot',
    priority: 7,
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKey: 'sk-preview-moonshot',
    proxyUrl: '',
    keyCount: 1,
    modelCount: 3,
    models: [
      { alias: 'kimi-auto', name: 'moonshot-v1-auto' },
      { alias: 'kimi-k2', name: 'kimi-k2.5' },
      { alias: 'kimi-thinking', name: 'kimi-k2-thinking' },
    ],
  }),
  previewProvider({
    name: 'dashscope',
    priority: 6,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-preview-dashscope',
    proxyUrl: '',
    keyCount: 2,
    modelCount: 3,
    models: [
      { alias: 'qwen-plus', name: 'qwen3.5-plus' },
      { alias: 'qwen-flash', name: 'qwen3.5-flash' },
      { alias: 'deepseek-r1', name: 'deepseek-r1' },
    ],
  }),
  previewProvider({
    name: 'openrouter',
    priority: 3,
    disabled: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-preview',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: 'codex-kimi', name: 'moonshotai/kimi-k2' },
      { alias: '', name: 'openai/gpt-5.4-mini' },
    ],
  }),
  previewProvider({
    name: 'groq',
    priority: 2,
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: 'gsk_preview_groq',
    proxyUrl: '',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: 'groq-llama-8b', name: 'llama3-8b-8192' },
      { alias: 'groq-llama-70b', name: 'llama3-70b-8192' },
    ],
  }),
  previewProvider({
    name: 'together',
    priority: 2,
    baseUrl: 'https://api.together.xyz/v1',
    apiKey: 'sk-preview-together',
    proxyUrl: '',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: 'together-llama-vision', name: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo' },
      { alias: 'together-gemma', name: 'google/gemma-2-27b-it' },
    ],
  }),
  previewProvider({
    name: 'doubao',
    priority: 1,
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: 'sk-preview-doubao',
    proxyUrl: 'socks5://127.0.0.1:7890',
    keyCount: 1,
    modelCount: 3,
    models: [
      { alias: 'doubao-seed', name: 'doubao-seed-1-8-251228' },
      { alias: 'doubao-pro', name: 'doubao-1-5-pro-32k-250115' },
      { alias: 'doubao-r1', name: 'deepseek-r1-250120' },
    ],
  }),
];

const PREVIEW_QUOTA_BY_KEY: Record<string, CodexQuotaState> = {
  'codex-pro.json': {
    status: 'success',
    quota: previewQuota({
      planType: 'PRO',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 64, resetLabel: '2026-05-15 16:40', resetAtUnix: 1747298400 },
        { id: 'weekly', label: '7D', remainingPercent: 82, resetLabel: '2026-05-19 08:00', resetAtUnix: 1747612800 },
      ],
    }),
  },
  'codex-plus-nightly.json': {
    status: 'success',
    quota: previewQuota({
      planType: 'PLUS',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 18, resetLabel: '2026-05-15 15:25', resetAtUnix: 1747293900 },
        { id: 'weekly', label: '7D', remainingPercent: 35, resetLabel: '2026-05-19 06:30', resetAtUnix: 1747607400 },
      ],
    }),
  },
  'codex-team.json': {
    status: 'success',
    quota: previewQuota({
      planType: 'TEAM',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 41, resetLabel: '2026-05-15 17:15', resetAtUnix: 1747300500 },
        { id: 'weekly', label: '7D', remainingPercent: 58, resetLabel: '2026-05-20 09:00', resetAtUnix: 1747702800 },
      ],
    }),
  },
  'codex-free-low.json': {
    status: 'success',
    quota: previewQuota({
      planType: 'FREE',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 6, resetLabel: '2026-05-15 14:45', resetAtUnix: 1747291500 },
        { id: 'weekly', label: '7D', remainingPercent: 14, resetLabel: '2026-05-17 23:00', resetAtUnix: 1747494000 },
      ],
    }),
  },
  'codex-disabled.json': {
    status: 'success',
    quota: previewQuota({
      planType: 'PRO',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 76, resetLabel: '2026-05-15 18:30', resetAtUnix: 1747305000 },
        { id: 'weekly', label: '7D', remainingPercent: 91, resetLabel: '2026-05-21 12:00', resetAtUnix: 1747800000 },
      ],
    }),
  },
  'codex-expired.json': {
    status: 'error',
  },
  'codex-api-key:stable-001': {
    status: 'success',
    quota: previewQuota({
      planType: 'KEY',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 37, resetLabel: '2026-05-15 15:55', resetAtUnix: 1747295700 },
        { id: 'weekly', label: '7D', remainingPercent: 71, resetLabel: '2026-05-18 11:30', resetAtUnix: 1747548600 },
      ],
    }),
  },
  'codex-api-key:gray-canary': {
    status: 'success',
    quota: previewQuota({
      planType: 'KEY',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 22, resetLabel: '2026-05-15 15:10', resetAtUnix: 1747293000 },
        { id: 'weekly', label: '7D', remainingPercent: 49, resetLabel: '2026-05-18 02:00', resetAtUnix: 1747519200 },
      ],
    }),
  },
  'codex-api-key:billing-usd': {
    status: 'success',
    quota: previewQuota({
      planType: 'BILLING',
      windows: [],
      billing: {
        isAvailable: true,
        balanceInfos: [
          {
            currency: 'usd',
            totalBalance: '124.60',
            grantedBalance: '24.60',
            toppedUpBalance: '100.00',
          },
        ],
      },
    }),
  },
  'codex-api-key:manual-disabled': {
    status: 'success',
    quota: previewQuota({
      planType: 'KEY',
      windows: [
        { id: 'five-hour', label: '5H', remainingPercent: 96, resetLabel: '2026-05-15 18:00', resetAtUnix: 1747303200 },
        { id: 'weekly', label: '7D', remainingPercent: 88, resetLabel: '2026-05-20 19:00', resetAtUnix: 1747738800 },
      ],
    }),
  },
};

const PREVIEW_USAGE_BY_ID: Record<string, AccountUsageSummary> = {
  'auth-file:codex-pro.json': createUsageSummary({
    id: 'auth-file:codex-pro.json',
    provider: 'codex',
    attributionKey: 'auth-file:codex-pro.json',
    requestCount: 128,
    failedCount: 4,
    latency: 912,
    totalTokens: [42000, 58000, 73000, 64000, 81000, 55000, 64000, 45000],
    requestedModels: ['gpt-5.4', 'gpt-5.4-mini'],
    lastActivityOffsetMs: 6 * 60 * 1000,
  }),
  'auth-file:codex-team.json': createUsageSummary({
    id: 'auth-file:codex-team.json',
    provider: 'codex',
    attributionKey: 'auth-file:codex-team.json',
    requestCount: 84,
    failedCount: 2,
    latency: 1045,
    totalTokens: [18000, 26000, 19000, 34000, 29000, 38000, 41000, 36000],
    requestedModels: ['gpt-5.4-mini'],
    lastActivityOffsetMs: 14 * 60 * 1000,
  }),
  'auth-file:codex-expired.json': createUsageSummary({
    id: 'auth-file:codex-expired.json',
    provider: 'codex',
    attributionKey: 'auth-file:codex-expired.json',
    requestCount: 12,
    failedCount: 9,
    latency: 1860,
    totalTokens: [6000, 4200, 3800, 2600, 1900, 1200, 900, 500],
    requestedModels: ['gpt-5.4'],
    lastActivityOffsetMs: 68 * 60 * 1000,
  }),
  'codex-api-key:stable-001': createUsageSummary({
    id: 'codex-api-key:stable-001',
    provider: 'codex',
    attributionKey: 'codex-api-key:stable-001',
    requestCount: 96,
    failedCount: 3,
    latency: 734,
    totalTokens: [16000, 22000, 34000, 28000, 43000, 39000, 47000, 51000],
    requestedModels: ['gpt-5.4', 'gpt-5.2'],
    lastActivityOffsetMs: 3 * 60 * 1000,
  }),
  'codex-api-key:gray-canary': createUsageSummary({
    id: 'codex-api-key:gray-canary',
    provider: 'codex',
    attributionKey: 'codex-api-key:gray-canary',
    requestCount: 44,
    failedCount: 7,
    latency: 1288,
    totalTokens: [9000, 11000, 8000, 14000, 19000, 17000, 15000, 13000],
    requestedModels: ['gpt-5.4-mini'],
    lastActivityOffsetMs: 27 * 60 * 1000,
  }),
  'openai-compatible:deepseek': createUsageSummary({
    id: 'openai-compatible:deepseek',
    provider: 'deepseek',
    attributionKey: 'openai-compatible:deepseek',
    requestCount: 72,
    failedCount: 1,
    latency: 622,
    totalTokens: [12000, 18000, 24000, 22000, 27000, 26000, 30000, 32000],
    requestedModels: ['deepseek-v4-flash'],
    lastActivityOffsetMs: 9 * 60 * 1000,
  }),
  'openai-compatible:openrouter': createUsageSummary({
    id: 'openai-compatible:openrouter',
    provider: 'openrouter',
    attributionKey: 'openai-compatible:openrouter',
    requestCount: 0,
    failedCount: 0,
    latency: 0,
    totalTokens: [0, 0, 0, 0, 0, 0, 0, 0],
    requestedModels: [],
    lastActivityOffsetMs: 0,
    source: 'none',
  }),
};

const PREVIEW_RATE_LIMIT_BY_ID: Record<string, RateLimitState> = {
  'codex-api-key:stable-001': previewRateLimitState({
    accountKey: 'codex-api-key:stable-001',
    updatedAt: '2026-05-15T14:00:00+08:00',
    rules: [
      {
        id: 'rlr-preview-stable-token',
        strategy: 'token-window',
        window: '24h',
        limitValue: 1000000,
        currentUsage: 684000,
        usagePct: 68.4,
      },
      {
        id: 'rlr-preview-stable-request',
        strategy: 'request-window',
        window: '1h',
        limitValue: 120,
        currentUsage: 46,
        usagePct: 38.3,
      },
    ],
  }),
  'codex-api-key:gray-canary': previewRateLimitState({
    accountKey: 'codex-api-key:gray-canary',
    blocked: true,
    blockReason: '1h requests 已满',
    updatedAt: '2026-05-15T14:00:00+08:00',
    rules: [
      {
        id: 'rlr-preview-canary-request',
        strategy: 'request-window',
        window: '1h',
        limitValue: 40,
        currentUsage: 44,
        usagePct: 110,
        exceeded: true,
        reason: '1h requests 已满',
      },
    ],
  }),
  'openai-compatible:deepseek': previewRateLimitState({
    accountKey: 'openai-compatible:deepseek',
    updatedAt: '2026-05-15T14:00:00+08:00',
    rules: [
      {
        id: 'rlr-preview-deepseek-token',
        strategy: 'token-window',
        window: '24h',
        limitValue: 800000,
        currentUsage: 221000,
        usagePct: 27.6,
      },
    ],
  }),
};

export function getAccountsPreviewAuthFiles(): AuthFile[] {
  return PREVIEW_AUTH_FILES.map((account) => ({ ...account }));
}

export function getAccountsPreviewAPIKeyRecords(): AccountRecord[] {
  return expandPreviewAccountRecords([
    ...PREVIEW_API_KEY_ACCOUNTS.map((account) => ({ ...account })),
    ...PREVIEW_OPENAI_COMPATIBLE_PROVIDERS.map((provider): AccountRecord => ({
      id: String(provider.accountKey || provider.name || '').trim(),
      accountKind: 'openai-compatible',
      provider: provider.name,
      credentialSource: 'api-key' as const,
      displayName: `OPENAI-COMPATIBLE · ${provider.name.toUpperCase()}`,
      status: provider.disabled ? 'disabled' : 'configured',
      priority: provider.priority,
      disabled: provider.disabled,
      apiKey: provider.apiKey,
      keySuffix: provider.apiKey.slice(-4).toUpperCase(),
      baseUrl: provider.baseUrl,
      prefix: provider.prefix || '',
      proxyUrl: provider.proxyUrl || '',
      supportedFormats: ['openai_chat', 'openai_responses'],
    })),
  ]);
}

export function getAccountsPreviewCodexAccounts(): AccountRecord[] {
  return [...getAccountsPreviewAuthFileRecords(), ...getAccountsPreviewAPIKeyRecords()].filter(
    (account) => String(account.provider || '').trim().toLowerCase() === 'codex',
  );
}

export function getAccountsPreviewAuthFileRecords(): AccountRecord[] {
  return PREVIEW_AUTH_FILES.map((account) => ({
    id: `auth-file:${account.name}`,
    provider: String(account.provider || account.type || 'unknown').trim().toLowerCase() || 'unknown',
    credentialSource: 'auth-file',
    displayName: account.name,
    status: String(account.status || 'active').trim().toUpperCase() || 'ACTIVE',
    statusMessage: String(account.statusMessage || '').trim(),
    priority: account.priority,
    disabled: account.disabled,
    email: account.email,
    planType: account.planType,
    name: account.name,
    authIndex: account.authIndex,
    quotaKey: account.name,
    rawAuthFile: { ...account },
  }));
}

export function getAccountsPreviewOpenAICompatibleProviders(): OpenAICompatibleProvider[] {
  return PREVIEW_OPENAI_COMPATIBLE_PROVIDERS.map((provider) => previewProvider(provider));
}

export function getAccountsPreviewQuotaStateByKey(accounts: AccountRecord[]): Record<string, CodexQuotaState> {
  const useFallbackQuota = readRequestedAccountsPreviewCount() > 0;
  return accounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
    const key = String(account.quotaKey || '').trim();
    if (!key) {
      return result;
    }
    if (PREVIEW_QUOTA_BY_KEY[key]) {
      result[key] = cloneQuotaState(PREVIEW_QUOTA_BY_KEY[key]);
      return result;
    }
    if (useFallbackQuota) {
      result[key] = createHighVolumePreviewQuotaState(account, Object.keys(result).length);
    }
    return result;
  }, {});
}

export function getAccountsPreviewUsageByID(
  accounts: Array<Pick<AccountRecord, 'id'> & Partial<Pick<AccountRecord, 'provider'>>>,
): Record<string, AccountUsageSummary> {
  return accounts.reduce<Record<string, AccountUsageSummary>>((result, account) => {
    const summary = PREVIEW_USAGE_BY_ID[account.id] || createFallbackUsageSummary(account);
    result[account.id] = cloneUsageSummary(summary);
    return result;
  }, {});
}

export function getAccountsPreviewRateLimitByID(accounts: Array<Pick<AccountRecord, 'id'>>): Record<string, RateLimitState> {
  return accounts.reduce<Record<string, RateLimitState>>((result, account) => {
    const state =
      PREVIEW_RATE_LIMIT_BY_ID[account.id] ||
      previewRateLimitState({
        accountKey: account.id,
        updatedAt: '2026-05-15T14:00:00+08:00',
        rules: [],
      });
    result[account.id] = cloneRateLimitState(state);
    return result;
  }, {});
}

export function getAccountsPreviewRelayModelNames(): string[] {
  const names = new Set<string>();
  for (const account of PREVIEW_API_KEY_ACCOUNTS) {
    for (const model of account.models ?? []) {
      if (model.name) {
        names.add(model.name);
      }
    }
  }
  for (const provider of PREVIEW_OPENAI_COMPATIBLE_PROVIDERS) {
    for (const model of provider.models ?? []) {
      if (model.name) {
        names.add(model.name);
      }
      if (model.alias) {
        names.add(model.alias);
      }
    }
  }
  for (const models of Object.values(PREVIEW_AUTH_FILE_MODELS_BY_NAME)) {
    for (const model of models) {
      names.add(model.name);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function expandPreviewAccountRecords(records: AccountRecord[]): AccountRecord[] {
  const requestedCount = readRequestedAccountsPreviewCount();
  const requestedAPIKeyCount = Math.max(records.length, requestedCount - PREVIEW_AUTH_FILES.length);
  if (requestedAPIKeyCount <= records.length) {
    return records;
  }

  return Array.from({ length: requestedAPIKeyCount }, (_, index) => {
    const base = records[index % records.length];
    const cycle = Math.floor(index / records.length);
    if (cycle === 0) {
      return { ...base };
    }
    const id = `${base.id}:preview-${cycle}`;
    const provider = String(base.provider || 'preview').trim() || 'preview';
    return {
      ...base,
      id,
      displayName: `${base.displayName || provider} #${cycle + 1}`,
      priority: typeof base.priority === 'number' ? base.priority : index % 10,
      quotaKey: base.quotaKey ? `${base.quotaKey}:preview-${cycle}` : id,
      apiKey: base.apiKey ? `${base.apiKey}-${cycle}` : base.apiKey,
      keySuffix: `${cycle}`.padStart(4, '0').slice(-4),
    };
  });
}

function readRequestedAccountsPreviewCount() {
  if (typeof window === 'undefined') {
    return 0;
  }
  try {
    const value = new URL(window.location.href).searchParams.get(ACCOUNTS_PREVIEW_COUNT_QUERY_PARAM);
    const count = Number(value);
    if (!Number.isFinite(count)) {
      return 0;
    }
    return Math.max(0, Math.min(5000, Math.floor(count)));
  } catch {
    return 0;
  }
}

function createHighVolumePreviewQuotaState(account: AccountRecord, index: number): CodexQuotaState {
  const remainingPercent = 25 + (index % 70);
  return {
    status: 'success',
    quota: previewQuota({
      planType: account.planType || (index % 5 === 0 ? 'PLUS' : 'PRO'),
      billing:
        index % 4 === 0
          ? {
              isAvailable: true,
              balanceInfos: [
                {
                  currency: 'USD',
                  totalBalance: '100.00',
                  grantedBalance: '80.00',
                  toppedUpBalance: '20.00',
                },
              ],
            }
          : undefined,
      windows: [
        {
          id: 'five-hour',
          label: '5H',
          remainingPercent,
          resetLabel: '2026-05-15 18:30',
          resetAtUnix: 1747305000 + index * 60,
        },
        {
          id: 'weekly',
          label: '7D',
          remainingPercent: Math.min(99, remainingPercent + 8),
          resetLabel: '2026-05-21 12:00',
          resetAtUnix: 1747800000 + index * 60,
        },
      ],
    }),
  };
}

export function getAccountsPreviewAuthFileContent(name: string): string {
  return (
    PREVIEW_AUTH_FILE_CONTENT_BY_NAME[name] ??
    JSON.stringify(
      {
        email: `${name.replace(/\.json$/i, '')}@example.com`,
        account_key: `auth-file:${name}`,
        refresh_token: '[PREVIEW_REFRESH_TOKEN]',
      },
      null,
      2,
    )
  );
}

export function getAccountsPreviewAuthFileModels(name: string): Array<{ name: string; display_name?: string }> {
  const models = PREVIEW_AUTH_FILE_MODELS_BY_NAME[name] ?? PREVIEW_AUTH_FILE_MODELS_BY_NAME['codex-pro.json'];
  return models.map((model) => ({ ...model }));
}

export function getUsageDeskPreviewObservedUsage(workspace: 'codex' | 'claude' = 'codex') {
  if (workspace === 'claude') {
    return {
      items: [
        previewObservedUsageItem({
          accountKey: 'openai-compatible:anthropic-relay',
          attributionKey: 'provider:anthropic',
          provider: 'anthropic',
          requestedModels: ['claude-sonnet-4-6', 'claude-opus-4-7'],
          buckets: [
            previewObservedBucket({ daysAgo: 6, hour: 10, requestCount: 11, failedCount: 0, totalTokens: 126000 }),
            previewObservedBucket({ daysAgo: 5, hour: 15, requestCount: 8, failedCount: 1, totalTokens: 94000 }),
            previewObservedBucket({ daysAgo: 4, hour: 11, requestCount: 13, failedCount: 0, totalTokens: 138000 }),
            previewObservedBucket({ daysAgo: 3, hour: 16, requestCount: 9, failedCount: 0, totalTokens: 87000 }),
            previewObservedBucket({ daysAgo: 2, hour: 13, requestCount: 7, failedCount: 0, totalTokens: 76000 }),
            previewObservedBucket({ daysAgo: 1, hour: 18, requestCount: 6, failedCount: 1, totalTokens: 69000 }),
            previewObservedBucket({ daysAgo: 0, hour: 9, requestCount: 5, failedCount: 0, totalTokens: 58000 }),
          ],
        }),
      ],
      unresolved: [],
    };
  }

  return {
    items: [
      previewObservedUsageItem({
        accountKey: 'codex-api-key:stable-001',
        attributionKey: 'auth-id:preview-stable-001',
        provider: 'codex',
        requestedModels: ['gpt-5.4', 'gpt-5.2'],
        buckets: [
          previewObservedBucket({ daysAgo: 6, hour: 11, requestCount: 18, failedCount: 1, totalTokens: 148000 }),
          previewObservedBucket({ daysAgo: 5, hour: 10, requestCount: 21, failedCount: 0, totalTokens: 166000 }),
          previewObservedBucket({ daysAgo: 4, hour: 15, requestCount: 14, failedCount: 1, totalTokens: 109000 }),
          previewObservedBucket({ daysAgo: 3, hour: 13, requestCount: 16, failedCount: 0, totalTokens: 132000 }),
          previewObservedBucket({ daysAgo: 2, hour: 17, requestCount: 12, failedCount: 0, totalTokens: 97000 }),
          previewObservedBucket({ daysAgo: 1, hour: 14, requestCount: 9, failedCount: 1, totalTokens: 82000 }),
          previewObservedBucket({ daysAgo: 0, hour: 10, requestCount: 6, failedCount: 0, totalTokens: 53000 }),
        ],
      }),
      previewObservedUsageItem({
        accountKey: 'auth-file:codex-pro.json',
        attributionKey: 'auth-file:codex-pro.json',
        provider: 'codex',
        requestedModels: ['gpt-5.4-mini'],
        buckets: [
          previewObservedBucket({ daysAgo: 6, hour: 16, requestCount: 8, failedCount: 0, totalTokens: 61000 }),
          previewObservedBucket({ daysAgo: 5, hour: 11, requestCount: 7, failedCount: 0, totalTokens: 54000 }),
          previewObservedBucket({ daysAgo: 4, hour: 9, requestCount: 11, failedCount: 1, totalTokens: 73000 }),
          previewObservedBucket({ daysAgo: 3, hour: 18, requestCount: 6, failedCount: 0, totalTokens: 47000 }),
          previewObservedBucket({ daysAgo: 2, hour: 10, requestCount: 9, failedCount: 0, totalTokens: 65000 }),
          previewObservedBucket({ daysAgo: 1, hour: 12, requestCount: 5, failedCount: 1, totalTokens: 33000 }),
          previewObservedBucket({ daysAgo: 0, hour: 9, requestCount: 4, failedCount: 0, totalTokens: 28000 }),
        ],
      }),
      previewObservedUsageItem({
        accountKey: 'openai-compatible:deepseek',
        attributionKey: 'provider:deepseek',
        provider: 'deepseek',
        requestedModels: ['deepseek-v4-flash'],
        buckets: [
          previewObservedBucket({ daysAgo: 6, hour: 19, requestCount: 5, failedCount: 0, totalTokens: 44000 }),
          previewObservedBucket({ daysAgo: 4, hour: 20, requestCount: 8, failedCount: 0, totalTokens: 62000 }),
          previewObservedBucket({ daysAgo: 2, hour: 15, requestCount: 7, failedCount: 0, totalTokens: 51000 }),
          previewObservedBucket({ daysAgo: 0, hour: 16, requestCount: 10, failedCount: 0, totalTokens: 76000 }),
        ],
      }),
    ],
    unresolved: [
      previewObservedUsageItem({
        accountKey: '',
        attributionKey: 'auth-id:preview-unresolved-001',
        provider: 'codex',
        requestedModels: ['gpt-5.4-mini'],
        buckets: [
          previewObservedBucket({ daysAgo: 1, hour: 19, requestCount: 2, failedCount: 1, totalTokens: 12000 }),
          previewObservedBucket({ daysAgo: 0, hour: 19, requestCount: 1, failedCount: 1, totalTokens: 8000 }),
        ],
      }),
    ],
  };
}

export function getUsageDeskPreviewProjectedUsage(workspace: 'codex' | 'claude' = 'codex') {
  if (workspace === 'claude') {
    return {
      details: [
        previewProjectedDetail({ provider: 'claude', projectName: 'GetTokens', sessionID: 'projects/-Users-linhey-Desktop-GetTokens/session-a.jsonl', daysAgo: 4, hour: 11, minute: 15, model: 'claude-opus-4-6', inputTokens: 210000, cachedInputTokens: 78000, outputTokens: 18000, requestCount: 2 }),
        previewProjectedDetail({ provider: 'claude', projectName: 'GetTokens', sessionID: 'projects/-Users-linhey-Desktop-GetTokens/session-a.jsonl', daysAgo: 3, hour: 16, minute: 35, model: 'claude-sonnet-4-6', inputTokens: 180000, cachedInputTokens: 64000, outputTokens: 16000, requestCount: 2 }),
        previewProjectedDetail({ provider: 'claude', projectName: 'CLIProxyAPI', sessionID: 'projects/-Users-linhey-Desktop-CLIProxyAPI/session-b.jsonl', daysAgo: 1, hour: 18, minute: 20, model: 'claude-sonnet-4-6', inputTokens: 96000, cachedInputTokens: 42000, outputTokens: 9000, requestCount: 1 }),
        previewProjectedDetail({ provider: 'claude', projectName: 'GetTokens', sessionID: 'projects/-Users-linhey-Desktop-GetTokens/session-c.jsonl', daysAgo: 0, hour: 9, minute: 45, model: 'claude-haiku-4-5', inputTokens: 62000, cachedInputTokens: 18000, outputTokens: 6000, requestCount: 1 }),
      ],
      scannedFiles: 18,
      cacheHitFiles: 0,
      deltaAppendFiles: 0,
      fullRebuildFiles: 18,
      fileMissingFiles: 0,
    };
  }

  return {
    details: [
      previewProjectedDetail({ daysAgo: 6, hour: 11, minute: 20, model: 'gpt-5-codex', inputTokens: 420000, cachedInputTokens: 80000, outputTokens: 26000, requestCount: 3 }),
      previewProjectedDetail({ daysAgo: 5, hour: 10, minute: 30, model: 'gpt-5-codex', inputTokens: 390000, cachedInputTokens: 72000, outputTokens: 24000, requestCount: 3 }),
      previewProjectedDetail({ daysAgo: 4, hour: 15, minute: 5, model: 'o3', inputTokens: 210000, cachedInputTokens: 31000, outputTokens: 15000, requestCount: 2 }),
      previewProjectedDetail({ daysAgo: 3, hour: 13, minute: 45, model: 'gpt-5-codex', inputTokens: 330000, cachedInputTokens: 64000, outputTokens: 22000, requestCount: 2 }),
      previewProjectedDetail({ daysAgo: 2, hour: 17, minute: 10, model: 'gpt-5-codex', inputTokens: 280000, cachedInputTokens: 51000, outputTokens: 18000, requestCount: 2 }),
      previewProjectedDetail({ daysAgo: 1, hour: 14, minute: 20, model: 'gpt-5-codex', inputTokens: 160000, cachedInputTokens: 28000, outputTokens: 12000, requestCount: 1 }),
      previewProjectedDetail({ daysAgo: 0, hour: 10, minute: 5, model: 'gpt-5-codex', inputTokens: 90000, cachedInputTokens: 14000, outputTokens: 7000, requestCount: 1 }),
      previewProjectedDetail({ daysAgo: 0, hour: 10, minute: 20, model: 'gpt-5-codex', inputTokens: 110000, cachedInputTokens: 22000, outputTokens: 9000, requestCount: 1 }),
    ],
    scannedFiles: 48,
    cacheHitFiles: 29,
    deltaAppendFiles: 12,
    fullRebuildFiles: 5,
    fileMissingFiles: 2,
  };
}

function createUsageSummary(input: {
  id: string;
  provider: string;
  attributionKey: string;
  requestCount: number;
  failedCount: number;
  latency: number;
  totalTokens: number[];
  requestedModels: string[];
  lastActivityOffsetMs: number;
  source?: 'none' | 'legacy' | 'attribution';
}): AccountUsageSummary {
  const requestCount = Math.max(0, input.requestCount);
  const failure = Math.max(0, Math.min(requestCount, input.failedCount));
  const success = Math.max(0, requestCount - failure);
  const trafficBuckets = input.totalTokens.map((totalTokens, index) => {
    const requestShare = Math.max(1, Math.round(requestCount / Math.max(1, input.totalTokens.length)));
    const failedShare = failure === 0 ? 0 : Math.min(requestShare, Math.round(failure / Math.max(1, input.totalTokens.length)));
    const start = new Date(NOW_MS - (input.totalTokens.length - index) * 3 * 60 * 60 * 1000).toISOString();
    const cachedInputTokens = Math.round(totalTokens * 0.18);
    const inputTokens = Math.round(totalTokens * 0.44);
    const outputTokens = Math.max(0, totalTokens - cachedInputTokens - inputTokens);
    return {
      start,
      requestCount: requestShare,
      failedCount: failedShare,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      totalTokens,
    };
  });
  const totalTokens = trafficBuckets.reduce((sum, bucket) => sum + bucket.totalTokens, 0);
  const cachedInputTokens = trafficBuckets.reduce((sum, bucket) => sum + bucket.cachedInputTokens, 0);
  const inputTokens = trafficBuckets.reduce((sum, bucket) => sum + bucket.inputTokens, 0);
  const outputTokens = trafficBuckets.reduce((sum, bucket) => sum + bucket.outputTokens, 0);

  return {
    source: input.source || 'attribution',
    hasData: requestCount > 0,
    requestCount,
    failedCount: failure,
    success,
    failure,
    successRate: requestCount > 0 ? (success / requestCount) * 100 : null,
    averageLatencyMs: input.latency > 0 ? input.latency : null,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    lastActivityAt: input.lastActivityOffsetMs > 0 ? NOW_MS - input.lastActivityOffsetMs : null,
    attributionKey: input.attributionKey,
    attributionKind: 'account',
    provider: input.provider,
    requestedModels: [...input.requestedModels],
    trafficBuckets,
    statusBar: {
      blocks: Array.from({ length: 20 }, (_, index) => {
        if (requestCount === 0) return 'idle';
        if (index < 2 && failure > 0) return 'failure';
        if (index < 8) return 'success';
        return 'idle';
      }),
      blockDetails: Array.from({ length: 20 }, (_, index) => ({
        success: index < 8 ? Math.max(0, Math.round(success / 8)) : 0,
        failure: index < 2 ? Math.max(0, Math.round(failure / 2)) : 0,
        rate: requestCount > 0 ? success / requestCount : -1,
        startTime: NOW_MS - (20 - index) * 10 * 60 * 1000,
        endTime: NOW_MS - (19 - index) * 10 * 60 * 1000,
      })),
      successRate: requestCount > 0 ? Math.round((success / requestCount) * 100) : 100,
      totalSuccess: success,
      totalFailure: failure,
    },
  };
}

function createFallbackUsageSummary(
  account: Pick<AccountRecord, 'id'> & Partial<Pick<AccountRecord, 'provider'>>,
): AccountUsageSummary {
  const provider = String(account.provider || inferProviderFromPreviewID(account.id)).trim() || 'unknown';
  const seed = hashPreviewID(account.id);
  const requestCount = 8 + (seed % 54);
  const failedCount = seed % 5;
  const latency = 520 + (seed % 900);
  const totalTokens = Array.from({ length: 8 }, (_, index) => 6000 + ((seed + index * 7919) % 48000));
  return createUsageSummary({
    id: account.id,
    provider,
    attributionKey: account.id,
    requestCount,
    failedCount,
    latency,
    totalTokens,
    requestedModels: previewModelsForProvider(provider),
    lastActivityOffsetMs: (5 + (seed % 95)) * 60 * 1000,
  });
}

function inferProviderFromPreviewID(id: string) {
  return 'unknown';
}

function previewModelsForProvider(provider: string) {
  switch (provider) {
    case 'deepseek':
      return ['deepseek-v4-flash', 'deepseek-v4-pro'];
    case 'siliconflow':
      return ['deepseek-ai/DeepSeek-V3.2'];
    case 'zhipu':
      return ['glm-5'];
    case 'moonshot':
      return ['kimi-k2.5'];
    case 'dashscope':
      return ['qwen3.5-plus'];
    case 'openrouter':
      return ['openai/gpt-5.4-mini'];
    case 'groq':
      return ['llama3-70b-8192'];
    case 'together':
      return ['google/gemma-2-27b-it'];
    case 'doubao':
      return ['doubao-seed-1-8-251228'];
    case 'claude':
      return ['claude-sonnet-4-6'];
    case 'gemini':
      return ['gemini-2.5-pro'];
    default:
      return ['gpt-5.4-mini'];
  }
}

function hashPreviewID(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function cloneQuotaState(state: CodexQuotaState): CodexQuotaState {
  if (state.status !== 'success' || !state.quota) {
    return { ...state };
  }
  return {
    status: state.status,
    quota: previewQuota({
      ...state.quota,
      windows: (state.quota.windows || []).map((window) => ({ ...window })),
    }),
  };
}

function cloneUsageSummary(summary: AccountUsageSummary): AccountUsageSummary {
  return {
    ...summary,
    requestedModels: [...summary.requestedModels],
    trafficBuckets: summary.trafficBuckets.map((bucket) => ({ ...bucket })),
    statusBar: {
      ...summary.statusBar,
      blocks: [...summary.statusBar.blocks],
      blockDetails: summary.statusBar.blockDetails.map((detail) => ({ ...detail })),
    },
  };
}

function cloneRateLimitState(state: RateLimitState): RateLimitState {
  return {
    ...state,
    rules: state.rules.map((ruleState) => ({
      ...ruleState,
      rule: { ...ruleState.rule },
    })),
  };
}

function previewRateLimitState(input: {
  accountKey: string;
  blocked?: boolean;
  blockReason?: string;
  updatedAt: string;
  rules: Array<{
    id: string;
    strategy: string;
    window: string;
    limitValue: number;
    currentUsage: number;
    usagePct: number;
    exceeded?: boolean;
    reason?: string;
  }>;
}): RateLimitState {
  return {
    accountKey: input.accountKey,
    blocked: Boolean(input.blocked),
    blockReason: input.blockReason || '',
    updatedAt: input.updatedAt,
    rules: input.rules.map((rule) => ({
      exceeded: Boolean(rule.exceeded),
      reason: rule.reason || '',
      usagePct: rule.usagePct,
      currentUsage: rule.currentUsage,
      rule: {
        id: rule.id,
        accountKey: input.accountKey,
        strategy: rule.strategy,
        window: rule.window,
        limitValue: rule.limitValue,
        action: 'block',
        enabled: true,
        label: '',
      },
    })),
  };
}

function previewObservedUsageItem(input: {
  accountKey: string;
  attributionKey: string;
  provider: string;
  requestedModels: string[];
  buckets: Array<{
    start: string;
    requestCount: number;
    failedCount: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>;
}) {
  return {
    accountKey: input.accountKey,
    attributionKey: input.attributionKey,
    provider: input.provider,
    requestedModels: [...input.requestedModels],
    requestCount: input.buckets.reduce((sum, bucket) => sum + bucket.requestCount, 0),
    failedCount: input.buckets.reduce((sum, bucket) => sum + bucket.failedCount, 0),
    inputTokens: input.buckets.reduce((sum, bucket) => sum + bucket.inputTokens, 0),
    cachedInputTokens: input.buckets.reduce((sum, bucket) => sum + bucket.cachedInputTokens, 0),
    outputTokens: input.buckets.reduce((sum, bucket) => sum + bucket.outputTokens, 0),
    totalTokens: input.buckets.reduce((sum, bucket) => sum + bucket.totalTokens, 0),
    lastActivityAt: input.buckets[input.buckets.length - 1]?.start,
    buckets: input.buckets.map((bucket) => ({ ...bucket })),
  };
}

function previewObservedBucket(input: {
  daysAgo: number;
  hour: number;
  requestCount: number;
  failedCount: number;
  totalTokens: number;
}) {
  const start = new Date(NOW_MS - input.daysAgo * 24 * 60 * 60 * 1000);
  start.setHours(input.hour, 0, 0, 0);
  const cachedInputTokens = Math.round(input.totalTokens * 0.16);
  const inputTokens = Math.round(input.totalTokens * 0.51);
  const outputTokens = Math.max(0, input.totalTokens - cachedInputTokens - inputTokens);
  return {
    start: start.toISOString(),
    requestCount: input.requestCount,
    failedCount: input.failedCount,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens: input.totalTokens,
  };
}

function previewProjectedDetail(input: {
  provider?: 'codex' | 'claude';
  daysAgo: number;
  hour: number;
  minute: number;
  model: string;
  sessionID?: string;
  projectName?: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requestCount: number;
}) {
  const timestamp = new Date(NOW_MS - input.daysAgo * 24 * 60 * 60 * 1000);
  timestamp.setHours(input.hour, input.minute, 0, 0);
  return {
    timestamp: timestamp.toISOString(),
    provider: input.provider ?? 'codex',
    sourceKind: 'local_projected',
    sessionID: input.sessionID ?? `sessions/2026/05/preview-${input.daysAgo}-${input.hour}-${input.minute}.jsonl`,
    projectName: input.projectName ?? 'GetTokens',
    model: input.model,
    inputTokens: input.inputTokens,
    cachedInputTokens: input.cachedInputTokens,
    outputTokens: input.outputTokens,
    requestCount: input.requestCount,
  };
}

function previewProvider(input: Omit<OpenAICompatibleProvider, 'convertValues'>): OpenAICompatibleProvider {
  const name = String(input.name || '').trim();
  return {
    accountKey: name ? `acct_${name}` : '',
    ...input,
    convertValues(value: unknown) {
      return value;
    },
  } as OpenAICompatibleProvider;
}

function previewQuota(input: {
  planType?: string;
  billing?: {
    isAvailable: boolean;
    balanceInfos: Array<{
      currency: string;
      totalBalance: string;
      grantedBalance: string;
      toppedUpBalance: string;
    }>;
  };
  windows: Array<{
    id: string;
    label: string;
    remainingPercent?: number;
    resetLabel: string;
    resetAtUnix?: number;
  }>;
}): NonNullable<CodexQuotaState['quota']> {
  return {
    ...input,
    billing: input.billing
      ? {
          ...input.billing,
          balanceInfos: input.billing.balanceInfos.map((item) => ({ ...item })),
        }
      : undefined,
    windows: input.windows.map((window) => ({ ...window })),
    convertValues(value: unknown) {
      return value;
    },
  } as unknown as NonNullable<CodexQuotaState['quota']>;
}
