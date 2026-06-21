import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import DesignSystemStoryFrame from '../../../design-system/DesignSystemStoryFrame';
import type { AccountRecord } from '../../../../types';
import { RotationConfigSection } from './RotationConfigSection';
import { RotationPriorityItem } from './RotationPriorityItem';

const meta = {
  title: 'Design System/业务组件/账号轮换',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;
type RoutingDraft = Parameters<typeof RotationConfigSection>[0]['routingDraft'];

const accounts: AccountRecord[] = [
  {
    id: 'auth-file:team-codex',
    provider: 'codex',
    credentialSource: 'auth-file',
    displayName: 'team-codex@example.com',
    email: 'team-codex@example.com',
    status: 'active',
    priority: 30,
    quotaKey: 'team-codex',
  },
  {
    id: 'codex-api-key:local-relay',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Local Relay Key',
    status: 'configured',
    priority: 20,
    keySuffix: '8F21',
  },
  {
    id: 'auth-file:disabled-backup',
    provider: 'codex',
    credentialSource: 'auth-file',
    displayName: 'disabled-backup@example.com',
    email: 'disabled-backup@example.com',
    status: 'active',
    priority: 10,
    disabled: true,
  },
];

const routingDraft = {
  strategy: 'round-robin',
  sessionAffinity: true,
  sessionAffinityTTL: '1h',
  requestRetry: 2,
  maxRetryCredentials: 3,
  maxRetryInterval: 30,
  switchProject: true,
  switchPreviewModel: false,
  antigravityCredits: true,
} as RoutingDraft;

function PriorityListSample({
  dragged = '',
  pending = '',
  ready = true,
}: {
  dragged?: string;
  pending?: string;
  ready?: boolean;
}) {
  return (
    <DesignSystemStoryFrame label="DS-ORDER">
      <div className="grid gap-3">
        {accounts.map((account) => (
          <RotationPriorityItem
            key={account.id}
            account={account}
            codexQuota={undefined}
            isDragged={dragged === account.id}
            isPending={pending === account.id}
            ready={ready}
            onDragStart={() => undefined}
            onDragOver={(event) => event.preventDefault()}
            onDragEnd={() => undefined}
            onDrop={() => undefined}
            onToggleDisabled={() => undefined}
          />
        ))}
      </div>
    </DesignSystemStoryFrame>
  );
}

function ConfigSample({
  menuOpen = false,
  strategy = 'round-robin',
}: {
  menuOpen?: boolean;
  strategy?: string;
}) {
  const [draft, setDraft] = useState<RoutingDraft>({ ...routingDraft, strategy });
  const [isStrategyMenuOpen, setIsStrategyMenuOpen] = useState(menuOpen);
  const strategyMenuRef = useRef<HTMLDivElement>(null);

  return (
    <DesignSystemStoryFrame label="DS-CONFIG">
      <RotationConfigSection
        routingDraft={draft}
        setRoutingDraft={(updater) => {
          setDraft((prev) => updater(prev) || prev);
        }}
        isStrategyMenuOpen={isStrategyMenuOpen}
        setIsStrategyMenuOpen={setIsStrategyMenuOpen}
        strategyMenuRef={strategyMenuRef}
      />
    </DesignSystemStoryFrame>
  );
}

function AccountRotationOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">账号轮换</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          把账号轮换里的优先级条目和 routing 配置表单纳入设计系统，用固定账号和 routing draft 检查拖拽态、禁用态、pending 态和策略菜单。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Priority item states</h3>
        <div className="grid gap-4 xl:grid-cols-3">
          <PriorityListSample />
          <PriorityListSample dragged="codex-api-key:local-relay" />
          <PriorityListSample pending="auth-file:team-codex" ready={false} />
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Routing config states</h3>
        <div className="grid gap-4">
          <ConfigSample />
          <ConfigSample menuOpen strategy="fill-first" />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountRotationOverview />,
};

export const PriorityItems: Story = {
  render: () => <PriorityListSample />,
};

export const RoutingConfig: Story = {
  render: () => <ConfigSample menuOpen />,
};
