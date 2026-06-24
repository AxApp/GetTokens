import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import { useI18n } from '../../../context/I18nContext';
import type { BillingDisplay, CodexQuota } from '../../../types';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { AccountRecord, ApiKeyFormState } from '../model/types';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountDetailFooter,
  AccountDetailHeader,
  AccountQuotaSection,
  type APIKeyVerifyState,
} from './AccountDetailSections';
import {
  AccountDetailBody,
  AccountDetailModuleStack,
} from './AccountDetailPrimitives';
import ApiKeyComposeModal from './ApiKeyComposeModal';
import CodexOAuthModal from './CodexOAuthModal';
import AccountImportModal from './AccountImportModal';
import type { RateLimitRulesAPI } from './RateLimitRulesSection';
import UnifiedComposeModal, { type UnifiedComposeFormState } from './UnifiedComposeModal';
import type { AccountImportPayloadItem } from '../model/accountTransfer';

const meta = {
  title: 'Design System/业务组件/账号弹窗',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ModalViewport({ children, label = 'DS-MODAL' }: { children: ReactNode; label?: string }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="relative h-[32rem] min-w-0 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] [transform:translateZ(0)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function Header({ title = 'Codex Account Detail', eyebrow = 'ACCOUNT DETAIL' }: { title?: string; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-semibold tracking-normal text-[var(--gt-ink-primary)]">
          {title}
        </h3>
      </div>
      <span className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1 font-mono text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]">
        READY
      </span>
    </div>
  );
}

function Body({ long = false }: { long?: boolean }) {
  const rows = long
    ? [
        ['Provider', 'OpenAI'],
        ['Credential source', 'auth-file'],
        ['Email', 'team-codex@example.com'],
        ['Plan', 'Pro'],
        ['Quota window', '5H / 62% remaining'],
        ['Weekly window', '84% remaining'],
        ['Relay route', 'managed local relay'],
        ['Last activity', '2026-05-19 22:40'],
        ['Model aliases', 'gpt-5.2, gpt-5.2-mini, gpt-5.4'],
        ['Health', '99.5% success across current window'],
      ]
    : [
        ['Provider', 'OpenAI'],
        ['Credential source', 'auth-file'],
        ['Quota window', '5H / 62% remaining'],
      ];

  return (
    <div className="grid gap-4 p-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4">
          <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
            Requests
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-normal text-[var(--gt-ink-primary)]">1,248</div>
        </div>
        <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4">
          <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
            Tokens
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-normal text-[var(--gt-ink-primary)]">1.0M</div>
        </div>
        <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4">
          <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
            Latency
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-normal text-[var(--gt-ink-primary)]">182MS</div>
        </div>
      </div>
      <div className="grid overflow-hidden rounded-md border border-[var(--gt-border-subtle)]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-2 border-b border-dashed border-[var(--gt-border-strong)] px-4 py-3 last:border-b-0 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
              {label}
            </div>
            <div className="min-w-0 break-all text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <>
      <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
        Preview only
      </div>
      <div className="flex flex-wrap gap-2">
        <Button>
          Cancel
        </Button>
        <Button type="primary">
          Save
        </Button>
      </div>
    </>
  );
}

function ErrorMessage() {
  return (
    <div className="border-t-2 border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-6 py-4 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]">
      Quota probe returned 429 in the latest check.
    </div>
  );
}

function ModalSample({
  long = false,
  error = false,
  footer = true,
}: {
  long?: boolean;
  error?: boolean;
  footer?: boolean;
}) {
  return (
    <ModalViewport>
      <AccountDetailModalFrame
        onClose={() => undefined}
        header={<Header title={error ? 'Route Backup Detail' : 'Codex Primary Detail'} />}
        error={error ? <ErrorMessage /> : undefined}
        footer={footer ? <Footer /> : undefined}
      >
        <Body long={long} />
      </AccountDetailModalFrame>
    </ModalViewport>
  );
}

