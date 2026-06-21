import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { Download, MoreVertical, Power, RefreshCw, SlidersHorizontal, Trash2, X } from 'lucide-react';
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
const accountsToolbarMenuDividerClass = 'grid gap-2 border-y border-[var(--gt-border-subtle)] py-2';
const accountsToolbarMenuFooterClass = 'flex justify-end border-t border-[var(--gt-border-subtle)] pt-2';
const accountsToolbarModeOptionClass = (active: boolean) =>
  `min-h-9 rounded border px-2 text-left text-xs font-normal leading-none transition-colors ${
    active
      ? 'border-[var(--gt-accent-primary)] bg-[var(--gt-accent-primary)] text-[var(--gt-ink-inverse)]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-secondary)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
  }`;
const accountsToolbarFilterOptionClass = (active: boolean, disabled = false) =>
  `flex min-h-9 items-center gap-2.5 rounded border px-2.5 text-xs font-normal leading-none transition-colors ${
    disabled
      ? 'cursor-not-allowed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)] opacity-50'
      : active
        ? 'border-[var(--gt-border-default)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]'
        : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-secondary)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
  }`;
const accountsToolbarPillOptionClass = (active: boolean) =>
  `h-8 min-w-16 rounded border px-2 text-xs font-normal leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? 'border-[var(--gt-accent-primary)] bg-[var(--gt-accent-primary)] text-[var(--gt-ink-inverse)]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-secondary)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
  }`;
