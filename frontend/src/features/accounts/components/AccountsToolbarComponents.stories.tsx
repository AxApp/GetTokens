import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountsFilterState } from '../model/types';
import AccountsToolbar from './AccountsToolbar';

const meta = {
  title: 'Design System/Feature Components/Accounts Toolbar',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const emptyFilters: AccountsFilterState = {
  hasLongestQuota: false,
  errorsOnly: false,
};

const activeFilters: AccountsFilterState = {
  hasLongestQuota: true,
  errorsOnly: true,
};

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
  initialFilters = emptyFilters,
  initialSelectionMode = false,
  initialAllFilteredSelected = false,
  initialSelectedAccountCount = 0,
  initialDisplayMode = 'full',
  initialFiltersMenuOpen = false,
}: {
  label: string;
  initialSearchTerm?: string;
  initialFilters?: AccountsFilterState;
  initialSelectionMode?: boolean;
  initialAllFilteredSelected?: boolean;
  initialSelectedAccountCount?: number;
  initialDisplayMode?: AccountListDisplayMode;
  initialFiltersMenuOpen?: boolean;
}) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState(initialFilters);
  const [isSelectionMode, setIsSelectionMode] = useState(initialSelectionMode);
  const [allFilteredSelected, setAllFilteredSelected] = useState(initialAllFilteredSelected);
  const [selectedAccountCount, setSelectedAccountCount] = useState(initialSelectedAccountCount);
  const [displayMode, setDisplayMode] = useState<AccountListDisplayMode>(initialDisplayMode);

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
        onSearchChange={setSearchTerm}
        onFiltersChange={setFilters}
        onDisplayModeChange={setDisplayMode}
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
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Accounts Toolbar</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          账号工作台搜索、筛选、密度切换和批量选择工具栏进入设计系统，用固定状态覆盖普通态、筛选菜单和批量操作栏。
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
          />
          <AccountsToolbarSample
            label="DS-ACCOUNTS-TOOLBAR-SELECTION-EMPTY"
            initialSelectionMode
            initialDisplayMode="compact"
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