function AccountImportSample({
  content = '',
  items = [],
  label,
}: {
  content?: string;
  items?: AccountImportPayloadItem[];
  label: string;
}) {
  const { t } = useI18n();
  return (
    <ModalViewport label={label}>
      <AccountImportModal
        t={t}
        initialPasteContent={content}
        initialItems={items}
        onClose={() => undefined}
        onSubmit={async () => undefined}
      />
    </ModalViewport>
  );
}

const pastedAuthContent = JSON.stringify(
  {
    type: 'codex',
    email: 'team-codex@example.com',
    access_token: 'preview-access-token',
    refresh_token: 'preview-refresh-token',
    account_id: 'acct_preview',
  },
  null,
  2,
);

const pastedAuthArrayContent = JSON.stringify(
  [
    {
      type: 'codex',
      email: 'team-codex@example.com',
      access_token: 'preview-access-token',
      refresh_token: 'preview-refresh-token',
    },
    {
      schema: 'gettokens.account-card.v1',
      credentialSource: 'openai-compatible',
      openAICompatibleProvider: {
        name: 'deepseek',
        apiKey: 'sk-preview-deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
      },
    },
  ],
  null,
  2,
);

const accountImportItems: AccountImportPayloadItem[] = [
  {
    type: 'upload-file',
    name: 'chatgpt-session.json',
    contentBase64: 'eyJ0eXBlIjoiY29kZXgifQ==',
  },
  {
    type: 'auth-file',
    name: 'team-codex.json',
    content: pastedAuthContent,
  },
  {
    type: 'openai-compatible',
    name: 'deepseek',
    apiKey: 'sk-preview-deepseek',
    apiKeys: ['sk-preview-deepseek', 'sk-preview-backup'],
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: '',
    proxyUrl: '',
    headers: {},
    models: [{ name: 'deepseek-chat', alias: 'codex-deepseek' }],
  },
];

const apiKeyForms: Record<'empty' | 'filled' | 'error', ApiKeyFormState> = {
  empty: {
    label: '',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
  },
  filled: {
    label: 'codex-preview',
    apiKey: 'sk-preview-openai',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'codex-',
    quotaCurl: 'curl -sS "https://example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"',
    quotaEnabled: true,
  },
  error: {
    label: 'team-router',
    apiKey: 'sk-preview-router',
    baseUrl: 'https://router.internal/v1',
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
  },
};

const apiKeyDetailAccount: AccountRecord = {
  id: 'codex-api-key-preview',
  provider: 'openai',
  credentialSource: 'api-key',
  displayName: 'Codex API Key Preview',
  status: 'active',
  apiKey: 'sk-preview-openai',
  keyFingerprint: 'sk-...93FA',
  baseUrl: 'https://api.openai.com/v1',
  prefix: 'codex-preview',
  quotaCurl: 'curl -sS "https://example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"',
  quotaEnabled: true,
  planType: 'Pro',
  supportedFormats: ['openai_chat', 'openai_responses'],
};

const apiKeyUsageSummary: AccountUsageSummary = {
  source: 'attribution',
  hasData: true,
  requestCount: 748,
  failedCount: 8,
  success: 740,
  failure: 8,
  successRate: 98.9,
  averageLatencyMs: 226,
  inputTokens: 364000,
  cachedInputTokens: 94000,
  outputTokens: 108000,
  totalTokens: 472000,
  lastActivityAt: 1779145200000,
  attributionKey: 'codex-api-key-preview',
  attributionKind: 'api-key',
  provider: 'openai',
  requestedModels: ['gpt-5.4-mini', 'gpt-5.2'],
  trafficBuckets: [],
  statusBar: {
    blocks: ['success', 'success', 'mixed', 'success', 'failure', 'idle'],
    blockDetails: [
      { success: 12, failure: 0, rate: 1, startTime: 0, endTime: 1 },
      { success: 10, failure: 0, rate: 1, startTime: 1, endTime: 2 },
      { success: 7, failure: 1, rate: 0.88, startTime: 2, endTime: 3 },
      { success: 13, failure: 0, rate: 1, startTime: 3, endTime: 4 },
      { success: 0, failure: 3, rate: 0, startTime: 4, endTime: 5 },
      { success: 0, failure: 0, rate: -1, startTime: 5, endTime: 6 },
    ],
    successRate: 98,
    totalSuccess: 42,
    totalFailure: 4,
  },
};

