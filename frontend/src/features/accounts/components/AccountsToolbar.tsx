import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Download, MoreVertical, Power, RefreshCw, Trash2 } from 'lucide-react';
import SearchInput from '../../../components/ui/SearchInput';
import { applyAccountsFilterState, defaultAccountsFilterState, summarizeAccountsFilterState } from '../model/accountFilters';
import type { AccountPlanType } from '../../../types';
import {
  shouldUseAccountsSelectionActionMenu,
  type AccountGroupMode,
  type AccountListDisplayMode,
  type AccountSortMode,
} from '../model/accountListLayout';
import type { AccountsFilterState, Translator } from '../model/types';
import type { AccountBulkActionID } from '../model/accountSelection';

const DEFAULT_AVAILABLE_PLAN_TYPES: readonly AccountPlanType[] = [];

interface AccountsToolbarProps {
  t: Translator;
  searchTerm: string;
  filters: AccountsFilterState;
  isSelectionMode: boolean;
  allFilteredSelected: boolean;
  selectedAccountCount: number;
  bulkActionPending?: AccountBulkActionID | null;
  displayMode: AccountListDisplayMode;
  groupMode: AccountGroupMode;
  sortMode: AccountSortMode;
  availablePlanTypes?: readonly AccountPlanType[];
  planAvailabilityResolved?: boolean;
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
  initialFiltersMenuOpen?: boolean;
  renderSelectionActions?: boolean;
}

interface AccountsSelectionActionsProps {
  t: Translator;
  allFilteredSelected: boolean;
  selectedAccountCount: number;
  bulkActionPending?: AccountBulkActionID | null;
  onToggleSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onExportSelected: () => void;
  onRefreshSelected?: () => void;
  onEnableSelected?: () => void;
  onDisableSelected?: () => void;
  onDeleteSelected?: () => void;
}

