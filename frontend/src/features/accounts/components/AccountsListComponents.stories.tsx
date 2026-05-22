import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { AccountGroup, AccountRecord, AccountsFilterState } from '../model/types';
import { defaultAccountsFilterState } from '../model/accountFilters';
import AccountCard from './AccountCard';
import AccountsListWorkbenchView from './AccountsListWorkbenchView';

const meta = {
  title: 'Design System/业务组件/账号列表',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const emptyFilters: AccountsFilterState = {
  ...defaultAccountsFilterState,
  hasLongestQuota: false,
};

const activeFilters: AccountsFilterState = {
  ...defaultAccountsFilterState,
  source: 'api-key',
  availability: 'requestable',
  hasLongestQuota: true,
};

const statusBar = {
  blocks: ['success', 'success', 'mixed', 'success', 'failure', 'mixed', 'success', 'idle'],
  blockDetails: [
    { success: 8, failure: 0, rate: 1, startTime: 0, endTime: 1 },
    { success: 10, failure: 0, rate: 1, startTime: 1, endTime: 2 },
    { success: 6, failure: 1, rate: 0.85, startTime: 2, endTime: 3 },
    { success: 11, failure: 0, rate: 1, startTime: 3, endTime: 4 },
    { success: 0, failure: 4, rate: 0, startTime: 4, endTime: 5 },
    { success: 5, failure: 2, rate: 0.71, startTime: 5, endTime: 6 },
    { success: 9, failure: 0, rate: 1, startTime: 6, endTime: 7 },
    { success: 0, failure: 0, rate: -1, startTime: 7, endTime: 8 },
  ],
  successRate: 88,
  totalSuccess: 49,
  totalFailure: 7,
} satisfies AccountUsageSummary['statusBar'];

const healthyUsageSummary: AccountUsageSummary = {
  source: 'attribution',
  hasData: true,
  requestCount: 836,
  failedCount: 7,
  success: 829,
  failure: 7,
  successRate: 99.2,
  averageLatencyMs: 214,
  inputTokens: 412000,
  cachedInputTokens: 118000,
  outputTokens: 124000,
  totalTokens: 536000,
  lastActivityAt: 1779145200000,
  attributionKey: 'codex-team-primary',
  attributionKind: 'auth-file',
  provider: 'openai',
  requestedModels: ['gpt-5.2', 'gpt-5.2-mini'],
  trafficBuckets: [
    { start: '09:00', requestCount: 120, failedCount: 0, inputTokens: 82000, cachedInputTokens: 22000, outputTokens: 24000, totalTokens: 106000 },
    { start: '12:00', requestCount: 196, failedCount: 2, inputTokens: 104000, cachedInputTokens: 36000, outputTokens: 31000, totalTokens: 135000 },
    { start: '15:00', requestCount: 228, failedCount: 1, inputTokens: 132000, cachedInputTokens: 41000, outputTokens: 39000, totalTokens: 171000 },
    { start: '18:00', requestCount: 156, failedCount: 3, inputTokens: 94000, cachedInputTokens: 19000, outputTokens: 30000, totalTokens: 124000 },
  ],
  statusBar,
};

const degradedUsageSummary: AccountUsageSummary = {
  ...healthyUsageSummary,
  requestCount: 144,
  failedCount: 42,
  success: 102,
  failure: 42,
  successRate: 70.8,
  averageLatencyMs: 1280,
  attributionKey: 'relay-backup',
  attributionKind: 'api-key',
  statusBar: {
    ...statusBar,
    blocks: ['failure', 'mixed', 'failure', 'mixed', 'idle', 'idle'],
    successRate: 70,
    totalSuccess: 14,
    totalFailure: 6,
  },
};

const rateLimitStatus: RateLimitState = {
  accountKey: 'codex-team-primary',
  blocked: false,
  rules: [
    {
      exceeded: false,
      usagePct: 48,
      currentUsage: 480000,
      rule: {
        id: 'tokens-24h',
        accountKey: 'codex-team-primary',
        strategy: 'token-window',
        window: '24h',
        limitValue: 1000000,
        action: 'warn',
        enabled: true,
      },
    },
  ],
};

const blockedRateLimitStatus: RateLimitState = {
  ...rateLimitStatus,
  accountKey: 'relay-backup',
  blocked: true,
  blockReason: '1H REQUEST LIMIT',
  rules: [
    {
      exceeded: true,
      usagePct: 106,
      currentUsage: 106,
      rule: {
        id: 'requests-1h',
        accountKey: 'relay-backup',
        strategy: 'request-window',
        window: '1h',
        limitValue: 100,
        action: 'block',
        enabled: true,
      },
    },
  ],
};

const primaryAccount: AccountRecord = {
  id: 'acct-team-primary',
  provider: 'openai',
  credentialSource: 'auth-file',
  displayName: 'Codex Team Primary',
  status: 'active',
  email: 'team-codex@example.com',
  planType: 'Pro',
  name: 'team-codex-auth.json',
  baseUrl: 'https://api.openai.com/v1',
  supportedFormats: ['openai_chat', 'openai_responses'],
};

const relayAccount: AccountRecord = {
  id: 'acct-relay-backup',
  provider: 'openai-compatible',
  credentialSource: 'api-key',
  displayName: 'Relay Backup',
  status: 'active',
  keyFingerprint: 'sk-...93FA',
  planType: 'Team',
  prefix: 'relay-backup',
  baseUrl: 'https://relay.example.test/v1',
  supportedFormats: ['openai_chat'],
};

const disabledAccount: AccountRecord = {
  id: 'acct-lab-disabled',
  provider: 'anthropic',
  credentialSource: 'api-key',
  displayName: 'Disabled Lab Key',
  status: 'disabled',
  disabled: true,
  keyFingerprint: 'sk-ant-...42BC',
  planType: 'Enterprise',
  supportedFormats: ['anthropic'],
};

const overflowAccount: AccountRecord = {
  id: 'acct-limit-overflow',
  provider: 'openai-compatible',
  credentialSource: 'api-key',
  displayName: 'High Traffic Route',
  status: 'active',
  keyFingerprint: 'sk-...77AD',
  planType: 'Team',
  supportedFormats: ['openai_chat', 'openai_responses'],
};

const baseGroups: AccountGroup[] = [
  {
    id: 'team-pro',
    label: 'Pro / Team Accounts',
    rank: 1,
    accounts: [primaryAccount, relayAccount],
  },
  {
    id: 'backup-lab',
    label: 'Backups And Lab',
    rank: 2,
    accounts: [overflowAccount, disabledAccount],
  },
];

const emptyGroups: AccountGroup[] = [
  {
    id: 'filtered-empty',
    label: 'Filtered Result',
    rank: 1,
    accounts: [],
  },
];

const usageByID: Record<string, AccountUsageSummary> = {
  'acct-team-primary': healthyUsageSummary,
  'acct-relay-backup': healthyUsageSummary,
  'acct-limit-overflow': degradedUsageSummary,
  'acct-lab-disabled': degradedUsageSummary,
};

const rateLimitByID: Record<string, RateLimitState> = {
  'acct-team-primary': rateLimitStatus,
  'acct-relay-backup': rateLimitStatus,
  'acct-limit-overflow': blockedRateLimitStatus,
  'acct-lab-disabled': blockedRateLimitStatus,
};

function AccountsListSample({
  label,
  initialDisplayMode = 'full',
  initialSearchTerm = '',
  initialFilters = emptyFilters,
  initialSelectionMode = false,
  initialSelectedAccountIDs = [],
  groups = baseGroups,
  menuOpen = false,
  loading = false,
}: {
  label: string;
  initialDisplayMode?: AccountListDisplayMode;
  initialSearchTerm?: string;
  initialFilters?: AccountsFilterState;
  initialSelectionMode?: boolean;
  initialSelectedAccountIDs?: string[];
  groups?: AccountGroup[];
  menuOpen?: boolean;
  loading?: boolean;
}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState(initialFilters);
  const [displayMode, setDisplayMode] = useState<AccountListDisplayMode>(initialDisplayMode);
  const [isSelectionMode, setIsSelectionMode] = useState(initialSelectionMode);
  const [selectedAccountIDSet, setSelectedAccountIDSet] = useState(() => new Set(initialSelectedAccountIDs));
  const accountCount = groups.reduce((total, group) => total + group.accounts.length, 0);
  const allFilteredSelected = accountCount > 0 && selectedAccountIDSet.size === accountCount;

  function toggleSelection(accountID: string) {
    setSelectedAccountIDSet((current) => {
      const next = new Set(current);
      if (next.has(accountID)) {
        next.delete(accountID);
      } else {
        next.add(accountID);
      }
      return next;
    });
  }

  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 bg-[var(--bg-surface)] p-5">
        <AccountsListWorkbenchView
          t={t}
          accountCount={accountCount}
          ready
          loading={loading}
          isHeaderActionsMenuOpen={menuOpen}
          fileInputRef={fileInputRef}
          headerActionsMenuRef={headerActionsMenuRef}
          onUploadAccounts={() => undefined}
          onToggleMenu={() => undefined}
          onOpenPasteModal={() => undefined}
          onOpenApiKeyModal={() => undefined}
          onOpenRotationModal={() => undefined}
          onStartCodexOAuth={() => undefined}
          onRefresh={() => undefined}
          onOpenUnifiedCompose={() => undefined}
          searchTerm={searchTerm}
          filters={filters}
          isSelectionMode={isSelectionMode}
          allFilteredSelected={allFilteredSelected}
          selectedAccountCount={selectedAccountIDSet.size}
          displayMode={displayMode}
          onSearchChange={setSearchTerm}
          onFiltersChange={setFilters}
          onDisplayModeChange={setDisplayMode}
          onToggleSelectionMode={() => setIsSelectionMode((prev) => !prev)}
          onToggleSelectAllFiltered={() => {
            if (allFilteredSelected) {
              setSelectedAccountIDSet(new Set());
              return;
            }
            setSelectedAccountIDSet(new Set(groups.flatMap((group) => group.accounts.map((account) => account.id))));
          }}
          onClearSelection={() => setSelectedAccountIDSet(new Set())}
          onExportSelected={() => undefined}
          groups={groups}
          renderAccount={(account) => (
            <AccountCard
              key={account.id}
              t={t}
              account={account}
              usageSummary={usageByID[account.id]}
              rateLimitStatus={rateLimitByID[account.id]}
              density={displayMode}
              ready
              isSelectionMode={isSelectionMode}
              isSelected={selectedAccountIDSet.has(account.id)}
              isPendingDelete={false}
              isOAuthPending={false}
              isStatusPending={false}
              onToggleSelection={toggleSelection}
              onOpenDetails={() => undefined}
              onRefreshQuota={() => undefined}
              onStartReauth={() => undefined}
              onToggleDisabled={() => undefined}
              onRequestDelete={() => undefined}
              onCancelDelete={() => undefined}
              onConfirmDelete={() => undefined}
              downloadAuthFile={async () => ({ contentBase64: 'eyJ0eXBlIjoic3RvcnkifQ=' })}
            />
          )}
          emptyContent={
            <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] p-10 text-center">
              <p className="text-sm font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                No matching accounts
              </p>
              <p className="mt-2 text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Search and filters are preserved while the list renders an empty group.
              </p>
            </div>
          }
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function AccountsListOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">账号列表</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          账号列表整体进入设计系统：页头、搜索筛选、密度切换、分组容器和真实账号卡片用同一组 mock 组合验收。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Workbench states</h3>
        <div className="grid gap-5">
          <AccountsListSample label="DS-ACCOUNTS-LIST-FULL" />
          <AccountsListSample label="DS-ACCOUNTS-LIST-COMPACT" initialDisplayMode="compact" initialSearchTerm="relay" />
          <AccountsListSample
            label="DS-ACCOUNTS-LIST-SELECTION"
            initialDisplayMode="list"
            initialSelectionMode
            initialSelectedAccountIDs={['acct-team-primary', 'acct-limit-overflow']}
          />
          <AccountsListSample
            label="DS-ACCOUNTS-LIST-EMPTY"
            initialSearchTerm="missing key"
            initialFilters={activeFilters}
            groups={emptyGroups}
          />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountsListOverview />,
};

export const Full: Story = {
  render: () => <AccountsListSample label="DS-ACCOUNTS-LIST-FULL" />,
};

export const Compact: Story = {
  render: () => <AccountsListSample label="DS-ACCOUNTS-LIST-COMPACT" initialDisplayMode="compact" initialSearchTerm="relay" />,
};

export const Selection: Story = {
  render: () => (
    <AccountsListSample
      label="DS-ACCOUNTS-LIST-SELECTION"
      initialDisplayMode="list"
      initialSelectionMode
      initialSelectedAccountIDs={['acct-team-primary', 'acct-limit-overflow']}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <AccountsListSample
      label="DS-ACCOUNTS-LIST-EMPTY"
      initialSearchTerm="missing key"
      initialFilters={activeFilters}
      groups={emptyGroups}
    />
  ),
};