const apiKeyDetailBilling: BillingDisplay = {
  isAvailable: true,
  balances: [
    {
      currency: 'USD',
      totalBalance: '120.00',
      grantedBalance: '80.00',
      toppedUpBalance: '40.00',
    },
  ],
};

const apiKeyRateLimitStatus: RateLimitState = {
  accountKey: 'codex-api-key-preview',
  blocked: false,
  rules: [
    {
      exceeded: false,
      usagePct: 44,
      currentUsage: 440000,
      rule: {
        id: 'story-token-24h',
        accountKey: 'codex-api-key-preview',
        strategy: 'token-window',
        window: '24h',
        limitValue: 1000000,
        action: 'warn',
        enabled: true,
      },
    },
  ],
};

const apiKeyVerifyStates: Record<'idle' | 'success' | 'error', APIKeyVerifyState> = {
  idle: {
    model: 'gpt-5.4-mini',
    status: 'idle',
    message: '',
    lastVerifiedAt: null,
  },
  success: {
    model: 'gpt-5.4-mini',
    status: 'success',
    message: 'Probe completed with 200 OK.',
    lastVerifiedAt: 1779145200000,
  },
  error: {
    model: 'gpt-5.4-mini',
    status: 'error',
    message: '401 unauthorized',
    lastVerifiedAt: 1779141600000,
  },
};

const previewRateLimitRulesAPI: RateLimitRulesAPI = {
  list: async () => apiKeyRateLimitStatus.rules.map((item) => item.rule),
  create: async (rule) => [rule],
  update: async (rule) => [rule],
  delete: async () => undefined,
};

const unifiedComposeForms: Record<'empty' | 'deepseek' | 'error', UnifiedComposeFormState> = {
  empty: {
    label: '',
    apiKey: '',
    baseUrl: '',
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
    formatBaseUrls: {},
    billingCurl: '',
    billingEnabled: false,
    modelFetchApiKey: '',
    modelFetchBaseUrl: '',
  },
  deepseek: {
    label: 'DeepSeek Team',
    apiKey: 'sk-preview-deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: '',
    quotaCurl: 'curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"',
    quotaEnabled: true,
    formatBaseUrls: {
      openai_chat: 'https://api.deepseek.com/v1',
      openai_responses: 'https://api.deepseek.com/v1',
    },
    billingCurl: 'curl -sS "https://api.deepseek.com/user/balance" -H "Authorization: Bearer {{apiKey}}"',
    billingEnabled: true,
    modelFetchApiKey: '',
    modelFetchBaseUrl: '',
  },
  error: {
    label: 'Custom Router',
    apiKey: '',
    baseUrl: 'https://router.internal/v1',
    prefix: '',
    quotaCurl: '',
    quotaEnabled: false,
    formatBaseUrls: {},
    billingCurl: '',
    billingEnabled: false,
    modelFetchApiKey: '',
    modelFetchBaseUrl: '',
  },
};

