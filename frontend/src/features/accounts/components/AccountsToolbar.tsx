import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Popconfirm, Popover, Segmented, Space, Tag, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Download, MoreVertical, Power, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
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
  const planOptions = availablePlanTypes;
  const filterSummaryParts = summarizeAccountsFilterState(t, filters, planOptions, availableRequestStatusCodes);
  const filterControlParts = summarizeAccountsFilterState((key) => key, filters, planOptions, availableRequestStatusCodes);

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
          className="flex flex-wrap items-center gap-2"
        >
          <Popover
            trigger="click"
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            placement="bottomLeft"
            arrow={false}
            overlayClassName="accounts-toolbar-filter-popover"
            content={
              <div className="flex flex-col gap-3.5">
                <div className="grid gap-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
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
                  <div className="grid gap-2 border-y border-[var(--gt-border-subtle)] py-2">
                    <p className="text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
                      {t('accounts.filter_active_conditions')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filterSummaryParts.map((part, index) => (
                        <Tag
                          key={`${part.kind}-${part.label}-${index}`}
                          closable
                          onClose={(e) => { e.preventDefault(); removeFilterPart(index); }}
                          color="blue"
                          className="m-0"
                        >
                          {part.label}
                        </Tag>
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
                      <p className="col-span-3 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
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
                        <p className="col-span-2 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
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
                    <p className="col-span-2 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
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
                      <p className="col-span-2 text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
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
                  <p className="text-xs font-semibold" style={{ color: 'var(--gt-ink-muted)' }}>
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
                <div className="flex justify-end border-t border-[var(--gt-border-subtle)] pt-2">
                  <Button
                    size="small"
                    htmlType="button"
                    onClick={() => onFiltersChange({ ...defaultAccountsFilterState })}
                  >
                    {t('accounts.filter_reset')}
                  </Button>
                </div>
              </div>
            }
          >
            <Button
              size="small"
              icon={<SlidersHorizontal size={13} strokeWidth={2} />}
            >
              {buildToolbarFilterLabel(t, filterSummaryParts)}
            </Button>
          </Popover>
          {filterSummaryParts.length > 0 ? (
            <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-1">
              {filterSummaryParts.map((part, index) => (
                <Tag
                  key={`${part.kind}-${part.label}-${index}`}
                  closable
                  onClose={(e) => { e.preventDefault(); removeFilterPart(index); }}
                  color="blue"
                  className="m-0 max-w-[210px]"
                  title={t('accounts.filter_remove_condition')}
                >
                  <span className="truncate">{part.label}</span>
                </Tag>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
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
            <Segmented
              value={displayMode}
              onChange={(value) => onDisplayModeChange(value as AccountListDisplayMode)}
              options={[
                { label: t('accounts.display_mode_full'), value: 'full' },
                { label: t('accounts.display_mode_list'), value: 'list' },
              ]}
              className="!h-8"
              style={{ backgroundColor: 'var(--gt-surface-canvas)' }}
              data-account-card-ignore-click="true"
            />
            <Button
              size="small"
              onClick={onToggleSelectionMode}
            >
              {isSelectionMode ? t('accounts.cancel_selection') : t('accounts.selection_mode')}
            </Button>
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
  const [useBulkActionMenu, setUseBulkActionMenu] = useState(false);
  const selectionActionsRef = useRef<HTMLDivElement | null>(null);
  const inlineActionsMeasureRef = useRef<HTMLDivElement | null>(null);


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
    onRefreshSelected?.();
  }

  function handleCancelSelection() {
    onCancelSelection?.();
  }

  function handleExportSelected() {
    onExportSelected();
  }

  function handleEnableSelected() {
    onEnableSelected?.();
  }

  function handleDisableSelected() {
    onDisableSelected?.();
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
        <Popconfirm
          title={t('accounts.bulk_remove_confirm')}
          description={`${t('accounts.bulk_remove_confirm')} · ${selectedAccountCount}`}
          onConfirm={onDeleteSelected}
          okText={bulkActionPending === 'delete' ? t('common.loading') : t('accounts.bulk_remove_confirm_action')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true, disabled: bulkActionPending !== null || !onDeleteSelected }}
        >
          <BulkInlineAction
            icon={<Trash2 size={14} strokeWidth={3} />}
            label={t('accounts.bulk_remove_selected')}
            tone="danger"
            disabled={selectedAccountCount === 0 || bulkActionPending !== null || !onDeleteSelected}
            onClick={() => {}}
          />
        </Popconfirm>
      </>
    );
  }

  const bulkMenuItems: MenuProps['items'] = [
    {
      key: 'export',
      icon: <Download size={14} />,
      label: t('accounts.export_selected'),
      disabled: selectedAccountCount === 0,
      onClick: handleExportSelected,
    },
    {
      key: 'enable',
      icon: <Power size={14} />,
      label: bulkActionPending === 'enable' ? t('common.loading') : t('accounts.bulk_enable_selected'),
      disabled: selectedAccountCount === 0 || bulkActionPending !== null || !onEnableSelected,
      onClick: handleEnableSelected,
    },
    {
      key: 'disable',
      icon: <Power size={14} />,
      label: bulkActionPending === 'disable' ? t('common.loading') : t('accounts.bulk_disable_selected'),
      disabled: selectedAccountCount === 0 || bulkActionPending !== null || !onDisableSelected,
      onClick: handleDisableSelected,
    },
  ];

  return (
    <div ref={selectionActionsRef} className="relative flex min-h-10 flex-wrap items-center gap-2">
      <div
        ref={inlineActionsMeasureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 flex w-max items-center gap-2 opacity-0"
        style={{ visibility: 'hidden' }}
      >
        <Tag>{selectedAccountCount} {t('accounts.selected_count')}</Tag>
        <Button size="small">{t('accounts.cancel_selection')}</Button>
        <Button size="small">{allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}</Button>
        <Button size="small">{t('accounts.clear_selection')}</Button>
        {renderInlineBulkActions()}
      </div>
      <Tag>{selectedAccountCount} {t('accounts.selected_count')}</Tag>
      <Space size={4} wrap>
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
      </Space>
      <div className="relative ml-auto flex shrink-0 items-center gap-2">
        {useBulkActionMenu ? (
          <>
            {renderBulkRefreshAction()}
            <Dropdown
              menu={{ items: bulkMenuItems }}
              trigger={['click']}
            >
              <Tooltip title={t('common.more_actions')}>
                <Button
                  size="small"
                  htmlType="button"
                  aria-label={t('common.more_actions')}
                  disabled={selectedAccountCount === 0 || bulkActionPending !== null}
                  icon={<MoreVertical size={18} strokeWidth={3} />}
                />
              </Tooltip>
            </Dropdown>
          </>
        ) : (
          renderInlineBulkActions()
        )}
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
  const activeLabel = options.find(([optionValue]) => optionValue === value)?.[1] || value;
  const menuItems: MenuProps['items'] = options.map(([optionValue, optionLabel]) => ({
    key: optionValue,
    label: optionLabel,
    onClick: () => onChange(optionValue),
  }));

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']}>
      <Button size="small">
        {label} · {activeLabel}
      </Button>
    </Dropdown>
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
    <Button
      size="small"
      type={active ? 'primary' : 'default'}
      disabled={disabled}
      onClick={onClick}
      className="m-0 justify-start"
    >
      <span className="block min-w-0 truncate">{children}</span>
    </Button>
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
    <Button
      size="small"
      type={active ? 'primary' : 'default'}
      disabled={disabled}
      onClick={onClick}
      className="m-0"
    >
      <span className="block truncate">{children}</span>
    </Button>
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
