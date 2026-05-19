import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountRecord } from '../model/types';
import AccountCardFrame from './AccountCardFrame';
import AccountGroupSectionView from './AccountGroupSectionView';

const meta = {
  title: 'Design System/Feature Components/Account Group Sections',
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
          <p className="mt-1 truncate text-[0.625rem] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {account.email || account.keyFingerprint || account.id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="border border-[var(--border-color)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {account.provider}
          </span>
          <span className="border border-[var(--border-color)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {account.planType}
          </span>
          {account.disabled ? (
            <span className="border border-red-500 bg-red-500/10 px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-red-500">
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
        renderAccount={(account) => <MockAccountCard key={account.id} account={account} displayMode={displayMode} />}
        emptyContent={
          <div className="border-2 border-dashed border-[var(--border-color)] p-8 text-center text-[0.625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            No accounts in this group
          </div>
        }
      />
    </GroupViewport>
  );
}

function AccountGroupSectionOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Account Group Sections</h2>
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
