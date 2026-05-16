import type { AccountRecord, AuthFile } from '../../types';
import type { AccountUsageSummary } from './model/accountUsage';
import type { OpenAICompatibleProvider } from './model/openAICompatible';
import type { RateLimitState } from './model/rateLimit';
import type { CodexQuotaState } from './model/types';

const NOW_MS = Date.parse('2026-05-15T14:00:00+08:00');

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
    quotaKey: 'codex-api-key:stable-001',
    quotaEnabled: true,
    quotaCurl: 'curl -s https://api.openai.com/dashboard/billing/usage',
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
    quotaKey: 'codex-api-key:gray-canary',
    quotaEnabled: true,
    quotaCurl: 'curl -s https://api.openai.com/dashboard/billing/usage',
  },
];

const PREVIEW_OPENAI_COMPATIBLE_PROVIDERS: OpenAICompatibleProvider[] = [
  previewProvider({
    name: 'deepseek',
    priority: 10,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-preview-deepseek',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: 'codex-deepseek', name: 'deepseek-chat' },
      { alias: 'codex-reasoner', name: 'deepseek-reasoner' },
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
    requestedModels: ['codex-deepseek'],
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
  return PREVIEW_API_KEY_ACCOUNTS.map((account) => ({ ...account }));
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
  return accounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
    const key = String(account.quotaKey || '').trim();
    if (!key || !PREVIEW_QUOTA_BY_KEY[key]) {
      return result;
    }
    result[key] = cloneQuotaState(PREVIEW_QUOTA_BY_KEY[key]);
    return result;
  }, {});
}

export function getAccountsPreviewUsageByID(accounts: Array<Pick<AccountRecord, 'id'>>): Record<string, AccountUsageSummary> {
  return accounts.reduce<Record<string, AccountUsageSummary>>((result, account) => {
    const summary = PREVIEW_USAGE_BY_ID[account.id];
    if (summary) {
      result[account.id] = cloneUsageSummary(summary);
    }
    return result;
  }, {});
}

export function getAccountsPreviewRateLimitByID(accounts: Array<Pick<AccountRecord, 'id'>>): Record<string, RateLimitState> {
  return accounts.reduce<Record<string, RateLimitState>>((result, account) => {
    const state = PREVIEW_RATE_LIMIT_BY_ID[account.id];
    if (state) {
      result[account.id] = cloneRateLimitState(state);
    }
    return result;
  }, {});
}

export function getUsageDeskPreviewObservedUsage(workspace: 'codex' | 'gemini' = 'codex') {
  if (workspace === 'gemini') {
    return {
      items: [],
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
        requestedModels: ['codex-deepseek'],
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

export function getUsageDeskPreviewProjectedUsage(workspace: 'codex' | 'gemini' = 'codex') {
  if (workspace === 'gemini') {
    return {
      details: [],
      scannedFiles: 0,
      cacheHitFiles: 0,
      deltaAppendFiles: 0,
      fullRebuildFiles: 0,
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
  daysAgo: number;
  hour: number;
  minute: number;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requestCount: number;
}) {
  const timestamp = new Date(NOW_MS - input.daysAgo * 24 * 60 * 60 * 1000);
  timestamp.setHours(input.hour, input.minute, 0, 0);
  return {
    timestamp: timestamp.toISOString(),
    provider: 'codex',
    sourceKind: 'local_projected',
    model: input.model,
    inputTokens: input.inputTokens,
    cachedInputTokens: input.cachedInputTokens,
    outputTokens: input.outputTokens,
    requestCount: input.requestCount,
  };
}

function previewProvider(input: Omit<OpenAICompatibleProvider, 'convertValues'>): OpenAICompatibleProvider {
  return {
    ...input,
    convertValues(value: unknown) {
      return value;
    },
  } as OpenAICompatibleProvider;
}

function previewQuota(input: {
  planType?: string;
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
    windows: input.windows.map((window) => ({ ...window })),
    convertValues(value: unknown) {
      return value;
    },
  } as unknown as NonNullable<CodexQuotaState['quota']>;
}