export default function AccountsToolbar({
  t,
  searchTerm,
  filters,
  isSelectionMode,
  allFilteredSelected,
  selectedAccountCount,
  bulkActionPending = null,
  displayMode,
  groupMode,
  sortMode,
  availablePlanTypes = DEFAULT_AVAILABLE_PLAN_TYPES,
  planAvailabilityResolved = true,
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
  initialFiltersMenuOpen = false,
  renderSelectionActions = true,
}: AccountsToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(initialFiltersMenuOpen);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sourceAllSelected = filters.source.authFile && filters.source.apiKey;
  const resourceAllSelected = filters.resource.hasLongestQuota && filters.resource.hasBalance;
  const statusAllSelected = filters.status.error && filters.status.disabled && filters.status.requestable;
  const planOptions = availablePlanTypes;
  const planAllSelected = areAllPlanOptionsSelected(filters.plan, planOptions);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isMenuOpen]);

  function setSourceOption(key: keyof AccountsFilterState['source']) {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        source: {
          ...filters.source,
          [key]: !filters.source[key],
        },
      }),
    );
  }

  function setResourceOption(key: keyof AccountsFilterState['resource']) {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        resource: {
          ...filters.resource,
          [key]: !filters.resource[key],
        },
      }),
    );
  }

  function setStatusOption(key: keyof AccountsFilterState['status']) {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        status: {
          ...filters.status,
          [key]: !filters.status[key],
        },
      }),
    );
  }

  function setPlanOption(key: AccountPlanType) {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        plan: {
          ...filters.plan,
          [key]: !isPlanOptionSelected(filters.plan, key),
        },
      }),
    );
  }

  function enableAllSourceOptions() {
    if (sourceAllSelected) {
      return;
    }
    onFiltersChange(
      applyAccountsFilterState(filters, {
        source: {
          authFile: true,
          apiKey: true,
        },
      }),
    );
  }

  function enableAllResourceOptions() {
    if (resourceAllSelected) {
      return;
    }
    onFiltersChange(
      applyAccountsFilterState(filters, {
        resource: {
          hasLongestQuota: true,
          hasBalance: true,
        },
      }),
    );
  }

  function enableAllStatusOptions() {
    if (statusAllSelected) {
      return;
    }
    onFiltersChange(
      applyAccountsFilterState(filters, {
        status: {
          error: true,
          disabled: true,
          requestable: true,
        },
      }),
    );
  }

  function enableAllPlanOptions() {
    if (planAllSelected) {
      return;
    }
    onFiltersChange(
      applyAccountsFilterState(filters, {
        plan: Object.fromEntries(planOptions.map((planType) => [planType, true])),
      }),
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex w-full items-center">
          <SearchInput value={searchTerm} onChange={onSearchChange} placeholder={t('accounts.search_placeholder')} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]"
            >
              {buildToolbarFilterLabel(t, filters, planOptions)}
            </button>
            {isMenuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 flex min-w-[360px] flex-col gap-3.5 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[4px_4px_0_var(--shadow-color)]">
                <div className="space-y-2">
                  <p className="text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_source')}
                  </p>
                  <div className="grid gap-1">
                    <FilterCheckOption active={sourceAllSelected} onClick={enableAllSourceOptions}>
                      {t('accounts.filter_all')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.source.authFile} onClick={() => setSourceOption('authFile')}>
                      {t('accounts.source_auth_file')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.source.apiKey} onClick={() => setSourceOption('apiKey')}>
                      {t('accounts.source_api_key')}
                    </FilterCheckOption>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_resource')}
                  </p>
                  <div className="grid gap-1">
                    <FilterCheckOption active={resourceAllSelected} onClick={enableAllResourceOptions}>
                      {t('accounts.filter_all')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.resource.hasLongestQuota} onClick={() => setResourceOption('hasLongestQuota')}>
                      {t('accounts.filter_longest_quota_match')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.resource.hasBalance} onClick={() => setResourceOption('hasBalance')}>
                      {t('accounts.filter_balance_match')}
                    </FilterCheckOption>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_status')}
                  </p>
                  <div className="grid gap-1">
                    <FilterCheckOption active={statusAllSelected} onClick={enableAllStatusOptions}>
                      {t('accounts.filter_all')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.status.error} onClick={() => setStatusOption('error')}>
                      {t('accounts.filter_error_match')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.status.disabled} onClick={() => setStatusOption('disabled')}>
                      {t('accounts.filter_disabled_match')}
                    </FilterCheckOption>
                    <FilterCheckOption active={filters.status.requestable} onClick={() => setStatusOption('requestable')}>
                      {t('accounts.filter_requestable_match')}
                    </FilterCheckOption>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_plan')}
                  </p>
                  <div className="grid gap-1">
                    <FilterCheckOption active={planAllSelected} disabled={planOptions.length === 0 && !planAvailabilityResolved} onClick={enableAllPlanOptions}>
                      {t('accounts.filter_all')}
                    </FilterCheckOption>
                    {planOptions.map((planType) => (
                      <FilterCheckOption
                        key={planType}
                        active={isPlanOptionSelected(filters.plan, planType)}
                        uppercase={false}
                        onClick={() => setPlanOption(planType)}
                      >
                        {formatAccountPlanLabel(planType)}
                      </FilterCheckOption>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end border-t border-dashed border-[var(--border-color)] pt-2">
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...defaultAccountsFilterState })}
                    className="btn-swiss h-9 !px-2.5 !py-1 !text-[length:var(--font-size-ui-md-compact)]"
                  >
                    {t('accounts.filter_reset')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-stretch justify-end gap-2">
            <ToolbarModeMenu
              label={t('accounts.group_mode_label')}
              value={groupMode}
              options={[
                ['plan', t('accounts.group_mode_plan')],
                ['source', t('accounts.group_mode_source')],
                ['status', t('accounts.group_mode_status')],
                ['provider', t('accounts.group_mode_provider')],
                ['resource', t('accounts.group_mode_resource')],
              ]}
              onChange={(value) => onGroupModeChange(value as AccountGroupMode)}
            />
            <ToolbarModeMenu
              label={t('accounts.sort_mode_label')}
              value={sortMode}
              options={[
                ['priority', t('accounts.sort_mode_priority')],
                ['name', t('accounts.sort_mode_name')],
                ['status', t('accounts.sort_mode_status')],
                ['quota', t('accounts.sort_mode_quota')],
                ['reset', t('accounts.sort_mode_reset')],
              ]}
              onChange={(value) => onSortModeChange(value as AccountSortMode)}
            />
            <div
              className="grid h-10 shrink-0 grid-cols-3 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
              data-account-card-ignore-click="true"
            >
              <DisplayModeButton active={displayMode === 'full'} bordered onClick={() => onDisplayModeChange('full')}>
                {t('accounts.display_mode_full')}
              </DisplayModeButton>
              <DisplayModeButton active={displayMode === 'compact'} bordered onClick={() => onDisplayModeChange('compact')}>
                {t('accounts.display_mode_compact')}
              </DisplayModeButton>
              <DisplayModeButton active={displayMode === 'list'} onClick={() => onDisplayModeChange('list')}>
                {t('accounts.display_mode_list')}
              </DisplayModeButton>
            </div>
            <button onClick={onToggleSelectionMode} className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm-plus)]">
              {isSelectionMode ? t('accounts.unselect_all') : t('accounts.selection_mode')}
            </button>
          </div>
        </div>
        {isSelectionMode && renderSelectionActions ? (
          <AccountsSelectionActions
            t={t}
            allFilteredSelected={allFilteredSelected}
            selectedAccountCount={selectedAccountCount}
            bulkActionPending={bulkActionPending}
            onToggleSelectAllFiltered={onToggleSelectAllFiltered}
            onClearSelection={onClearSelection}
            onExportSelected={onExportSelected}
            onRefreshSelected={onRefreshSelected}
            onEnableSelected={onEnableSelected}
            onDisableSelected={onDisableSelected}
            onDeleteSelected={onDeleteSelected}
          />
        ) : null}
      </div>
    </section>
  );
}

