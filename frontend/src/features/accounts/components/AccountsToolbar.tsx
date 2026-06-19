import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Download, MoreVertical, Power, RefreshCw, Trash2, X } from 'lucide-react';
import SearchInput from '../../../components/ui/SearchInput';
import {
  applyAccountsFilterState,
  buildAccountsFilterPresetState,
  defaultAccountsFilterState,
  removeAccountsFilterSummaryPart,
  summarizeAccountsFilterState,
  type AccountsFilterPresetID,
} from '../model/accountFilters';
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
  availableRequestStatusCodes?: readonly string[];
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
  onCancelSelection?: () => void;
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
  availableRequestStatusCodes = [],
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
  const planOptions = availablePlanTypes;
  const filterSummaryParts = summarizeAccountsFilterState(t, filters, planOptions, availableRequestStatusCodes);
  const filterControlParts = summarizeAccountsFilterState((key) => key, filters, planOptions, availableRequestStatusCodes);

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

  function setFilterPreset(preset: AccountsFilterPresetID) {
    onFiltersChange(buildAccountsFilterPresetState(preset, filters, availableRequestStatusCodes));
  }

  function removeFilterPart(index: number) {
    const controlPart = filterControlParts[index];
    if (!controlPart) {
      return;
    }
    onFiltersChange(removeAccountsFilterSummaryPart(filters, controlPart, planOptions, availableRequestStatusCodes));
  }

  function setSourceMode(mode: 'all' | keyof AccountsFilterState['source']) {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        source: {
          authFile: mode === 'all' || mode === 'authFile',
          apiKey: mode === 'all' || mode === 'apiKey',
        },
      }),
    );
  }

  function setResourceFacetMode(
    positiveKey: keyof AccountsFilterState['resource'],
    negativeKey: keyof AccountsFilterState['resource'],
    mode: 'all' | 'positive' | 'negative',
  ) {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        resource: {
          [positiveKey]: mode === 'all' || mode === 'positive',
          [negativeKey]: mode === 'all' || mode === 'negative',
        },
      }),
    );
  }

  function setStatusOption(key: 'error' | 'disabled' | 'requestable') {
    onFiltersChange(
      applyAccountsFilterState(filters, {
        status: {
          ...filters.status,
          [key]: !filters.status[key],
        },
      }),
    );
  }

  function setStatusRequestCodeOption(statusCode: string) {
    const nextRequestStatusCodes = { ...filters.status.requestStatusCodes };
    if (nextRequestStatusCodes[statusCode] === true) {
      delete nextRequestStatusCodes[statusCode];
    } else {
      nextRequestStatusCodes[statusCode] = true;
    }

    onFiltersChange(
      applyAccountsFilterState(filters, {
        status: {
          requestStatusCodes: nextRequestStatusCodes,
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
              className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]"
            >
              {buildToolbarFilterLabel(t, filterSummaryParts)}
            </button>
            {isMenuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 flex min-w-[460px] max-w-[min(680px,calc(100vw-3rem))] flex-col gap-3.5 rounded-lg border p-4"
                style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}>
                <div className="grid gap-2">
                  <p className="px-1 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                    {t('accounts.filter_group_presets')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterPillOption active={filterSummaryParts.length === 0} onClick={() => setFilterPreset('all')}>
                      {t('accounts.filter_preset_all')}
                    </FilterPillOption>
                    <FilterPillOption active={isAvailablePresetActive(filters)} onClick={() => setFilterPreset('available')}>
                      {t('accounts.filter_preset_available')}
                    </FilterPillOption>
                    <FilterPillOption active={isAttentionPresetActive(filters, availableRequestStatusCodes)} onClick={() => setFilterPreset('attention')}>
                      {t('accounts.filter_preset_attention')}
                    </FilterPillOption>
                    <FilterPillOption active={isHTTPErrorPresetActive(filters, availableRequestStatusCodes)} onClick={() => setFilterPreset('http-errors')}>
                      {t('accounts.filter_preset_http_errors')}
                    </FilterPillOption>
                    <FilterPillOption active={filters.resource.hasQuota && !filters.resource.noQuota} onClick={() => setFilterPreset('with-quota')}>
                      {t('accounts.filter_preset_with_quota')}
                    </FilterPillOption>
                    <FilterPillOption active={!filters.source.authFile && filters.source.apiKey} onClick={() => setFilterPreset('api-key')}>
                      {t('accounts.filter_preset_api_key')}
                    </FilterPillOption>
                  </div>
                </div>
                {filterSummaryParts.length > 0 ? (
                  <div className="grid gap-2 border-y border-dashed border-[var(--border-color)] py-2">
                    <p className="px-1 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                      {t('accounts.filter_active_conditions')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filterSummaryParts.map((part, index) => (
                        <button
                          key={`${part.kind}-${part.label}-${index}`}
                          type="button"
                          onClick={() => removeFilterPart(index)}
                          className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded border px-2 text-xs font-medium"
                          style={{ borderColor: 'var(--gt-accent-primary)', backgroundColor: 'var(--gt-accent-primary)', color: 'var(--gt-ink-inverse)' }}
                          title={t('accounts.filter_remove_condition')}
                        >
                          <span className="truncate">{part.label}</span>
                          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--gt-ink-muted)' }}>
                    {t('accounts.filter_group_plan_source')}
                  </p>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 gap-1">
                      <p className="col-span-3 px-2.5 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                        {t('accounts.filter_group_source')}
                      </p>
                      <FilterPillOption active={filters.source.authFile && filters.source.apiKey} onClick={() => setSourceMode('all')}>
                        {t('accounts.filter_option_all')}
                      </FilterPillOption>
                      <FilterPillOption active={filters.source.authFile && !filters.source.apiKey} onClick={() => setSourceMode('authFile')}>
                        {t('accounts.source_auth_file')}
                      </FilterPillOption>
                      <FilterPillOption active={!filters.source.authFile && filters.source.apiKey} onClick={() => setSourceMode('apiKey')}>
                        {t('accounts.source_api_key')}
                      </FilterPillOption>
                    </div>
                    {planOptions.length > 0 || !planAvailabilityResolved ? (
                      <div className="grid grid-cols-2 gap-1">
                        <p className="col-span-2 px-2.5 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                          {t('accounts.filter_group_plan')}
                        </p>
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
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1">
                    <p className="col-span-2 px-2.5 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                      {t('accounts.filter_group_status')}
                    </p>
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
                  {availableRequestStatusCodes.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      <p className="col-span-2 px-2.5 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                        {t('accounts.filter_group_request_status')}
                      </p>
                      {availableRequestStatusCodes.map((statusCode) => (
                        <FilterCheckOption
                          key={statusCode}
                          active={filters.status.requestStatusCodes[statusCode] === true}
                          uppercase={false}
                          onClick={() => setStatusRequestCodeOption(statusCode)}
                        >
                          {`HTTP ${statusCode}`}
                        </FilterCheckOption>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="px-2.5 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                    {t('accounts.filter_group_other')}
                  </p>
                  <FilterTernaryOptionRow
                    title={t('accounts.filter_group_quota')}
                    allLabel={t('accounts.filter_option_all')}
                    positiveLabel={t('accounts.filter_has_quota_match')}
                    negativeLabel={t('accounts.filter_no_quota_match')}
                    mode={resolveBinaryFacetMode(filters.resource.hasQuota, filters.resource.noQuota)}
                    onChange={(mode) => setResourceFacetMode('hasQuota', 'noQuota', mode)}
                  />
                  <FilterTernaryOptionRow
                    title={t('accounts.filter_group_balance')}
                    allLabel={t('accounts.filter_option_all')}
                    positiveLabel={t('accounts.filter_has_balance_match')}
                    negativeLabel={t('accounts.filter_no_balance_match')}
                    mode={resolveBinaryFacetMode(filters.resource.hasBalance, filters.resource.noBalance)}
                    onChange={(mode) => setResourceFacetMode('hasBalance', 'noBalance', mode)}
                  />
                  <FilterTernaryOptionRow
                    title={t('accounts.filter_group_today_usage')}
                    allLabel={t('accounts.filter_option_all')}
                    positiveLabel={t('accounts.filter_usage_today_match')}
                    negativeLabel={t('accounts.filter_no_usage_today_match')}
                    mode={resolveBinaryFacetMode(filters.resource.hasUsageToday, filters.resource.noUsageToday)}
                    onChange={(mode) => setResourceFacetMode('hasUsageToday', 'noUsageToday', mode)}
                  />
                </div>
                <div className="flex justify-end border-t border-dashed border-[var(--border-color)] pt-2">
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...defaultAccountsFilterState })}
                    className="parchment-toolbar-action-secondary h-9 !px-2.5 !py-1 !text-[length:var(--font-size-ui-md-compact)]"
                  >
                    {t('accounts.filter_reset')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {filterSummaryParts.length > 0 ? (
            <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1.5">
              {filterSummaryParts.map((part, index) => (
                <button
                  key={`${part.kind}-${part.label}-${index}`}
                  type="button"
                  onClick={() => removeFilterPart(index)}
                  className="inline-flex h-9 max-w-[210px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium text-[var(--gt-ink-primary)] hover:bg-[var(--gt-status-danger)] hover:text-white"
                  style={{ borderColor: 'var(--gt-border-default)', backgroundColor: 'var(--gt-surface-muted)' }}
                  title={t('accounts.filter_remove_condition')}
                >
                  <span className="truncate">{part.label}</span>
                  <X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                </button>
              ))}
            </div>
          ) : null}
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
              className="grid h-10 shrink-0 grid-cols-2 overflow-hidden rounded-md border"
              style={{ borderColor: 'var(--gt-border-default)', backgroundColor: 'var(--gt-surface-canvas)' }}
              data-account-card-ignore-click="true"
            >
              <DisplayModeButton active={displayMode === 'full'} bordered onClick={() => onDisplayModeChange('full')}>
                {t('accounts.display_mode_full')}
              </DisplayModeButton>
              <DisplayModeButton active={displayMode === 'list'} onClick={() => onDisplayModeChange('list')}>
                {t('accounts.display_mode_list')}
              </DisplayModeButton>
            </div>
            <button onClick={onToggleSelectionMode} className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm-plus)]">
              {isSelectionMode ? t('accounts.cancel_selection') : t('accounts.selection_mode')}
            </button>
          </div>
        </div>
        {isSelectionMode && renderSelectionActions ? (
          <AccountsSelectionActions
            t={t}
            allFilteredSelected={allFilteredSelected}
            selectedAccountCount={selectedAccountCount}
            bulkActionPending={bulkActionPending}
            onCancelSelection={onToggleSelectionMode}
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
  onCancelSelection,
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

  function handleCancelSelection() {
    setIsBulkMenuOpen(false);
    setIsBulkDeleteConfirming(false);
    onCancelSelection?.();
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
      <div className="absolute right-0 top-full z-30 mt-3 grid min-w-[240px] gap-2 rounded-lg border p-3"
        style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}>
        <p className="px-1 text-xs font-medium" style={{ color: 'var(--gt-ink-muted)' }}>
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
          <div className="mt-1 grid gap-2 rounded border p-2" style={{ borderColor: 'var(--gt-status-danger)', backgroundColor: 'color-mix(in srgb, var(--gt-status-danger) 10%, transparent)' }}>
            <div className="text-xs font-medium text-[var(--gt-status-danger)]">
              {t('accounts.bulk_remove_confirm')} · {selectedAccountCount}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirming(false)}
                className="parchment-toolbar-action-secondary !px-2 !py-2 !text-[length:var(--font-size-ui-2xs)]"
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
                className="parchment-toolbar-action-secondary !px-2 !py-2 !text-[length:var(--font-size-ui-2xs)] !text-[var(--gt-status-danger)]"
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
        className="parchment-toolbar-action-secondary flex h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]"
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
        <span className="mr-1 flex h-10 shrink-0 items-center px-3 text-sm font-medium" style={{ color: 'var(--gt-ink-primary)' }}>
          {selectedAccountCount} {t('accounts.selected_count')}
        </span>
        <button type="button" className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {t('accounts.cancel_selection')}
        </button>
        <button type="button" className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
        </button>
        <button type="button" className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {t('accounts.clear_selection')}
        </button>
        {renderInlineBulkActions()}
      </div>
      <span className="mr-1 flex h-10 shrink-0 items-center px-3 text-sm font-medium" style={{ color: 'var(--gt-ink-primary)' }}>
        {selectedAccountCount} {t('accounts.selected_count')}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <button onClick={handleCancelSelection} className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {t('accounts.cancel_selection')}
        </button>
        <button onClick={onToggleSelectAllFiltered} className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]">
          {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
        </button>
        <button
          onClick={onClearSelection}
          className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-md)]"
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
              className="parchment-toolbar-action-secondary flex h-10 w-10 items-center justify-center !p-0 disabled:cursor-not-allowed disabled:opacity-50"
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
      className={`parchment-toolbar-action-secondary flex h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger' ? '!text-[var(--gt-status-danger)]' : ''
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
      className={`parchment-toolbar-action-secondary flex h-9 w-full items-center justify-start gap-2 !px-2.5 !py-2 !text-left !text-[length:var(--font-size-ui-2xs)] disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger' ? '!text-[var(--gt-status-danger)]' : ''
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
        className="parchment-toolbar-action-secondary h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm-plus)]"
      >
        {label} · {activeLabel}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-3 grid min-w-[220px] gap-2 rounded-lg border p-3"
          style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}>
          <p className="px-1 text-xs font-medium" style={{ color: 'var(--gt-ink-muted)' }}>
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
              className={`min-h-9 rounded border px-2 text-left text-xs font-medium leading-none ${
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
      className={`h-full min-h-0 px-3 text-sm font-medium leading-none ${
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
      className={`flex min-h-9 cursor-pointer items-center gap-2.5 px-2.5 text-xs font-medium leading-none ${
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

function FilterPillOption({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 min-w-16 rounded border px-2 text-xs font-medium leading-none disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}

function FilterTernaryOptionRow({
  title,
  allLabel,
  positiveLabel,
  negativeLabel,
  mode,
  onChange,
}: {
  title: string;
  allLabel: string;
  positiveLabel: string;
  negativeLabel: string;
  mode: 'all' | 'positive' | 'negative';
  onChange: (mode: 'all' | 'positive' | 'negative') => void;
}) {
  return (
    <div className="grid gap-1">
      <p className="px-2.5 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
        {title}
      </p>
      <div className="grid grid-cols-3 gap-1">
        <FilterPillOption active={mode === 'all'} onClick={() => onChange('all')}>
          {allLabel}
        </FilterPillOption>
        <FilterPillOption active={mode === 'positive'} onClick={() => onChange('positive')}>
          {positiveLabel}
        </FilterPillOption>
        <FilterPillOption active={mode === 'negative'} onClick={() => onChange('negative')}>
          {negativeLabel}
        </FilterPillOption>
      </div>
    </div>
  );
}

function buildToolbarFilterLabel(t: Translator, parts: readonly unknown[]) {
  if (parts.length === 0) {
    return t('accounts.display_filters');
  }
  return `${t('accounts.display_filters')} · ${parts.length}`;
}

function isPlanOptionSelected(selection: AccountsFilterState['plan'], planType: AccountPlanType) {
  return selection[planType] !== false;
}

function formatAccountPlanLabel(planType: AccountPlanType) {
  return planType
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function resolveBinaryFacetMode(positiveSelected: boolean, negativeSelected: boolean): 'all' | 'positive' | 'negative' {
  if (positiveSelected && !negativeSelected) {
    return 'positive';
  }
  if (!positiveSelected && negativeSelected) {
    return 'negative';
  }
  return 'all';
}

function isAvailablePresetActive(filters: AccountsFilterState) {
  return !filters.status.error && !filters.status.disabled && filters.status.requestable && Object.keys(filters.status.requestStatusCodes).length === 0;
}

function isAttentionPresetActive(filters: AccountsFilterState, availableRequestStatusCodes: readonly string[]) {
  return (
    filters.status.error &&
    filters.status.disabled &&
    !filters.status.requestable &&
    selectedRequestStatusCodesMatch(filters, availableRequestStatusCodes)
  );
}

function isHTTPErrorPresetActive(filters: AccountsFilterState, availableRequestStatusCodes: readonly string[]) {
  return (
    filters.status.error &&
    !filters.status.disabled &&
    !filters.status.requestable &&
    selectedRequestStatusCodesMatch(filters, availableRequestStatusCodes)
  );
}

function selectedRequestStatusCodesMatch(filters: AccountsFilterState, availableRequestStatusCodes: readonly string[]) {
  const selected = Object.keys(filters.status.requestStatusCodes).sort();
  const available = Array.from(new Set(availableRequestStatusCodes)).sort();
  if (available.length === 0) {
    return selected.length === 0;
  }
  return selected.length === available.length && selected.every((code, index) => code === available[index]);
}
