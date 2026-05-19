import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import AccountsHeader from './AccountsHeader';

const meta = {
  title: 'Design System/Feature Components/Accounts Header',
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
      <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-5">
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  return (
    <HeaderViewport label={label}>
      <AccountsHeader
        t={t}
        accountCount={accountCount}
        ready={ready}
        loading={loading}
        isHeaderActionsMenuOpen={menuOpen}
        fileInputRef={fileInputRef}
        headerActionsMenuRef={menuRef}
        onUploadAccounts={() => undefined}
        onToggleMenu={() => undefined}
        onOpenPasteModal={() => undefined}
        onOpenApiKeyModal={() => undefined}
        onOpenRotationModal={rotation ? () => undefined : undefined}
        onStartCodexOAuth={() => undefined}
        onRefresh={() => undefined}
        onOpenUnifiedCompose={unifiedCompose ? () => undefined : undefined}
      />
    </HeaderViewport>
  );
}

function AccountsHeaderOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Accounts Header</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          账号页头进入设计系统后，用固定 mock 检查 WorkspacePageHeader、刷新按钮、导入菜单和统一新增入口。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Header states</h3>
        <div className="grid gap-4">
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-DEFAULT" />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-LOADING" loading />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-MENU" menuOpen unifiedCompose />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-NOT-READY" ready={false} accountCount={0} />
          <AccountsHeaderSample label="DS-ACCOUNTS-HEADER-UNIFIED-COMPOSE" unifiedCompose rotation={false} />
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