export function AccountsSelectionActions({
  t,
  allFilteredSelected,
  selectedAccountCount,
  bulkActionPending = null,
  onToggleSelectAllFiltered,
  onClearSelection,
  onExportSelected,
  onRefreshSelected,
  onEnableSelected,
  onDisableSelected,
  onDeleteSelected,
}: AccountsSelectionActionsProps) {
  const [isBulkDeleteConfirming, setIsBulkDeleteConfirming] = useState(false);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [useBulkActionMenu, setUseBulkActionMenu] = useState(false);
  const selectionActionsRef = useRef<HTMLDivElement | null>(null);
  const inlineActionsMeasureRef = useRef<HTMLDivElement | null>(null);
  const bulkMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedAccountCount === 0) {
      setIsBulkDeleteConfirming(false);
      setIsBulkMenuOpen(false);
    }
  }, [selectedAccountCount]);

  useEffect(() => {
    if (!isBulkMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!bulkMenuRef.current?.contains(event.target as Node)) {
        setIsBulkMenuOpen(false);
        setIsBulkDeleteConfirming(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsBulkMenuOpen(false);
        setIsBulkDeleteConfirming(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isBulkMenuOpen]);

  useEffect(() => {
    const toolbar = selectionActionsRef.current;
    const measure = inlineActionsMeasureRef.current;
    if (!toolbar || !measure) {
      return;
    }
    const toolbarElement = toolbar;
    const measureElement = measure;

    function updateActionLayout() {
      const containerWidth = Math.ceil(toolbarElement.getBoundingClientRect().width);
      const fullInlineWidth = Math.ceil(measureElement.getBoundingClientRect().width);
      setUseBulkActionMenu(shouldUseAccountsSelectionActionMenu(containerWidth, fullInlineWidth));
    }

    updateActionLayout();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateActionLayout);
      return () => {
        window.removeEventListener('resize', updateActionLayout);
      };
    }

    const observer = new ResizeObserver(updateActionLayout);
    observer.observe(toolbarElement);
    observer.observe(measureElement);
    return () => {
      observer.disconnect();
    };
  }, [allFilteredSelected, bulkActionPending, selectedAccountCount, t]);

  function handleRefreshSelected() {
    setIsBulkDeleteConfirming(false);
    onRefreshSelected?.();
  }

  function handleExportSelected() {
    setIsBulkMenuOpen(false);
    onExportSelected();
  }

  function handleEnableSelected() {
    setIsBulkMenuOpen(false);
    setIsBulkDeleteConfirming(false);
    onEnableSelected?.();
  }

  function handleDisableSelected() {
    setIsBulkMenuOpen(false);
    setIsBulkDeleteConfirming(false);
    onDisableSelected?.();
  }

  function handleOpenDeleteConfirm() {
    setIsBulkMenuOpen(true);
    setIsBulkDeleteConfirming(true);
  }

  function renderBulkMenu() {
    return (
      <div className="absolute right-0 top-full z-30 mt-3 grid min-w-[240px] gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[8px_8px_0_var(--shadow-color)]">
        <p className="px-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {t('common.more_actions')}
        </p>
        <BulkMenuAction
          icon={<Download size={14} strokeWidth={3} />}
          label={t('accounts.export_selected')}
          disabled={selectedAccountCount === 0}
          onClick={handleExportSelected}
        />
        <BulkMenuAction
          icon={<Power size={14} strokeWidth={3} />}
          label={bulkActionPending === 'enable' ? t('common.loading') : t('accounts.bulk_enable_selected')}
          disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onEnableSelected}
          onClick={handleEnableSelected}
        />
        <BulkMenuAction
          icon={<Power size={14} strokeWidth={3} />}
          label={bulkActionPending === 'disable' ? t('common.loading') : t('accounts.bulk_disable_selected')}
          disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onDisableSelected}
          onClick={handleDisableSelected}
        />
        <BulkMenuAction
          icon={<Trash2 size={14} strokeWidth={3} />}
          label={t('accounts.bulk_remove_selected')}
          tone="danger"
          disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onDeleteSelected}
          onClick={handleOpenDeleteConfirm}
        />

        {isBulkDeleteConfirming ? (
          <div className="mt-1 grid gap-2 border-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] p-2">
            <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--color-status-danger)]">
              {t('accounts.bulk_remove_confirm')} · {selectedAccountCount}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirming(false)}
                className="btn-swiss !px-2 !py-2 !text-[length:var(--font-size-ui-2xs)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBulkDeleteConfirming(false);
                  setIsBulkMenuOpen(false);
                  onDeleteSelected?.();
                }}
                disabled={bulkActionPending !== null || !onDeleteSelected}
                className="btn-swiss !px-2 !py-2 !text-[length:var(--font-size-ui-2xs)] !text-[var(--color-status-danger)]"
              >
                {bulkActionPending === 'delete' ? t('common.loading') : t('accounts.bulk_remove_confirm_action')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderBulkRefreshAction() {
    return (
      <button
        type="button"
        onClick={handleRefreshSelected}
        disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onRefreshSelected}
        className="btn-swiss flex h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]"
      >
        <RefreshCw size={14} strokeWidth={3} />
        {bulkActionPending === 'refresh' ? t('common.loading') : t('accounts.bulk_refresh_selected')}
      </button>
    );
  }

  function renderInlineBulkActions() {
    return (
      <>
        {renderBulkRefreshAction()}
        <BulkInlineAction
          icon={<Download size={14} strokeWidth={3} />}
          label={t('accounts.export_selected')}
          disabled={selectedAccountCount === 0}
          onClick={handleExportSelected}
        />
        <BulkInlineAction
          icon={<Power size={14} strokeWidth={3} />}
          label={bulkActionPending === 'enable' ? t('common.loading') : t('accounts.bulk_enable_selected')}
          disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onEnableSelected}
          onClick={handleEnableSelected}
        />
        <BulkInlineAction
          icon={<Power size={14} strokeWidth={3} />}
          label={bulkActionPending === 'disable' ? t('common.loading') : t('accounts.bulk_disable_selected')}
          disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onDisableSelected}
          onClick={handleDisableSelected}
        />
        <BulkInlineAction
          icon={<Trash2 size={14} strokeWidth={3} />}
          label={t('accounts.bulk_remove_selected')}
          tone="danger"
          disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onDeleteSelected}
          onClick={handleOpenDeleteConfirm}
        />
      </>
    );
  }

  return (
    <div ref={selectionActionsRef} className="relative flex min-h-12 flex-wrap items-center gap-2">
      <div
        ref={inlineActionsMeasureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 flex w-max items-center gap-2 opacity-0"
        style={{ visibility: 'hidden' }}
      >
        <span className="mr-1 flex h-10 shrink-0 items-center border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">
          {selectedAccountCount} {t('accounts.selected_count')}
        </span>
        <button type="button" className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
        </button>
        <button type="button" className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {t('accounts.clear_selection')}
        </button>
        {renderInlineBulkActions()}
      </div>
      <span className="mr-1 flex h-10 shrink-0 items-center border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">
        {selectedAccountCount} {t('accounts.selected_count')}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <button onClick={onToggleSelectAllFiltered} className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
        </button>
        <button
          onClick={onClearSelection}
          className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]"
          disabled={selectedAccountCount === 0}
        >
          {t('accounts.clear_selection')}
        </button>
      </div>
      <div ref={bulkMenuRef} className="relative ml-auto flex shrink-0 items-center gap-2">
        {useBulkActionMenu ? (
          <>
            {renderBulkRefreshAction()}
            <button
              type="button"
              aria-expanded={isBulkMenuOpen}
              aria-label={t('common.more_actions')}
              title={t('common.more_actions')}
              onClick={() => {
                setIsBulkMenuOpen((prev) => !prev);
                setIsBulkDeleteConfirming(false);
              }}
              disabled={selectedAccountCount === 0 || bulkActionPending !== null}
              className="btn-swiss flex h-10 w-10 items-center justify-center !p-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MoreVertical size={18} strokeWidth={3} />
            </button>
          </>
        ) : (
          renderInlineBulkActions()
        )}
        {isBulkMenuOpen ? renderBulkMenu() : null}
      </div>
    </div>
  );
}

