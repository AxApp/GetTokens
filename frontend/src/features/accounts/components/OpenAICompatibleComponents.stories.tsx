import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { OpenAICompatibleProvider, ProviderVerifyState } from '../model/openAICompatible';
import OpenAICompatibleProviderCard from './OpenAICompatibleProviderCard';

const meta = {
  title: 'Design System/Feature Components/OpenAI Compatible',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function provider(input: Omit<OpenAICompatibleProvider, 'convertValues'>): OpenAICompatibleProvider {
  return {
    ...input,
    convertValues(value: unknown) {
      return value;
    },
  } as OpenAICompatibleProvider;
}

const providers = {
  verified: provider({
    name: 'deepseek-prod',
    priority: 30,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-preview-deepseek-prod',
    proxyUrl: 'socks5://127.0.0.1:7890',
    keyCount: 2,
    modelCount: 4,
    hasHeaders: true,
    models: [
      { name: 'deepseek-chat', alias: 'codex-deepseek' },
      { name: 'deepseek-reasoner', alias: 'codex-reasoner' },
      { name: 'deepseek-coder', alias: 'coder-fast' },
    ],
  }),
  error: provider({
    name: 'openrouter-edge',
    priority: 20,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-preview-openrouter',
    keyCount: 1,
    modelCount: 2,
    models: [
      { name: 'openai/gpt-5.4-mini', alias: 'gpt-fast' },
      { name: 'moonshotai/kimi-k2', alias: 'kimi' },
    ],
  }),
  disabled: provider({
    name: 'disabled-relay',
    priority: 10,
    disabled: true,
    baseUrl: 'https://relay.internal/v1',
    apiKey: 'sk-preview-disabled-relay',
    keyCount: 1,
    modelCount: 0,
    models: [],
  }),
};

const verifyStates: Record<keyof typeof providers, ProviderVerifyState> = {
  verified: {
    model: 'deepseek-chat',
    status: 'success',
    message: 'HTTP 200 · chat completion ready',
    lastVerifiedAt: 1779145200000,
  },
  error: {
    model: 'openai/gpt-5.4-mini',
    status: 'error',
    message: 'HTTP 401 · invalid upstream key',
    lastVerifiedAt: 1779141600000,
  },
  disabled: {
    model: '',
    status: 'idle',
    message: '',
    lastVerifiedAt: null,
  },
};

const usageSummary: AccountUsageSummary = {
  source: 'attribution',
  hasData: true,
  requestCount: 1864,
  failedCount: 18,
  success: 1846,
  failure: 18,
  successRate: 99,
  averageLatencyMs: 236,
  inputTokens: 1104000,
  cachedInputTokens: 308000,
  outputTokens: 276000,
  totalTokens: 1380000,
  lastActivityAt: 1779145200000,
  attributionKey: 'openai-compatible:deepseek-prod',
  attributionKind: 'openai-compatible',
  provider: 'deepseek-prod',
  requestedModels: ['deepseek-chat', 'deepseek-reasoner'],
  trafficBuckets: [],
  statusBar: {
    blocks: ['success', 'success', 'mixed', 'success', 'success', 'failure', 'idle'],
    blockDetails: [
      { success: 18, failure: 0, rate: 1, startTime: 0, endTime: 1 },
      { success: 22, failure: 0, rate: 1, startTime: 1, endTime: 2 },
      { success: 14, failure: 2, rate: 0.875, startTime: 2, endTime: 3 },
      { success: 28, failure: 0, rate: 1, startTime: 3, endTime: 4 },
      { success: 31, failure: 0, rate: 1, startTime: 4, endTime: 5 },
      { success: 0, failure: 5, rate: 0, startTime: 5, endTime: 6 },
      { success: 0, failure: 0, rate: -1, startTime: 6, endTime: 7 },
    ],
    successRate: 99,
    totalSuccess: 1846,
    totalFailure: 18,
  },
};

const rateLimitBlocked: RateLimitState = {
  accountKey: 'openai-compatible:deepseek-prod',
  blocked: true,
  blockReason: 'REQ 1H',
  rules: [
    {
      exceeded: true,
      usagePct: 106,
      currentUsage: 1060,
      rule: {
        id: 'req-1h',
        accountKey: 'openai-compatible:deepseek-prod',
        strategy: 'request-window',
        window: '1h',
        limitValue: 1000,
        action: 'block',
        enabled: true,
      },
    },
  ],
};

function ProviderCardSample({
  providerKey = 'verified',
  label,
  pendingDelete = false,
  pendingStatus = false,
  rateLimitStatus,
}: {
  providerKey?: keyof typeof providers;
  label: string;
  pendingDelete?: boolean;
  pendingStatus?: boolean;
  rateLimitStatus?: RateLimitState;
}) {
  const { t } = useI18n();
  const item = providers[providerKey];

  return (
    <DesignSystemStoryFrame label={label}>
      <div className="max-w-[28rem]">
        <OpenAICompatibleProviderCard
          t={t}
          provider={item}
          verifyState={verifyStates[providerKey]}
          effectiveModelCount={item.models?.length || item.modelCount || 0}
          usageSummary={providerKey === 'verified' ? usageSummary : undefined}
          rateLimitStatus={rateLimitStatus}
          pendingDelete={pendingDelete}
          pendingStatus={pendingStatus}
          onOpenDetail={() => undefined}
          onDelete={() => undefined}
          onToggleDisabled={() => undefined}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function OpenAICompatibleOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">OpenAI Compatible</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          把 OpenAI-compatible provider 卡片纳入设计系统，用固定 provider、验证结果、usage 和限流 mock 覆盖可用、错误、禁用、空模型、pending 和限流状态。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Provider card states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <ProviderCardSample label="DS-READY" />
          <ProviderCardSample label="DS-ERROR" providerKey="error" />
          <ProviderCardSample label="DS-DISABLED" providerKey="disabled" />
          <ProviderCardSample label="DS-PENDING" pendingDelete pendingStatus />
          <ProviderCardSample label="DS-RATE" rateLimitStatus={rateLimitBlocked} />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <OpenAICompatibleOverview />,
};

export const Ready: Story = {
  render: () => <ProviderCardSample label="DS-READY" />,
};

export const Error: Story = {
  render: () => <ProviderCardSample label="DS-ERROR" providerKey="error" />,
};

export const Disabled: Story = {
  render: () => <ProviderCardSample label="DS-DISABLED" providerKey="disabled" />,
};
