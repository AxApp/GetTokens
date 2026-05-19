import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DragEvent } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import type { CodexAccountRow, CodexRoutePolicyRowState } from '../model/codexAccountList';
import type { CodexAccountOrderDisplayMode } from '../model/codexAccountOrderSectionLayout';
import { AccountOrderRow } from './CodexAccountOrderRow';
import { CodexAccountOrderSection } from './CodexAccountOrderSection';

const meta = {
  title: 'Design System/Feature Components/Codex Account Order',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const rows: CodexAccountRow[] = [
  {
    id: 'auth-file:team-codex',
    label: 'team-codex@example.com',
    sourceKind: 'codex-auth-file',
    provider: 'codex',
    quotaKey: 'team-codex',
    priority: 40,
    requestable: true,
    blockReason: '',
    status: 'active',
    baseUrl: 'https://chatgpt.com/backend-api',
    prefix: '',
    keySuffix: '',
    modelMappings: [
      { realModel: 'gpt-5.5', codexModel: 'gpt-5.5' },
      { realModel: 'gpt-5.4-mini', codexModel: 'gpt-5.4-mini' },
    ],
  },
  {
    id: 'codex-api-key:local-relay',
    label: 'Local Relay Key',
    sourceKind: 'codex-api-key',
    provider: 'codex',
    priority: 30,
    requestable: true,
    blockReason: '',
    status: 'configured',
    baseUrl: 'http://127.0.0.1:18317/v1',
    prefix: 'GT',
    keySuffix: '8F21',
    modelMappings: [
      { realModel: 'gpt-5.5', codexModel: 'gpt-5.5' },
      { realModel: 'gpt-5.4-mini', codexModel: 'fast-lane' },
    ],
  },
  {
    id: 'openai-compatible:team-router',
    label: 'team-router.internal',
    sourceKind: 'openai-compatible',
    provider: 'team-router',
    priority: 20,
    requestable: true,
    blockReason: '',
    status: 'configured',
    baseUrl: 'https://router.internal/v1',
    prefix: 'team',
    keySuffix: '',
    modelMappings: [{ realModel: 'gpt-5.5', codexModel: 'gpt-5.5' }],
  },
  {
    id: 'auth-file:disabled-backup',
    label: 'disabled-backup@example.com',
    sourceKind: 'codex-auth-file',
    provider: 'codex',
    quotaKey: 'disabled-backup',
    priority: 10,
    requestable: false,
    blockReason: 'disabled',
    status: 'active',
    baseUrl: 'https://chatgpt.com/backend-api',
    prefix: '',
    keySuffix: '',
    disabled: true,
    modelMappings: [],
  },
];

const routePolicyStates: Record<string, CodexRoutePolicyRowState> = {
  'auth-file:team-codex': { mode: 'allow', previewRank: 1, participates: true },
  'codex-api-key:local-relay': { mode: 'default', previewRank: 2, participates: true },
  'openai-compatible:team-router': { mode: 'deny', previewRank: 0, participates: false },
  'auth-file:disabled-backup': { mode: 'blocked', previewRank: 0, participates: false },
};

const usageSummary: AccountUsageSummary = {
  source: 'attribution',
  hasData: true,
  requestCount: 1248,
  failedCount: 9,
  success: 1239,
  failure: 9,
  successRate: 99.3,
  averageLatencyMs: 184,
  inputTokens: 824000,
  cachedInputTokens: 210000,
  outputTokens: 181000,
  totalTokens: 1005000,
  lastActivityAt: 1779145200000,
  attributionKey: 'codex-account-order',
  attributionKind: 'api-key',
  provider: 'codex',
  requestedModels: ['gpt-5.5', 'gpt-5.4-mini'],
  trafficBuckets: [],
  statusBar: {
    blocks: ['success', 'success', 'mixed', 'success', 'failure', 'idle'],
    blockDetails: [
      { success: 12, failure: 0, rate: 1, startTime: 0, endTime: 1 },
      { success: 14, failure: 0, rate: 1, startTime: 1, endTime: 2 },
      { success: 9, failure: 1, rate: 0.9, startTime: 2, endTime: 3 },
      { success: 18, failure: 0, rate: 1, startTime: 3, endTime: 4 },
      { success: 0, failure: 3, rate: 0, startTime: 4, endTime: 5 },
      { success: 0, failure: 0, rate: -1, startTime: 5, endTime: 6 },
    ],
    successRate: 99.3,
    totalSuccess: 1239,
    totalFailure: 9,
  },
};

const quotaState: CodexQuotaState = {
  status: 'success',
  quota: {
    planType: 'Pro',
    windows: [
      { id: 'five-hour', label: '5H', remainingPercent: 68, resetLabel: '02:18:00' },
      { id: 'weekly', label: 'WEEKLY', remainingPercent: 84, resetLabel: '3D 08H' },
    ],
  } as unknown as NonNullable<CodexQuotaState['quota']>,
};

const rateLimitBlocked: RateLimitState = {
  accountKey: 'codex-account-order',
  blocked: true,
  blockReason: 'TOKENS 24H',
  rules: [
    {
      exceeded: true,
      usagePct: 112,
      currentUsage: 1120000,
      rule: {
        id: 'tokens-24h',
        accountKey: 'codex-account-order',
        strategy: 'token-window',
        window: '24h',
        limitValue: 1000000,
        action: 'block',
        enabled: true,
      },
    },
  ],
};

const noopDragEvent = (event: DragEvent) => event.preventDefault();

function RowSample({
  row = rows[0],
  index = 0,
  density = 'compact',
  dragged = false,
  pending = false,
  probeHit = false,
  rateLimitStatus,
  label,
}: {
  row?: CodexAccountRow;
  index?: number;
  density?: CodexAccountOrderDisplayMode;
  dragged?: boolean;
  pending?: boolean;
  probeHit?: boolean;
  rateLimitStatus?: RateLimitState;
  label: string;
}) {
  const { t } = useI18n();
  return (
    <DesignSystemStoryFrame label={label}>
      <div className={density === 'list' ? 'grid gap-3' : density === 'full' ? 'max-w-[28rem]' : 'max-w-[24rem]'}>
        <AccountOrderRow
          row={row}
          index={index}
          density={density}
          dragged={dragged}
          pending={pending}
          t={t}
          onDragStart={() => undefined}
          onDragOver={noopDragEvent}
          onDragEnter={() => undefined}
          onDragEnd={() => undefined}
          onDrop={() => undefined}
          onOpenDetail={() => undefined}
          onToggle={() => undefined}
          probeHit={probeHit}
          routePolicyState={routePolicyStates[row.id]}
          quotaState={row.quotaKey === 'team-codex' ? quotaState : undefined}
          usageSummary={usageSummary}
          rateLimitStatus={rateLimitStatus}
          onPolicyModeChange={() => undefined}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function SectionSample({
  label,
  sampleRows = rows,
  ready = true,
  loading = false,
  saving = false,
  routingProbeRunning = false,
  orderChanged = false,
  density = 'compact',
  message = '',
}: {
  label: string;
  sampleRows?: CodexAccountRow[];
  ready?: boolean;
  loading?: boolean;
  saving?: boolean;
  routingProbeRunning?: boolean;
  orderChanged?: boolean;
  density?: CodexAccountOrderDisplayMode;
  message?: string;
}) {
  const { t } = useI18n();
  const storyT = (key: string) => (key === 'common.more_actions' ? '更多操作' : t(key));
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <CodexAccountOrderSection
          title="Codex Request Order"
          hint="固定排序队列用于检查 section header、密度切换、筛选、空态和保存提示。"
          message={message}
          ready={ready}
          loading={loading}
          saving={saving}
          routingProbeRunning={routingProbeRunning}
          orderChanged={orderChanged}
          rows={sampleRows}
          draggedID={null}
          pendingToggleID={saving ? rows[1]?.id ?? null : null}
          latestRoutingProbeAccountID={routingProbeRunning ? rows[0]?.id ?? '' : ''}
          routePolicyRowStates={routePolicyStates}
          codexQuotaByName={{ 'team-codex': quotaState, 'disabled-backup': quotaState }}
          accountUsageByID={{
            [rows[0].id]: usageSummary,
            [rows[1].id]: usageSummary,
            [rows[2].id]: usageSummary,
          }}
          accountRateLimitByID={{
            [rows[1].id]: rateLimitBlocked,
          }}
          refreshLabel="刷新顺序"
          loadingLabel="加载中"
          savingLabel="保存中"
          unsavedLabel="存在未保存排序"
          emptyLabel="暂无可排序账号"
          waitingLabel="等待服务 ready"
          t={storyT}
          onReload={() => undefined}
          onDragStart={() => undefined}
          onDragOver={noopDragEvent}
          onDragEnter={() => undefined}
          onDragEnd={() => undefined}
          onDrop={() => undefined}
          onOpenDetail={() => undefined}
          onToggle={() => undefined}
          onPolicyModeChange={() => undefined}
          initialDensity={density}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function CodexAccountOrderOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Codex Account Order</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          把 Codex 账号请求顺序里的排序行纳入设计系统，用固定 row、policy、quota、usage 和 rate-limit mock 覆盖密度、拖拽、命中、跳过、禁用和限流状态。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Row density and route states</h3>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <RowSample label="DS-FULL" density="full" />
          <div className="grid gap-4">
            <RowSample label="DS-COMPACT" row={rows[1]} index={1} density="compact" />
            <RowSample label="DS-DRAG" row={rows[1]} index={1} density="compact" dragged />
          </div>
          <div className="grid gap-4">
            <RowSample label="DS-LIST" row={rows[0]} density="list" probeHit />
            <RowSample label="DS-SKIPPED" row={rows[2]} index={2} density="list" />
            <RowSample label="DS-BLOCKED" row={rows[3]} index={3} density="list" pending />
            <RowSample label="DS-RATE" row={rows[1]} index={1} density="compact" rateLimitStatus={rateLimitBlocked} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Section states</h3>
        <div className="grid gap-4">
          <SectionSample label="DS-SECTION-COMPACT" density="compact" message="policy preview / 4 accounts" />
          <SectionSample label="DS-SECTION-FULL-UNSAVED" density="full" orderChanged message="manual order changed" />
          <SectionSample label="DS-SECTION-LIST-SAVING" density="list" saving routingProbeRunning />
          <div className="grid gap-4 xl:grid-cols-3">
            <SectionSample label="DS-SECTION-WAITING" ready={false} sampleRows={[]} />
            <SectionSample label="DS-SECTION-LOADING" loading sampleRows={[]} />
            <SectionSample label="DS-SECTION-EMPTY" sampleRows={[]} />
          </div>
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <CodexAccountOrderOverview />,
};

export const Full: Story = {
  render: () => <RowSample label="DS-FULL" density="full" />,
};

export const Compact: Story = {
  render: () => <RowSample label="DS-COMPACT" row={rows[1]} index={1} density="compact" />,
};

export const List: Story = {
  render: () => <RowSample label="DS-LIST" density="list" probeHit />,
};

export const Section: Story = {
  render: () => <SectionSample label="DS-SECTION-COMPACT" density="compact" message="policy preview / 4 accounts" />,
};