function BulkInlineAction({
  icon,
  label,
  disabled = false,
  tone = 'default',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-swiss flex h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger' ? '!text-[var(--color-status-danger)]' : ''
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function BulkMenuAction({
  icon,
  label,
  disabled = false,
  tone = 'default',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn-swiss flex h-9 w-full items-center justify-start gap-2 !px-2.5 !py-2 !text-left !text-[length:var(--font-size-ui-2xs)] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger' ? '!text-[var(--color-status-danger)]' : ''
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ToolbarModeMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeLabel = options.find(([optionValue]) => optionValue === value)?.[1] || value;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm-plus)]"
      >
        {label} · {activeLabel}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-3 grid min-w-[220px] gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[8px_8px_0_var(--shadow-color)]">
          <p className="px-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {label}
          </p>
          {options.map(([optionValue, optionLabel]) => (
            <button
              key={optionValue}
              type="button"
              aria-pressed={optionValue === value}
              onClick={() => {
                onChange(optionValue);
                setOpen(false);
              }}
              className={`min-h-9 border-2 border-[var(--border-color)] px-2 text-left text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none tracking-[0.1em] ${
                optionValue === value
                  ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
                  : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
            >
              {optionLabel}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DisplayModeButton({
  active,
  bordered = false,
  children,
  onClick,
}: {
  active: boolean;
  bordered?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full min-h-0 px-3 text-[length:var(--font-size-ui-sm-plus)] font-black uppercase leading-none tracking-[0.12em] ${
        bordered ? 'border-r border-[var(--border-color)]' : ''
      } ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

function FilterCheckOption({
  active,
  children,
  disabled = false,
  uppercase = true,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  uppercase?: boolean;
  onClick: () => void;
}) {
  return (
    <label
      className={`flex min-h-9 cursor-pointer items-center gap-2.5 px-2.5 text-[length:var(--font-size-ui-md-compact)] font-black leading-none tracking-[0.06em] ${
        uppercase ? 'uppercase' : ''
      } ${
        disabled
          ? 'cursor-not-allowed bg-[var(--bg-main)] text-[var(--text-muted)] opacity-50'
          : active
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
            : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      <input
        type="checkbox"
        checked={active}
        disabled={disabled}
        onChange={onClick}
        className="h-4.5 w-4.5 shrink-0 accent-[var(--text-primary)]"
      />
      <span className="block min-w-0 truncate">{children}</span>
    </label>
  );
}

function buildToolbarFilterLabel(t: Translator, filters: AccountsFilterState, availablePlanTypes: readonly AccountPlanType[]) {
  const parts = summarizeAccountsFilterState(t, filters, availablePlanTypes);

  if (parts.length === 0) {
    return t('accounts.display_filters');
  }
  return `${t('accounts.display_filters')} · ${parts.map((part) => part.label).join(' · ')}`;
}

function isPlanOptionSelected(selection: AccountsFilterState['plan'], planType: AccountPlanType) {
  return selection[planType] !== false;
}

function areAllPlanOptionsSelected(selection: AccountsFilterState['plan'], availablePlanTypes: readonly AccountPlanType[]) {
  if (availablePlanTypes.length === 0) {
    return true;
  }
  return availablePlanTypes.every((planType) => isPlanOptionSelected(selection, planType));
}

function formatAccountPlanLabel(planType: AccountPlanType) {
  return planType
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
