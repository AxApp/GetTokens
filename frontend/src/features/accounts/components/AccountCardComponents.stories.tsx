import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { BillingDisplay } from '../../../types';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { QuotaDisplay, Translator } from '../model/types';
import AccountCardFrame from './AccountCardFrame';
import AccountCardSkeleton from './AccountCardSkeleton';
import AccountHealthBar from './AccountHealthBar';
import AttributionCard from './AttributionCard';
import {
  BillingBalance,
  EvidenceSection,
  QuotaBars,
  RateLimitGuard,
  UnsupportedQuotaPlaceholder,
  UsageMetrics,
} from './CardSections';

const meta = {
  title: 'Design System/Feature Components/Account Cards',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy = {
  zh: {
    'accounts.recent_requests': '最近请求',
    'accounts.total_tokens': '总 Token',
    'accounts.quota_remaining': '剩余额度',
    'accounts.quota_unsupported': '暂不支持额度同步',
    'accounts.quota_syncing': '正在同步额度',
    'accounts.attribution_window': '归因窗口',
    'accounts.attribution_peak': '峰值',
    'accounts.attribution_now': '当前',
    'accounts.average_latency': '平均延迟',
  },
  en: {
    'accounts.recent_requests': 'Recent requests',
    'accounts.total_tokens': 'Total tokens',
    'accounts.quota_remaining': 'Quota remaining',
    'accounts.quota_unsupported': 'Quota sync unavailable',
    'accounts.quota_syncing': 'Syncing quota',
    'accounts.attribution_window': 'Attribution window',
    'accounts.attribution_peak': 'Peak',
    'accounts.attribution_now': 'Current',
    'accounts.average_latency': 'Average latency',
  },
} as const;

function useStoryCopy(): { locale: 'zh' | 'en'; t: Translator } {
  const { locale } = useI18n();
  const dictionary = locale === 'zh' ? copy.zh : copy.en;
  return {
    locale,
    t: (key) => dictionary[key as keyof typeof dictionary] || key,
  };
}

const statusBar = {
  blocks: [
    'success',
    'success',
    'success',
    'mixed',
    'success',
    'success',
    'failure',
    'mixed',
    'success',
    'success',
    'idle',
    'idle',
  ],
  blockDetails: [
    { success: 8, failure: 0, rate: 1, startTime: 0, endTime: 1 },
    { success: 11, failure: 0, rate: 1, startTime: 1, endTime: 2 },
    { success: 9, failure: 0, rate: 1, startTime: 2, endTime: 3 },
    { success: 7, failure: 1, rate: 0.875, startTime: 3, endTime: 4 },
    { success: 12, failure: 0, rate: 1, startTime: 4, endTime: 5 },
    { success: 10, failure: 0, rate: 1, startTime: 5, endTime: 6 },
    { success: 0, failure: 3, rate: 0, startTime: 6, endTime: 7 },
    { success: 5, failure: 2, rate: 0.714, startTime: 7, endTime: 8 },
    { success: 13, failure: 0, rate: 1, startTime: 8, endTime: 9 },
    { success: 6, failure: 0, rate: 1, startTime: 9, endTime: 10 },
    { success: 0, failure: 0, rate: -1, startTime: 10, endTime: 11 },
    { success: 0, failure: 0, rate: -1, startTime: 11, endTime: 12 },
  ],
  successRate: 88,
  totalSuccess: 81,
  totalFailure: 6,
} satisfies AccountUsageSummary['statusBar'];

const healthyUsageSummary: AccountUsageSummary = {
  source: 'attribution',
  hasData: true,
  requestCount: 1248,
  failedCount: 6,
  success: 1242,
  failure: 6,
  successRate: 99.5,
  averageLatencyMs: 182,
  inputTokens: 814000,
  cachedInputTokens: 233000,
  outputTokens: 194000,
  totalTokens: 1008000,
  lastActivityAt: 1779145200000,
  attributionKey: 'codex-workbench',
  attributionKind: 'api-key',
  provider: 'openai',
  requestedModels: ['gpt-5.2', 'gpt-5.2-mini'],
  trafficBuckets: [
    { start: '00:00', requestCount: 52, failedCount: 0, inputTokens: 18000, cachedInputTokens: 4200, outputTokens: 6400, totalTokens: 24400 },
    { start: '03:00', requestCount: 75, failedCount: 1, inputTokens: 26000, cachedInputTokens: 7600, outputTokens: 8400, totalTokens: 34400 },
    { start: '06:00', requestCount: 111, failedCount: 0, inputTokens: 41000, cachedInputTokens: 11000, outputTokens: 13000, totalTokens: 54000 },
    { start: '09:00', requestCount: 154, failedCount: 0, inputTokens: 78000, cachedInputTokens: 21000, outputTokens: 26000, totalTokens: 104000 },
    { start: '12:00', requestCount: 226, failedCount: 2, inputTokens: 118000, cachedInputTokens: 39000, outputTokens: 37000, totalTokens: 155000 },
    { start: '15:00', requestCount: 304, failedCount: 1, inputTokens: 164000, cachedInputTokens: 52000, outputTokens: 48000, totalTokens: 212000 },
    { start: '18:00', requestCount: 211, failedCount: 1, inputTokens: 101000, cachedInputTokens: 31000, outputTokens: 29000, totalTokens: 130000 },
    { start: '21:00', requestCount: 115, failedCount: 1, inputTokens: 66000, cachedInputTokens: 19000, outputTokens: 20500, totalTokens: 86500 },
  ],
  statusBar,
};

const failedUsageSummary: AccountUsageSummary = {
  ...healthyUsageSummary,
  requestCount: 88,
  failedCount: 31,
  success: 57,
  failure: 31,
  successRate: 64.8,
  averageLatencyMs: 1420,
  statusBar: {
    ...statusBar,
    blocks: ['failure', 'failure', 'mixed', 'mixed', 'failure', 'idle'],
    blockDetails: [
      { success: 0, failure: 5, rate: 0, startTime: 0, endTime: 1 },
      { success: 0, failure: 4, rate: 0, startTime: 1, endTime: 2 },
      { success: 3, failure: 2, rate: 0.6, startTime: 2, endTime: 3 },
      { success: 2, failure: 2, rate: 0.5, startTime: 3, endTime: 4 },
      { success: 0, failure: 6, rate: 0, startTime: 4, endTime: 5 },
      { success: 0, failure: 0, rate: -1, startTime: 5, endTime: 6 },
    ],
  },
};

const quotaDisplay: QuotaDisplay = {
  status: 'success',
  planType: 'Pro',
  windows: [
    {
      id: 'five-hour',
      label: '5H WINDOW',
      remainingPercent: 62,
      usedLabel: '38%',
      resetLabel: '02:14:00',
    },
    {
      id: 'weekly',
      label: 'WEEKLY',
      remainingPercent: 84,
      usedLabel: '16%',
      resetLabel: '3D 08H',
    },
  ],
};

const loadingQuotaDisplay: QuotaDisplay = {
  status: 'loading',
  planType: '',
  windows: [],
};

const billing: BillingDisplay = {
  isAvailable: true,
  balances: [
    {
      currency: 'USD',
      totalBalance: '42.80',
      grantedBalance: '30.00',
      toppedUpBalance: '12.80',
    },
  ],
};

const rateLimitStatus: RateLimitState = {
  accountKey: 'codex-workbench',
  blocked: false,
  rules: [
    {
      exceeded: false,
      usagePct: 42,
      currentUsage: 420000,
      rule: {
        id: 'tokens-24h',
        accountKey: 'codex-workbench',
        strategy: 'token-window',
        window: '24h',
        limitValue: 1000000,
        action: 'warn',
        enabled: true,
      },
    },
    {
      exceeded: true,
      usagePct: 88,
      currentUsage: 88,
      rule: {
        id: 'requests-1h',
        accountKey: 'codex-workbench',
        strategy: 'request-window',
        window: '1h',
        limitValue: 100,
        action: 'block',
        enabled: true,
      },
    },
  ],
};

function AccountCardFrameSample({ selected = false }: { selected?: boolean }) {
  return (
    <DesignSystemStoryFrame label="DS-FRAME">
      <AccountCardFrame
        className={selected ? 'border-[var(--accent-red)] bg-[var(--bg-surface)]' : ''}
        onOpen={() => undefined}
      >
        <div className="grid min-h-[9rem] gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Interactive card shell
              </div>
              <h3 className="mt-2 text-lg font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                AccountCardFrame
              </h3>
            </div>
            <button
              type="button"
              className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[0.625rem] font-black uppercase tracking-normal"
              onClick={(event) => event.stopPropagation()}
            >
              Nested Action
            </button>
          </div>
          <div className="border-t border-dashed border-[var(--border-color)] pt-3 text-xs font-bold text-[var(--text-muted)]">
            Child controls keep their own click boundary while the shell remains keyboard-openable.
          </div>
        </div>
      </AccountCardFrame>
    </DesignSystemStoryFrame>
  );
}

function HealthBarSample({ summary = healthyUsageSummary }: { summary?: AccountUsageSummary }) {
  return (
    <DesignSystemStoryFrame label="DS-HEALTH">
      <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Request health
          </div>
          <div className="font-mono text-sm font-black tabular-nums text-[var(--text-primary)]">
            {Math.round(summary.successRate ?? 0)}%
          </div>
        </div>
        <AccountHealthBar summary={summary} />
      </div>
    </DesignSystemStoryFrame>
  );
}

function AttributionCardSample({
  tone = 'positive',
  density = 'full',
  failed = false,
}: {
  tone?: 'positive' | 'warning' | 'critical' | 'neutral';
  density?: 'full' | 'compact' | 'list';
  failed?: boolean;
}) {
  const { t } = useStoryCopy();
  return (
    <DesignSystemStoryFrame label="DS-CARD">
      <AttributionCard
        t={t}
        title={failed ? 'Claude Route Backup' : 'Codex Primary Workbench'}
        subtitle={failed ? 'api-key / backup-provider' : 'auth-file / team-codex@example.com'}
        eyebrow={density === 'list' ? 'API KEY' : 'OPENAI'}
        failureReason={failed ? 'Quota probe returned 429 in the last sync window.' : ''}
        badges={[
          { label: failed ? 'Degraded' : 'Ready', tone },
          { label: 'Pro', tone: 'neutral' },
          { label: 'Managed', tone: 'warning' },
        ]}
        usageSummary={failed ? failedUsageSummary : healthyUsageSummary}
        quotaDisplay={failed ? { ...quotaDisplay, windows: [{ ...quotaDisplay.windows[0], remainingPercent: 8 }] } : quotaDisplay}
        billing={failed ? undefined : billing}
        rateLimitStatus={failed ? { ...rateLimitStatus, blocked: true, blockReason: '1H REQUEST LIMIT' } : rateLimitStatus}
        evidenceRows={[
          { label: 'source', value: failed ? 'routing backup' : 'attribution cache' },
          { label: 'last seen', value: '2026-05-19 22:18' },
        ]}
        tone={tone}
        density={density}
        interactive={false}
        onOpen={() => undefined}
      />
    </DesignSystemStoryFrame>
  );
}

function CardSectionsSample() {
  const { t } = useStoryCopy();
  return (
    <DesignSystemStoryFrame label="DS-SECTIONS">
      <div className="grid overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
        <QuotaBars quotaDisplay={quotaDisplay} accentFillClass="bg-green-600" />
        <BillingBalance billing={billing} />
        <UsageMetrics usageSummary={healthyUsageSummary} t={t} />
        <RateLimitGuard rateLimitStatus={rateLimitStatus} />
        <EvidenceSection
          rows={[
            { label: 'account', value: 'codex-workbench' },
            { label: 'model', value: 'gpt-5.2' },
            { label: 'route', value: 'managed relay' },
          ]}
        />
        <UnsupportedQuotaPlaceholder quotaDisplay={loadingQuotaDisplay} t={t} />
      </div>
    </DesignSystemStoryFrame>
  );
}

function SkeletonSample() {
  return (
    <DesignSystemStoryFrame label="DS-LOAD">
      <div className="grid gap-4 md:grid-cols-2">
        <AccountCardSkeleton />
        <AccountCardSkeleton />
      </div>
    </DesignSystemStoryFrame>
  );
}

function AccountCardsOverview() {
  const { locale } = useStoryCopy();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Account Card Components</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          {zh
            ? '把账号卡片体系里的基础外壳、归因卡、指标段、健康条和加载骨架纳入设计系统，用固定 mock 数据检查密度、失败态、限流和额度展示。'
            : 'Admitted account card shell, attribution card, metric sections, health bar, and loading skeleton with fixed mock data for density, failure, rate-limit, and quota states.'}
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '交互外壳' : 'Interactive shell'}</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <AccountCardFrameSample />
          <AccountCardFrameSample selected />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '归因卡片状态' : 'Attribution card states'}</h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <AttributionCardSample />
          <AttributionCardSample tone="critical" failed />
          <AttributionCardSample tone="warning" density="compact" />
          <AttributionCardSample tone="neutral" density="list" />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '指标段与健康条' : 'Metric sections and health'}</h3>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
          <CardSectionsSample />
          <div className="grid gap-4 content-start">
            <HealthBarSample />
            <HealthBarSample summary={failedUsageSummary} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '加载骨架' : 'Loading skeleton'}</h3>
        <SkeletonSample />
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountCardsOverview />,
};

export const AttributionHealthy: Story = {
  render: () => <AttributionCardSample />,
};

export const AttributionFailed: Story = {
  render: () => <AttributionCardSample tone="critical" failed />,
};

export const CardSections: Story = {
  render: () => <CardSectionsSample />,
};

export const HealthBar: Story = {
  render: () => <HealthBarSample />,
};

export const Skeleton: Story = {
  render: () => <SkeletonSample />,
};
