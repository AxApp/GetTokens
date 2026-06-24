import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import {
  buildProviderConfigSignature,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderFormState,
  type ProviderRemoteModelsState,
  type ProviderVerifyState,
} from '../model/openAICompatible';
import OpenAICompatibleComposeModal from './OpenAICompatibleComposeModal';
import OpenAICompatibleProviderCard from './OpenAICompatibleProviderCard';
import OpenAICompatibleWorkspace from './OpenAICompatibleWorkspace';

const meta = {
  title: 'Design System/业务组件/OpenAI 兼容',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ModalViewport({ children, label }: { children: ReactNode; label: string }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="relative h-[34rem] min-w-0 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-panel)] [transform:translateZ(0)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

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

const composeForms: Record<'empty' | 'preset' | 'error', OpenAICompatibleProviderFormState> = {
  empty: {
    name: '',
    baseUrl: '',
    apiKey: '',
  },
  preset: {
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-preview-deepseek',
  },
  error: {
    name: 'custom-router',
    baseUrl: 'https://router.internal/v1',
    apiKey: '',
  },
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

function signedVerifyState(providerKey: keyof typeof providers): ProviderVerifyState {
  return {
    ...verifyStates[providerKey],
    configSignature: buildProviderConfigSignature(providers[providerKey]),
  };
}

function signedRemoteModelsState(
  providerKey: keyof typeof providers,
): ProviderRemoteModelsState {
  const models = (providers[providerKey].models || []).map((model) => ({
    name: model.name,
    alias: model.alias || '',
  }));
  return {
    status: models.length > 0 ? 'success' : 'idle',
    message: models.length > 0 ? 'remote model cache ready' : '',
    models,
    lastFetchedAt: models.length > 0 ? 1779145200000 : null,
    configSignature: buildProviderConfigSignature(providers[providerKey]),
  };
}

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
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">OpenAI 兼容</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          把 OpenAI-compatible provider 卡片纳入设计系统，用固定 provider、验证结果、usage 和限流 mock 覆盖可用、错误、禁用、空模型、pending 和限流状态。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Provider card states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <ProviderCardSample label="DS-READY" />
          <ProviderCardSample label="DS-ERROR" providerKey="error" />
          <ProviderCardSample label="DS-DISABLED" providerKey="disabled" />
          <ProviderCardSample label="DS-PENDING" pendingDelete pendingStatus />
          <ProviderCardSample label="DS-RATE" rateLimitStatus={rateLimitBlocked} />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Workspace states</h3>
        <div className="grid gap-4">
          <WorkspaceSample label="DS-WORKSPACE-GRID" />
          <div className="grid gap-4 xl:grid-cols-3">
            <WorkspaceSample label="DS-WORKSPACE-LOADING" ready={false} loading />
            <WorkspaceSample label="DS-WORKSPACE-EMPTY" providers={[]} />
            <WorkspaceSample label="DS-WORKSPACE-EMBEDDED" embedded />
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Compose modal states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <ComposeModalSample label="DS-COMPOSE-EMPTY" formKey="empty" />
          <ComposeModalSample label="DS-COMPOSE-PRESET" formKey="preset" selectedPresetID="deepseek" />
          <ComposeModalSample label="DS-COMPOSE-ERROR" formKey="error" error="API KEY 不能为空" />
        </div>
      </section>
    </div>
  );
}

function ComposeModalSample({
  label,
  formKey,
  selectedPresetID = '',
  error = '',
}: {
  label: string;
  formKey: keyof typeof composeForms;
  selectedPresetID?: string;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <ModalViewport label={label}>
      <OpenAICompatibleComposeModal
        t={t}
        form={composeForms[formKey]}
        selectedPresetID={selectedPresetID}
        error={error}
        onClose={() => undefined}
        onChange={() => undefined}
        onPresetChange={() => undefined}
        onSubmit={() => undefined}
      />
    </ModalViewport>
  );
}

function WorkspaceSample({
  label,
  ready = true,
  loading = false,
  providers: sampleProviders = [providers.verified, providers.error, providers.disabled],
  embedded = false,
}: {
  label: string;
  ready?: boolean;
  loading?: boolean;
  providers?: OpenAICompatibleProvider[];
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const verifyStatesByName: Record<string, ProviderVerifyState> = {
    [providers.verified.name]: signedVerifyState('verified'),
    [providers.error.name]: signedVerifyState('error'),
    [providers.disabled.name]: signedVerifyState('disabled'),
  };
  const remoteModelsStatesByName: Record<string, ProviderRemoteModelsState> = {
    [providers.verified.name]: signedRemoteModelsState('verified'),
    [providers.error.name]: signedRemoteModelsState('error'),
    [providers.disabled.name]: signedRemoteModelsState('disabled'),
  };

  return (
    <DesignSystemStoryFrame label={label}>
      <div className={embedded ? 'max-h-[44rem] overflow-auto bg-[var(--gt-surface-panel)] p-5' : 'h-[44rem] overflow-hidden'}>
        <OpenAICompatibleWorkspace
          t={t}
          ready={ready}
          loading={loading}
          providers={sampleProviders}
          verifyStates={verifyStatesByName}
          remoteModelsStates={remoteModelsStatesByName}
          pendingDeleteName={providers.verified.name}
          pendingStatusName={providers.verified.name}
          accountUsageByID={{
            [`openai-compatible:${providers.verified.name}`]: usageSummary,
          }}
          accountRateLimitByID={{
            [`openai-compatible:${providers.error.name}`]: rateLimitBlocked,
          }}
          onCreate={() => undefined}
          onRefresh={() => undefined}
          onOpenDetail={() => undefined}
          onDelete={() => undefined}
          onToggleDisabled={() => undefined}
          embedded={embedded}
        />
      </div>
    </DesignSystemStoryFrame>
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

export const Workspace: Story = {
  render: () => <WorkspaceSample label="DS-WORKSPACE-GRID" />,
};

export const Compose: Story = {
  render: () => <ComposeModalSample label="DS-COMPOSE-PRESET" formKey="preset" selectedPresetID="deepseek" />,
};
