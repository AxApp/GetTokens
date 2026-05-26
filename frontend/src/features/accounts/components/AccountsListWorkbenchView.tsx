import type { MutableRefObject, ReactNode } from 'react';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroupMode, AccountSortMode } from '../model/accountListLayout';
import type { AccountGroup, AccountRecord, AccountsFilterState, Translator } from '../model/types';
import type { AccountBulkActionID } from '../model/accountSelection';
import type { AccountPlanType } from '../../../types';
import AccountGroupSectionView from './AccountGroupSectionView';
import AccountsHeader from './AccountsHeader';
import AccountsToolbar from './AccountsToolbar';

interface AccountsListWorkbenchViewProps {
  t: Translator;
  accountCount: number;
  ready: boolean;
  loading: boolean;
  isHeaderActionsMenuOpen: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
  onUploadAccounts: (files: FileList | null) => Promise<void> | void;
  onToggleMenu: () => void;
  onOpenPasteModal: () => void;
  onOpenApiKeyModal: () => void;
  onOpenRotationModal?: () => void;
  onStartCodexOAuth: () => void;
  onRefresh: () => void;
  onOpenUnifiedCompose?: () => void;
  searchTerm: string;
  filters: AccountsFilterState;
  isSelectionMode: boolean;
  allFilteredSelected: boolean;
  selectedAccountCount: number;
  bulkActionPending?: AccountBulkActionID | null;
  displayMode: AccountListDisplayMode;
  groupMode: AccountGroupMode;
  sortMode: AccountSortMode;
  onSearchChange: (value: string) => void;
  onFiltersChange: (value: AccountsFilterState) => void;
  onDisplayModeChange: (value: AccountListDisplayMode) => void;
  onGroupModeChange: (value: AccountGroupMode) => void;
  onSortModeChange: (value: AccountSortMode) => void;
  onToggleSelectionMode: () => void;
  onToggleSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onExportSelected: () => void;
  onRefreshSelected?: () => void;
  onEnableSelected?: () => void;
  onDisableSelected?: () => void;
  onDeleteSelected?: () => void;
  availablePlanTypes?: readonly AccountPlanType[];
  planAvailabilityResolved?: boolean;
  groups: AccountGroup[];
  renderAccount: (account: AccountRecord) => ReactNode;
  emptyContent?: ReactNode;
}

export default function AccountsListWorkbenchView({
  t,
  accountCount,
  ready,
  loading,
  isHeaderActionsMenuOpen,
  fileInputRef,
  headerActionsMenuRef,
  onUploadAccounts,
  onToggleMenu,
  onOpenPasteModal,
  onOpenApiKeyModal,
  onOpenRotationModal,
  onStartCodexOAuth,
  onRefresh,
  onOpenUnifiedCompose,
  searchTerm,
  filters,
  isSelectionMode,
  allFilteredSelected,
  selectedAccountCount,
  bulkActionPending,
  displayMode,
  groupMode,
  sortMode,
  onSearchChange,
  onFiltersChange,
  onDisplayModeChange,
  onGroupModeChange,
  onSortModeChange,
  onToggleSelectionMode,
  onToggleSelectAllFiltered,
  onClearSelection,
  onExportSelected,
  onRefreshSelected,
  onEnableSelected,
  onDisableSelected,
  onDeleteSelected,
  availablePlanTypes,
  planAvailabilityResolved,
  groups,
  renderAccount,
  emptyContent = null,
}: AccountsListWorkbenchViewProps) {
  return (
    <div className="grid gap-6">
      <AccountsHeader
        t={t}
        accountCount={accountCount}
        ready={ready}
        loading={loading}
        isHeaderActionsMenuOpen={isHeaderActionsMenuOpen}
        fileInputRef={fileInputRef}
        headerActionsMenuRef={headerActionsMenuRef}
        onUploadAccounts={onUploadAccounts}
        onToggleMenu={onToggleMenu}
        onOpenPasteModal={onOpenPasteModal}
        onOpenApiKeyModal={onOpenApiKeyModal}
        onOpenRotationModal={onOpenRotationModal}
        onStartCodexOAuth={onStartCodexOAuth}
        onRefresh={onRefresh}
        onOpenUnifiedCompose={onOpenUnifiedCompose}
      />

      <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <AccountsToolbar
          t={t}
          searchTerm={searchTerm}
          filters={filters}
          isSelectionMode={isSelectionMode}
          allFilteredSelected={allFilteredSelected}
          selectedAccountCount={selectedAccountCount}
          bulkActionPending={bulkActionPending}
          displayMode={displayMode}
          groupMode={groupMode}
          sortMode={sortMode}
          availablePlanTypes={availablePlanTypes}
          planAvailabilityResolved={planAvailabilityResolved}
          onSearchChange={onSearchChange}
          onFiltersChange={onFiltersChange}
          onDisplayModeChange={onDisplayModeChange}
          onGroupModeChange={onGroupModeChange}
          onSortModeChange={onSortModeChange}
          onToggleSelectionMode={onToggleSelectionMode}
          onToggleSelectAllFiltered={onToggleSelectAllFiltered}
          onClearSelection={onClearSelection}
          onExportSelected={onExportSelected}
          onRefreshSelected={onRefreshSelected}
          onEnableSelected={onEnableSelected}
          onDisableSelected={onDisableSelected}
          onDeleteSelected={onDeleteSelected}
        />
      </div>

      <div className="grid gap-8">
        {groups.map((group) => (
          <AccountGroupSectionView
            key={group.id}
            t={t}
            group={group}
            displayMode={displayMode}
            renderAccount={renderAccount}
            emptyContent={emptyContent}
          />
        ))}
      </div>
    </div>
  );
}
