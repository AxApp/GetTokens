import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { AccountRecord } from '../model/types';
import AccountGroupSection from './AccountGroupSection';
import AccountCardFrame from './AccountCardFrame';
import AccountGroupSectionView from './AccountGroupSectionView';

const meta = {
  title: 'Design System/业务组件/账号分组',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const accountRecords: AccountRecord[] = [
  {
    id: 'acct-team-primary',
    provider: 'openai',
    credentialSource: 'auth-file',
    displayName: 'Team Primary',
    status: 'active',
    email: 'team-primary@example.com',
    planType: 'Pro',
  },
  {
    id: 'acct-relay-backup',
    provider: 'openai-compatible',
    credentialSource: 'api-key',
    displayName: 'Relay Backup',
    status: 'active',
    keyFingerprint: 'sk-...93FA',
    planType: 'Team',
  },
  {
    id: 'acct-lab-disabled',
    provider: 'anthropic',
    credentialSource: 'api-key',
    displayName: 'Lab Disabled',
    status: 'disabled',
    disabled: true,
    keyFingerprint: 'sk-...42BC',
    planType: 'Enterprise',
  },
];

const usageSummary: AccountUsageSummary = {
  source: 'attribution',
  hasData: true,
  requestCount: 320,
  failedCount: 3,
  success: 317,
  failure: 3,
  successRate: 99,
  averageLatencyMs: 188,
  inputTokens: 142000,
  cachedInputTokens: 36000,
  outputTokens: 42000,
  totalTokens: 184000,
  lastActivityAt: 1779145200000,
  attributionKey: 'account-group-story',
  attributionKind: 'auth-file',
  provider: 'openai',
  requestedModels: ['gpt-5.2'],
  trafficBuckets: [],
  statusBar: {
    blocks: ['success', 'success', 'mixed', 'success', 'idle', 'idle'],
    blockDetails: [
      { success: 9, failure: 0, rate: 1, startTime: 0, endTime: 1 },
      { success: 8, failure: 0, rate: 1, startTime: 1, endTime: 2 },
      { success: 6, failure: 1, rate: 0.86, startTime: 2, endTime: 3 },
      { success: 10, failure: 0, rate: 1, startTime: 3, endTime: 4 },
      { success: 0, failure: 0, rate: -1, startTime: 4, endTime: 5 },
      { success: 0, failure: 0, rate: -1, startTime: 5, endTime: 6 },
    ],
    successRate: 99,
    totalSuccess: 33,
    totalFailure: 1,
  },
};

const rateLimitStatus: RateLimitState = {
  accountKey: 'acct-team-primary',
  blocked: false,
  rules: [],
};

function GroupViewport({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-5">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function MockAccountCard({ account, displayMode }: { account: AccountRecord; displayMode: AccountListDisplayMode }) {
  return (
    <AccountCardFrame interactive={false} onOpen={() => undefined}>
      <div className={`grid gap-3 p-4 ${displayMode === 'list' ? 'md:grid-cols-[1fr_auto] md:items-center' : ''}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-black uppercase italic tracking-normal text-[var(--text-primary)]">
            {account.displayName}
          </p>
          <p className="mt-1 truncate text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {account.email || account.keyFingerprint || account.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {account.provider}
          </span>
          <span className="border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {account.planType}
          </span>
          {account.disabled ? (
            <span className="border border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--color-status-danger)]">
              Disabled
            </span>
          ) : null}
        </div>
      </div>
    </AccountCardFrame>
  );
}

function AccountGroupSectionSample({
  label,
  displayMode = 'full',
  accounts = accountRecords,
}: {
  label: string;
  displayMode?: AccountListDisplayMode;
  accounts?: AccountRecord[];
}) {
  const { t } = useI18n();
  return (
    <GroupViewport label={label}>
      <AccountGroupSectionView
        t={t}
        group={{
          id: `group-${displayMode}`,
          label: displayMode === 'list' ? 'List Density' : displayMode === 'compact' ? 'Compact Density' : 'Pro Accounts',
          rank: 1,
          accounts,
        }}
        displayMode={displayMode}
        isSelectionMode={displayMode === 'list'}
        selectedAccountIDSet={new Set(['acct-team-primary'])}
        onToggleGroupSelection={() => undefined}
        onRefreshGroup={() => undefined}
        onSetGroupDisabled={() => undefined}
        renderAccount={(account) => <MockAccountCard key={account.id} account={account} displayMode={displayMode} />}
        emptyContent={
          <div className="border-2 border-dashed border-[var(--border-color)] p-8 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            No accounts in this group
          </div>
        }
      />
    </GroupViewport>
  );
}

function AccountGroupSectionWrapperSample({
  label,
  displayMode = 'full',
}: {
  label: string;
  displayMode?: AccountListDisplayMode;
}) {
  const { t } = useI18n();
  return (
    <GroupViewport label={label}>
      <AccountGroupSection
        t={t}
        group={{
          id: `wrapper-${displayMode}`,
          label: 'Runtime Wrapper',
          rank: 1,
          accounts: accountRecords,
        }}
        codexQuotaByName={{}}
        accountUsageByID={Object.fromEntries(accountRecords.map((account) => [account.id, usageSummary]))}
        accountRateLimitByID={Object.fromEntries(accountRecords.map((account) => [account.id, rateLimitStatus]))}
        accountCardHeights={{}}
        ready
        isSelectionMode={displayMode === 'list'}
        selectedAccountIDSet={new Set(['acct-team-primary'])}
        pendingDeleteID={null}
        oauthPendingAccountID={null}
        pendingStatusAccountID={null}
        displayMode={displayMode}
        onToggleSelection={() => undefined}
        onToggleGroupSelection={() => undefined}
        onRefreshGroup={() => undefined}
        onSetGroupDisabled={() => undefined}
        onOpenDetails={() => undefined}
        onRefreshQuota={() => undefined}
        onStartReauth={() => undefined}
        onToggleDisabled={() => undefined}
        onRequestDelete={() => undefined}
        onCancelDelete={() => undefined}
        onConfirmDelete={() => undefined}
        downloadAuthFile={async () => ({ contentBase64: 'eyJ0eXBlIjoic3RvcnkifQ=' })}
      />
    </GroupViewport>
  );
}

function AccountGroupSectionOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">账号分组</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          账号分组容器拆成无 Wails 的纯 view 后进入设计系统，用 mock 卡片覆盖完整、紧凑、列表和空分组布局。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Group states</h3>
        <div className="grid gap-4">
          <AccountGroupSectionSample label="DS-ACCOUNT-GROUP-FULL" />
          <AccountGroupSectionSample label="DS-ACCOUNT-GROUP-COMPACT" displayMode="compact" />
          <AccountGroupSectionSample label="DS-ACCOUNT-GROUP-LIST" displayMode="list" />
          <AccountGroupSectionSample label="DS-ACCOUNT-GROUP-EMPTY" accounts={[]} />
          <AccountGroupSectionWrapperSample label="DS-ACCOUNT-GROUP-WRAPPER" />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountGroupSectionOverview />,
};

export const Full: Story = {
  render: () => <AccountGroupSectionSample label="DS-ACCOUNT-GROUP-FULL" />,
};

export const List: Story = {
  render: () => <AccountGroupSectionSample label="DS-ACCOUNT-GROUP-LIST" displayMode="list" />,
};

export const RuntimeWrapper: Story = {
  render: () => <AccountGroupSectionWrapperSample label="DS-ACCOUNT-GROUP-WRAPPER" />,
};
