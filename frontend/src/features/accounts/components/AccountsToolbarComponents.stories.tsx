import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountGroupMode, AccountListDisplayMode, AccountSortMode } from '../model/accountListLayout';
import { defaultAccountsFilterState } from '../model/accountFilters';
import type { AccountsFilterState } from '../model/types';
import type { AccountPlanType } from '../../../types';
import AccountsToolbar from './AccountsToolbar';

const meta = {
  title: 'Design System/业务组件/账号工具栏',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const emptyFilters: AccountsFilterState = {
  ...defaultAccountsFilterState,
  resource: {
    ...defaultAccountsFilterState.resource,
    quotaAndBalance: false,
  },
};

const activeFilters: AccountsFilterState = {
  ...defaultAccountsFilterState,
  source: {
    ...defaultAccountsFilterState.source,
    authFile: false,
  },
  resource: {
    ...defaultAccountsFilterState.resource,
    noQuotaAndBalance: false,
  },
  status: {
    ...defaultAccountsFilterState.status,
    error: false,
  },
  plan: {
    ...defaultAccountsFilterState.plan,
    pro: false,
  },
};

const ALL_PLAN_TYPES: readonly AccountPlanType[] = ['pro', 'team', 'plus', 'free'];

function ToolbarViewport({
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

function AccountsToolbarSample({
  label,
  initialSearchTerm = '',
  initialFilters = defaultAccountsFilterState,
  initialSelectionMode = false,
  initialAllFilteredSelected = false,
  initialSelectedAccountCount = 0,
  initialDisplayMode = 'full',
  initialFiltersMenuOpen = false,
  availablePlanTypes = ALL_PLAN_TYPES,
}: {
  label: string;
  initialSearchTerm?: string;
  initialFilters?: AccountsFilterState;
  initialSelectionMode?: boolean;
  initialAllFilteredSelected?: boolean;
  initialSelectedAccountCount?: number;
  initialDisplayMode?: AccountListDisplayMode;
  initialFiltersMenuOpen?: boolean;
  availablePlanTypes?: readonly AccountPlanType[];
}) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState(initialFilters);
  const [isSelectionMode, setIsSelectionMode] = useState(initialSelectionMode);
  const [allFilteredSelected, setAllFilteredSelected] = useState(initialAllFilteredSelected);
  const [selectedAccountCount, setSelectedAccountCount] = useState(initialSelectedAccountCount);
  const [displayMode, setDisplayMode] = useState<AccountListDisplayMode>(initialDisplayMode);
  const [groupMode, setGroupMode] = useState<AccountGroupMode>('plan');
  const [sortMode, setSortMode] = useState<AccountSortMode>('priority');

  return (
    <ToolbarViewport label={label}>
      <AccountsToolbar
        t={t}
        searchTerm={searchTerm}
        filters={filters}
        isSelectionMode={isSelectionMode}
        allFilteredSelected={allFilteredSelected}
        selectedAccountCount={selectedAccountCount}
        displayMode={displayMode}
        groupMode={groupMode}
        sortMode={sortMode}
        availablePlanTypes={availablePlanTypes}
        onSearchChange={setSearchTerm}
        onFiltersChange={setFilters}
        onDisplayModeChange={setDisplayMode}
        onGroupModeChange={setGroupMode}
        onSortModeChange={setSortMode}
        onToggleSelectionMode={() => setIsSelectionMode((prev) => !prev)}
        onToggleSelectAllFiltered={() => {
          setAllFilteredSelected((prev) => !prev);
          setSelectedAccountCount((prev) => (prev > 0 ? 0 : 8));
        }}
        onClearSelection={() => {
          setAllFilteredSelected(false);
          setSelectedAccountCount(0);
        }}
        onExportSelected={() => undefined}
        initialFiltersMenuOpen={initialFiltersMenuOpen}
      />
    </ToolbarViewport>
  );
}

function AccountsToolbarOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">账号工具栏</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          账号工作台搜索、筛选、视图切换和批量选择工具栏进入设计系统，用固定状态覆盖普通态、筛选菜单和批量操作栏。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Toolbar states</h3>
        <div className="grid gap-4">
          <AccountsToolbarSample label="DS-ACCOUNTS-TOOLBAR-DEFAULT" />
          <AccountsToolbarSample
            label="DS-ACCOUNTS-TOOLBAR-FILTERS-OPEN"
            initialSearchTerm="team relay"
            initialFilters={activeFilters}
            initialFiltersMenuOpen
            availablePlanTypes={['free', 'plus']}
          />
          <AccountsToolbarSample
            label="DS-ACCOUNTS-TOOLBAR-SELECTION-EMPTY"
            initialSelectionMode
          />
          <AccountsToolbarSample
            label="DS-ACCOUNTS-TOOLBAR-SELECTION-BULK"
            initialSelectionMode
            initialAllFilteredSelected
            initialSelectedAccountCount={8}
            initialDisplayMode="list"
          />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <AccountsToolbarOverview />,
};

export const Default: Story = {
  render: () => <AccountsToolbarSample label="DS-ACCOUNTS-TOOLBAR-DEFAULT" />,
};

export const FiltersOpen: Story = {
  render: () => (
    <AccountsToolbarSample
      label="DS-ACCOUNTS-TOOLBAR-FILTERS-OPEN"
      initialSearchTerm="team relay"
      initialFilters={activeFilters}
      initialFiltersMenuOpen
    />
  ),
};