function ApiKeyComposeSample({
  label,
  formKey,
  error = '',
  probe = 'none',
}: {
  label: string;
  formKey: keyof typeof apiKeyForms;
  error?: string;
  probe?: 'none' | 'ready' | 'loading' | 'verify-error';
}) {
  const { t } = useI18n();
  const withProbe = probe !== 'none';
  return (
    <ModalViewport label={label}>
      <ApiKeyComposeModal
        t={t}
        form={apiKeyForms[formKey]}
        error={error}
        onClose={() => undefined}
        onChange={() => undefined}
        onSubmit={() => undefined}
        onFetchModels={withProbe ? async () => ({ models: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.2'], message: '3 models' }) : undefined}
        onVerify={withProbe ? async () => ({ success: probe !== 'verify-error', message: probe === 'verify-error' ? '401 unauthorized' : 'probe ok' }) : undefined}
        initialFetchModelsState={
          probe === 'loading'
            ? { status: 'loading', models: [], message: '' }
            : probe === 'verify-error'
              ? { status: 'success', models: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.2'], message: '3 models' }
              : undefined
        }
        initialVerifyModel={probe === 'verify-error' ? 'gpt-5.4-mini' : undefined}
        initialVerifyState={probe === 'verify-error' ? { status: 'error', message: '401 unauthorized' } : undefined}
      />
    </ModalViewport>
  );
}

function AccountDetailSectionsSample({
  label,
  saving = false,
  missing = false,
}: {
  label: string;
  saving?: boolean;
  missing?: boolean;
}) {
  const [draft, setDraft] = useState({
    label: apiKeyDetailAccount.displayName ?? '',
    apiKey: apiKeyDetailAccount.apiKey ?? '',
    baseUrl: missing ? '' : apiKeyDetailAccount.baseUrl ?? '',
    formatBaseUrls: apiKeyDetailAccount.formatBaseUrls ?? {},
    prefix: apiKeyDetailAccount.prefix ?? '',
    models: apiKeyDetailAccount.models ?? [],
    quotaCurl: apiKeyDetailAccount.quotaCurl ?? '',
    quotaEnabled: Boolean(apiKeyDetailAccount.quotaEnabled),
    billingCurl: 'curl -sS "https://example.com/api/billing" -H "Authorization: Bearer {{apiKey}}"',
    billingEnabled: true,
    proxyUrl: '',
  });
  const missingFields = missing ? ['Base URL'] : [];

  return (
    <ModalViewport label={label}>
      <AccountDetailModalFrame
        onClose={() => undefined}
        header={
          <AccountDetailHeader
            account={apiKeyDetailAccount}
            usageSummary={apiKeyUsageSummary}
            onRename={() => undefined}
          />
        }
        footer={
          <AccountDetailFooter
            isApiKey
            configDirty
            missingFields={missingFields}
            savingConfig={saving}
            onSaveConfig={() => undefined}
          />
        }
      >
        <AccountDetailBody>
          <AccountDetailModuleStack layout="cards">
            <AccountCredentialVerifySection
              draft={draft}
              setDraft={setDraft}
              verifyState={apiKeyVerifyStates.success}
              modelNames={['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.2']}
              onVerify={() => undefined}
            />
            <AccountQuotaSection
              account={apiKeyDetailAccount}
              draft={draft}
              setDraft={setDraft}
              onTestQuotaCurl={async () => ({
                planType: 'Pro',
                windows: [
                  {
                    id: 'five-hour',
                    label: '5H WINDOW',
                    remainingPercent: 64,
                    usedLabel: '36%',
                    resetLabel: '02:10:00',
                  },
                ],
              })}
            />
            <AccountBillingSection
              account={apiKeyDetailAccount}
              draft={draft}
              setDraft={setDraft}
              liveBilling={apiKeyDetailBilling}
              onTestBillingCurl={async () => ({
                isAvailable: true,
                balanceInfos: [
                  {
                    currency: 'USD',
                    totalBalance: '120.00',
                    grantedBalance: '80.00',
                    toppedUpBalance: '40.00',
                  },
                ],
              })}
            />
          </AccountDetailModuleStack>
        </AccountDetailBody>
      </AccountDetailModalFrame>
    </ModalViewport>
  );
}

function UnifiedComposeSample({
  label,
  formKey,
  showPresets = true,
  selectedPresetID = '',
  presetSearch = '',
  error = '',
}: {
  label: string;
  formKey: keyof typeof unifiedComposeForms;
  showPresets?: boolean;
  selectedPresetID?: string;
  presetSearch?: string;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <ModalViewport label={label}>
      <UnifiedComposeModal
        t={t}
        form={unifiedComposeForms[formKey]}
        error={error}
        initialShowPresets={showPresets}
        initialSelectedPresetID={selectedPresetID}
        initialPresetSearch={presetSearch}
        onClose={() => undefined}
        onFormChange={() => undefined}
        onFormatBaseUrlChange={() => undefined}
        onBillingCurlChange={() => undefined}
        onBillingEnabledChange={() => undefined}
        onPresetApply={() => undefined}
        onSubmit={() => undefined}
      />
    </ModalViewport>
  );
}

function OAuthSample({
  label,
  existingName = null,
  copyState = 'idle',
}: {
  label: string;
  existingName?: string | null;
  copyState?: 'idle' | 'success' | 'error';
}) {
  const { t } = useI18n();
  return (
    <ModalViewport label={label}>
      <CodexOAuthModal
        t={t}
        existingName={existingName}
        url="https://chatgpt.com/oauth/authorize?client_id=gettokens-preview&redirect_uri=http%3A%2F%2F127.0.0.1%3A1455%2Fcallback&state=preview"
        initialCopyState={copyState}
        onCopyUrl={() => undefined}
        onClose={() => undefined}
        onOpenInBrowser={() => undefined}
      />
    </ModalViewport>
  );
}

function AccountModalsOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">账号弹窗</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          把账号详情弹窗的基础 shell 纳入设计系统，用固定内容检查 header、可滚动 body、错误条和 footer action 布局。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">弹窗框架状态</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <ModalSample />
          <ModalSample long />
          <ModalSample error />
          <ModalSample footer={false} />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">统一导入状态</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <AccountImportSample label="DS-IMPORT-EMPTY" />
          <AccountImportSample label="DS-IMPORT-PASTE-ARRAY" content={pastedAuthArrayContent} />
          <AccountImportSample label="DS-IMPORT-QUEUE" items={accountImportItems} />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">API 密钥新增状态</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <ApiKeyComposeSample label="DS-API-KEY-EMPTY" formKey="empty" />
          <ApiKeyComposeSample label="DS-API-KEY-FILLED-QUOTA" formKey="filled" probe="ready" />
          <ApiKeyComposeSample label="DS-API-KEY-FETCHING" formKey="filled" probe="loading" />
          <ApiKeyComposeSample
            label="DS-API-KEY-VERIFY-ERROR"
            formKey="error"
            probe="verify-error"
            error="API KEY 探测失败，请确认 Base URL 和模型权限。"
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">统一账号详情区块</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <AccountDetailSectionsSample label="DS-ACCOUNT-DETAIL-SECTIONS-READY" />
          <AccountDetailSectionsSample label="DS-ACCOUNT-DETAIL-SECTIONS-MISSING" missing saving />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">统一新增状态</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <UnifiedComposeSample label="DS-UNIFIED-PRESET-LIST" formKey="empty" />
          <UnifiedComposeSample
            label="DS-UNIFIED-FORM-STEP"
            formKey="deepseek"
            showPresets={false}
            selectedPresetID="deepseek"
          />
          <UnifiedComposeSample
            label="DS-UNIFIED-ERROR"
            formKey="error"
            showPresets={false}
            error="API KEY is required"
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Codex OAuth 状态</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <OAuthSample label="DS-OAUTH-READY" />
          <OAuthSample label="DS-OAUTH-EXISTING" existingName="team-codex@example.com" copyState="success" />
          <OAuthSample label="DS-OAUTH-COPY-ERROR" copyState="error" />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountModalsOverview />,
};

export const Default: Story = {
  render: () => <ModalSample />,
};

export const LongContent: Story = {
  render: () => <ModalSample long />,
};

export const Error: Story = {
  render: () => <ModalSample error />,
};

export const AccountImport: Story = {
  render: () => <AccountImportSample label="DS-IMPORT-QUEUE" items={accountImportItems} />,
};

export const ApiKeyCompose: Story = {
  render: () => <ApiKeyComposeSample label="DS-API-KEY-FILLED-QUOTA" formKey="filled" probe="ready" />,
};

export const AccountDetailSections: Story = {
  render: () => <AccountDetailSectionsSample label="DS-ACCOUNT-DETAIL-SECTIONS-READY" />,
};

export const CodexOAuth: Story = {
  render: () => <OAuthSample label="DS-OAUTH-READY" />,
};

export const UnifiedComposePresetList: Story = {
  render: () => <UnifiedComposeSample label="DS-UNIFIED-PRESET-LIST" formKey="empty" />,
};

export const UnifiedCompose: Story = {
  render: () => <UnifiedComposeSample label="DS-UNIFIED-FORM-STEP" formKey="deepseek" showPresets={false} selectedPresetID="deepseek" />,
};
