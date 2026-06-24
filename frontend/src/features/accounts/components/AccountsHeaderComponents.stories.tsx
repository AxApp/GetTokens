import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import AccountsHeader from './AccountsHeader';

const meta = {
  title: 'Design System/业务组件/账号页头',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function HeaderViewport({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-5">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function AccountsHeaderSample({
  label,
  accountCount = 12,
  ready = true,
  loading = false,
  menuOpen = false,
  unifiedCompose = false,
  rotation = true,
}: {
  label: string;
  accountCount?: number;
  ready?: boolean;
  loading?: boolean;
  menuOpen?: boolean;
  unifiedCompose?: boolean;
  rotation?: boolean;
}) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement | null>(null);
  return (
    <HeaderViewport label={label}>
      <AccountsHeader
        t={t}
        accountCount={accountCount}
        ready={ready}
        loading={loading}
        isHeaderActionsMenuOpen={menuOpen}
        headerActionsMenuRef={menuRef}
        onToggleMenu={() => undefined}
        onOpenImportModal={() => undefined}
        onOpenApiKeyModal={() => undefined}
        onOpenRotationModal={rotation ? () => undefined : undefined}
        onStartCodexOAuth={() => undefined}
        onRefreshAccounts={() => undefined}
        onRefreshRuntime={() => undefined}
        onOpenUnifiedCompose={unifiedCompose ? () => undefined : undefined}
      />
    </HeaderViewport>
  );
}

function AccountsHeaderOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">账号页头</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          账号页头进入设计系统后，用固定 mock 检查 WorkspacePageHeader、刷新按钮和统一收敛后的添加菜单。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Header states</h3>
        <div className="grid gap-4">
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-DEFAULT" />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-LOADING" loading />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-MENU" menuOpen unifiedCompose />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-NOT-READY" ready={false} accountCount={0} />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-MENU-ADD" menuOpen unifiedCompose rotation={false} />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountsHeaderOverview />,
};

export const Default: Story = {
  render: () => <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-DEFAULT" />,
};

export const MenuOpen: Story = {
  render: () => <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-MENU" menuOpen unifiedCompose />,
};
