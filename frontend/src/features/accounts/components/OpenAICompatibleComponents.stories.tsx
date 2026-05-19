import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import {
  buildProviderConfigSignature,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderDraft,
  type OpenAICompatibleProviderFormState,
  type ProviderRemoteModelsState,
  type ProviderVerifyState,
} from '../model/openAICompatible';
import OpenAICompatibleComposeModal from './OpenAICompatibleComposeModal';
import OpenAICompatibleDetailModal from './OpenAICompatibleDetailModal';
import OpenAICompatibleDetailPanel from './OpenAICompatibleDetailPanel';
import OpenAICompatibleProviderCard from './OpenAICompatibleProviderCard';
import OpenAICompatibleWorkspace from './OpenAICompatibleWorkspace';
import type { RateLimitRulesAPI } from './RateLimitRulesSection';

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
      <div className="relative h-[34rem] min-w-0 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)] [transform:translateZ(0)]">
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

const detailDrafts: Record<'ready' | 'error', OpenAICompatibleProviderDraft> = {
  ready: {
    currentName: providers.verified.name,
    name: providers.verified.name,
    baseUrl: providers.verified.baseUrl,
    apiKey: providers.verified.apiKey,
    headersText: 'HTTP-Referer: https://gettokens.local\nX-Title: GetTokens',
    models: (providers.verified.models || []).map((model) => ({ name: model.name, alias: model.alias || '' })),
    verifyModel: providers.verified.models?.[0]?.name || '',
    proxyUrl: providers.verified.proxyUrl || '',
  },
  error: {
    currentName: providers.error.name,
    name: providers.error.name,
    baseUrl: providers.error.baseUrl,
    apiKey: '',
    headersText: '',
    models: (providers.error.models || [{ name: '', alias: '' }]).map((model) => ({ name: model.name, alias: model.alias || '' })),
    verifyModel: providers.error.models?.[0]?.name || '',
    proxyUrl: '',
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

const rateLimitRulesAPI: RateLimitRulesAPI = {
  list: async () => rateLimitBlocked.rules.map((item) => item.rule),
  create: async (rule) => [...rateLimitBlocked.rules.map((item) => item.rule), { ...rule, id: 'created-rule' }],
  update: async (rule) => rateLimitBlocked.rules.map((item) => (item.rule.id === rule.id ? rule : item.rule)),
  delete: async () => undefined,
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
        <h2 className="text-2xl font-black uppercase italic tracking-normal">OpenAI 兼容</h2>
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

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Workspace states</h3>
        <div className="grid gap-4">
          <WorkspaceSample label="DS-WORKSPACE-GRID" />
          <div className="grid gap-4 xl:grid-cols-3">
            <WorkspaceSample label="DS-WORKSPACE-LOADING" ready={false} loading />
            <WorkspaceSample label="DS-WORKSPACE-EMPTY" providers={[]} />
            <WorkspaceSample label="DS-WORKSPACE-EMBEDDED" embedded />
          </div>
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Detail panel states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <DetailPanelSample label="DS-DETAIL-READY" draftKey="ready" remoteState={signedRemoteModelsState('verified')} />
          <DetailPanelSample label="DS-DETAIL-ERROR" draftKey="error" error="API KEY 不能为空" />
          <DetailPanelSample label="DS-DETAIL-FETCHING" draftKey="ready" remoteState={loadingRemoteModelsState} />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Detail modal state</h3>
        <DetailModalSample label="DS-DETAIL-MODAL-RATE-LIMIT" />
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Compose modal states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <ComposeModalSample label="DS-COMPOSE-EMPTY" formKey="empty" />
          <ComposeModalSample label="DS-COMPOSE-PRESET" formKey="preset" selectedPresetID="deepseek" />
          <ComposeModalSample label="DS-COMPOSE-ERROR" formKey="error" error="API KEY 不能为空" />
        </div>
      </section>
    </div>
  );
}

const loadingRemoteModelsState: ProviderRemoteModelsState = {
  status: 'loading',
  message: 'fetching remote models',
  models: [],
  lastFetchedAt: null,
  configSignature: buildProviderConfigSignature(providers.verified),
};

function DetailModalSample({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <ModalViewport label={label}>
      <OpenAICompatibleDetailModal
        t={t}
        draft={detailDrafts.ready}
        verifyState={signedVerifyState('verified')}
        remoteModelsState={signedRemoteModelsState('verified')}
        rateLimitStatus={rateLimitBlocked}
        rateLimitRulesAPI={rateLimitRulesAPI}
        error=""
        saving={false}
        onClose={() => undefined}
        onChange={() => undefined}
        onSave={() => undefined}
        onVerify={() => undefined}
        onFetchModels={() => undefined}
        onApplyFetchedModels={() => undefined}
        onRateLimitRulesChanged={() => undefined}
      />
    </ModalViewport>
  );
}

function DetailPanelSample({
  label,
  draftKey,
  remoteState,
  error = '',
}: {
  label: string;
  draftKey: keyof typeof detailDrafts;
  remoteState?: ProviderRemoteModelsState;
  error?: string;
}) {
  const { t } = useI18n();
  const draft = detailDrafts[draftKey];
  return (
    <ModalViewport label={label}>
      <div className="flex h-full flex-col bg-[var(--bg-main)]">
        <OpenAICompatibleDetailPanel
          t={t}
          draft={draft}
          verifyState={draftKey === 'error' ? signedVerifyState('error') : signedVerifyState('verified')}
          remoteModelsState={remoteState}
          error={error}
          saving={remoteState?.status === 'loading'}
          onClose={() => undefined}
          onChange={() => undefined}
          onSave={() => undefined}
          onVerify={() => undefined}
          onFetchModels={() => undefined}
          onApplyFetchedModels={() => undefined}
        />
      </div>
    </ModalViewport>
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
      <div className={embedded ? 'max-h-[44rem] overflow-auto bg-[var(--bg-surface)] p-5' : 'h-[44rem] overflow-hidden'}>
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

export const DetailPanel: Story = {
  render: () => <DetailPanelSample label="DS-DETAIL-READY" draftKey="ready" remoteState={signedRemoteModelsState('verified')} />,
};

export const DetailModal: Story = {
  render: () => <DetailModalSample label="DS-DETAIL-MODAL-RATE-LIMIT" />,
};