const accountsToolbarDisplayButtonClass = (active: boolean, bordered: boolean) =>
  `h-full min-h-0 px-2.5 text-[length:var(--gt-font-size-xs)] font-normal leading-none transition-colors ${
    bordered ? 'border-r border-[var(--gt-border-subtle)]' : ''
  } ${
    active
      ? 'bg-[var(--gt-accent-primary)] text-[var(--gt-ink-inverse)]'
      : 'text-[var(--gt-ink-secondary)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
  }`;

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
        <div
          data-accounts-toolbar-controls="true"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2"
          style={{
            borderColor: 'var(--gt-border-subtle)',
            backgroundColor: 'color-mix(in srgb, var(--gt-surface-muted) 54%, transparent)',
          }}
        >
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)]"
            >
              <SlidersHorizontal size={13} strokeWidth={2} />
              <span>{buildToolbarFilterLabel(t, filterSummaryParts)}</span>
            </button>
            {isMenuOpen ? (
              <div
                className="absolute left-0 top-full z-20 mt-2 flex min-w-[460px] max-w-[min(680px,calc(100vw-3rem))] flex-col gap-3.5 rounded-lg border p-4"
                data-accounts-toolbar-filter-menu="quiet"
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
                  <div className={accountsToolbarMenuDividerClass}>
                    <p className="px-1 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                      {t('accounts.filter_active_conditions')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filterSummaryParts.map((part, index) => (
                        <button
                          key={`${part.kind}-${part.label}-${index}`}
                          type="button"
                          onClick={() => removeFilterPart(index)}
                          className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded border px-2 text-xs font-normal"
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
                  <p className="text-xs font-normal" style={{ color: 'var(--gt-ink-muted)' }}>
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
                <div className={accountsToolbarMenuFooterClass}>
                  <Button
                    size="small"
                    htmlType="button"
                    onClick={() => onFiltersChange({ ...defaultAccountsFilterState })}
                  >
                    {t('accounts.filter_reset')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          {filterSummaryParts.length > 0 ? (
            <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1">
              {filterSummaryParts.map((part, index) => (
                <button
                  key={`${part.kind}-${part.label}-${index}`}
                  type="button"
                  onClick={() => removeFilterPart(index)}
                  className="inline-flex h-8 max-w-[210px] items-center gap-1.5 rounded-md border px-2 text-xs font-normal text-[var(--gt-ink-primary)] hover:bg-[var(--gt-status-danger)] hover:text-[var(--gt-ink-inverse)]"
                  style={{ borderColor: 'var(--gt-border-default)', backgroundColor: 'var(--gt-surface-muted)' }}
                  title={t('accounts.filter_remove_condition')}
                >
                  <span className="truncate">{part.label}</span>
                  <X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-stretch justify-end gap-1.5">
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
              className="grid h-8 shrink-0 grid-cols-2 overflow-hidden rounded-md border"
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
            <button
              onClick={onToggleSelectionMode}
              className="flex h-8 items-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)]"
            >
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
        <p className="px-1 text-xs font-normal" style={{ color: 'var(--gt-ink-muted)' }}>
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
            <div className="text-xs font-normal text-[var(--gt-status-danger)]">
              {t('accounts.bulk_remove_confirm')} · {selectedAccountCount}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="small"
                htmlType="button"
                onClick={() => setIsBulkDeleteConfirming(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="small"
                danger
                htmlType="button"
                onClick={() => {
                  setIsBulkDeleteConfirming(false);
                  setIsBulkMenuOpen(false);
                  onDeleteSelected?.();
                }}
                disabled={bulkActionPending !== null || !onDeleteSelected}
              >
                {bulkActionPending === 'delete' ? t('common.loading') : t('accounts.bulk_remove_confirm_action')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderBulkRefreshAction() {
    return (
      <Button
        size="small"
        htmlType="button"
        onClick={handleRefreshSelected}
        disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onRefreshSelected}
        icon={<RefreshCw size={14} strokeWidth={3} />}
      >
        {bulkActionPending === 'refresh' ? t('common.loading') : t('accounts.bulk_refresh_selected')}
      </Button>
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
        <span className="mr-1 flex h-10 shrink-0 items-center px-3 text-sm font-normal" style={{ color: 'var(--gt-ink-primary)' }}>
          {selectedAccountCount} {t('accounts.selected_count')}
        </span>
        <Button size="small" htmlType="button">
          {t('accounts.cancel_selection')}
        </Button>
        <Button size="small" htmlType="button">
          {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
        </Button>
        <Button size="small" htmlType="button">
          {t('accounts.clear_selection')}
        </Button>
        {renderInlineBulkActions()}
      </div>
      <span className="mr-1 flex h-10 shrink-0 items-center px-3 text-sm font-normal" style={{ color: 'var(--gt-ink-primary)' }}>
        {selectedAccountCount} {t('accounts.selected_count')}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Button size="small" onClick={handleCancelSelection}>
          {t('accounts.cancel_selection')}
        </Button>
        <Button size="small" onClick={onToggleSelectAllFiltered}>
          {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
        </Button>
        <Button
          size="small"
          onClick={onClearSelection}
          disabled={selectedAccountCount === 0}
        >
          {t('accounts.clear_selection')}
        </Button>
      </div>
      <div ref={bulkMenuRef} className="relative ml-auto flex shrink-0 items-center gap-2">
        {useBulkActionMenu ? (
          <>
            {renderBulkRefreshAction()}
            <Button
              size="small"
              htmlType="button"
              aria-expanded={isBulkMenuOpen}
              aria-label={t('common.more_actions')}
              title={t('common.more_actions')}
              onClick={() => {
                setIsBulkMenuOpen((prev) => !prev);
                setIsBulkDeleteConfirming(false);
              }}
              disabled={selectedAccountCount === 0 || bulkActionPending !== null}
              icon={<MoreVertical size={18} strokeWidth={3} />}
            >
            </Button>
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
    <Button
      size="small"
      htmlType="button"
      onClick={onClick}
      disabled={disabled}
      danger={tone === 'danger'}
      icon={icon}
    >
      <span className="whitespace-nowrap">{label}</span>
    </Button>
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
    <Button
      size="small"
      htmlType="button"
      onClick={onClick}
      disabled={disabled}
      danger={tone === 'danger'}
      icon={icon}
      block
    >
      <span className="truncate">{label}</span>
    </Button>
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
        className="flex h-8 items-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)]"
      >
        {label} · {activeLabel}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-3 grid min-w-[220px] gap-2 rounded-lg border p-3"
          style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}>
          <p className="px-1 text-xs font-normal" style={{ color: 'var(--gt-ink-muted)' }}>
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
              className={accountsToolbarModeOptionClass(optionValue === value)}
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
      className={accountsToolbarDisplayButtonClass(active, bordered)}
    >
      {children}
    </button>
  );
}

function FilterCheckOption({
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
    <label
      className={accountsToolbarFilterOptionClass(active, disabled)}
    >
      <input
        type="checkbox"
        checked={active}
        disabled={disabled}
        onChange={onClick}
        className="h-4.5 w-4.5 shrink-0 accent-[var(--gt-ink-primary)]"
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
      className={accountsToolbarPillOptionClass(active)}
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
