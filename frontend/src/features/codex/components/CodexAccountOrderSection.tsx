import { X } from 'lucide-react';
import { Button, Checkbox, Segmented } from 'antd';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import RefreshActionButton from '../../../components/ui/RefreshActionButton';
import SearchInput from '../../../components/ui/SearchInput';
import { type CodexAccountRow, type CodexRoutePolicyRowState } from '../model/codexAccountList';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import { AccountOrderRow } from './CodexAccountOrderRow';
import {
  CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE,
  DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
  applyCodexAccountOrderFilter,
  buildCodexAccountOrderFilterPresetState,
  filterCodexAccountOrderRows,
  getCodexAccountOrderGridClass,
  normalizeCodexAccountOrderFilter,
  parseCodexAccountOrderDisplayMode,
  removeCodexAccountOrderFilterSummaryPart,
  summarizeCodexAccountOrderFilter,
  type CodexAccountOrderFilterPresetID,
  type CodexAccountOrderFilter,
  type CodexAccountOrderDisplayMode,
  type CodexAccountOrderFilterSource,
} from '../model/codexAccountOrderSectionLayout';

function EmptyState({ children }: { children: string }) {
  return (
    <div className="border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-8 py-14 text-center text-[length:var(--gt-font-size-md)] font-normal text-[var(--gt-ink-muted)]">
      {children}
    </div>
  );
}

const CODEX_ACCOUNT_ORDER_SECTION_SHELL_CLASS =
  'min-w-0';
const CODEX_ACCOUNT_ORDER_SECTION_TOOLBAR_CLASS =
  'pt-4';
const CODEX_ACCOUNT_ORDER_FILTER_MENU_CLASS =
  'absolute left-0 top-full z-20 mt-2 flex min-w-[460px] max-w-[min(680px,calc(100vw-3rem))] flex-col gap-3.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 shadow-sm';
const CODEX_ACCOUNT_ORDER_FILTER_TITLE_CLASS =
  'px-1 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const CODEX_ACCOUNT_ORDER_FILTER_SECTION_TITLE_CLASS =
  'px-2.5 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const CODEX_ACCOUNT_ORDER_FILTER_SECTION_DIVIDER_CLASS =
  'grid gap-2 border-y border-[var(--gt-border-subtle)] py-2';
const CODEX_ACCOUNT_ORDER_FILTER_FOOTER_CLASS =
  'flex justify-end border-t border-[var(--gt-border-subtle)] pt-2';
const CODEX_ACCOUNT_ORDER_FILTER_OPTION_CLASS =
  'flex min-h-9 cursor-pointer items-center gap-2.5 rounded px-2.5 text-[length:var(--gt-font-size-md-compact)] font-semibold leading-none tracking-normal transition-colors';
const CODEX_ACCOUNT_ORDER_STATUS_TEXT_CLASS = (saving: boolean) =>
  `shrink-0 text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal ${
    saving ? 'text-[var(--gt-ink-muted)]' : 'text-[var(--gt-status-danger)]'
  }`;

export function CodexAccountOrderSection({
  ready,
  loading,
  saving,
  routingProbeRunning,
  orderChanged,
  rows,
  draggedID,
  pendingToggleID,
  pendingManualRequestableID,
  latestRoutingProbeAccountID,
  routePolicyRowStates,
  codexQuotaByName,
  accountUsageByID,
  usageRefreshingAccountIDSet,
  accountRateLimitByID,
  rateLimitRefreshingAccountIDSet,
  refreshLabel,
  loadingLabel,
  savingLabel,
  unsavedLabel,
  emptyLabel,
  waitingLabel,
  t,
  onReload,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragEnd,
  onDrop,
  onOpenDetail,
  onToggle,
  onToggleManualRequestable = () => undefined,
  onRefreshQuota = () => undefined,
  initialDensity,
  initialAccountFilter,
}: {
  title: string;
  hint: string;
  message?: string;
  ready: boolean;
  loading: boolean;
  saving: boolean;
  routingProbeRunning: boolean;
  orderChanged: boolean;
  rows: CodexAccountRow[];
  draggedID: string | null;
  pendingToggleID: string | null;
  pendingManualRequestableID?: string | null;
  latestRoutingProbeAccountID: string;
  routePolicyRowStates: Record<string, CodexRoutePolicyRowState>;
  codexQuotaByName: Record<string, CodexQuotaState>;
  accountUsageByID: Record<string, AccountUsageSummary>;
  usageRefreshingAccountIDSet?: ReadonlySet<string>;
  accountRateLimitByID: Record<string, RateLimitState>;
  rateLimitRefreshingAccountIDSet?: ReadonlySet<string>;
  refreshLabel: string;
  loadingLabel: string;
  savingLabel: string;
  unsavedLabel: string;
  emptyLabel: string;
  waitingLabel: string;
  t: (key: string) => string;
  onReload: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onOpenDetail: (id: string) => void;
  onToggle: (row: CodexAccountRow) => void;
  onToggleManualRequestable?: (row: CodexAccountRow) => void;
  onRefreshQuota?: (row: CodexAccountRow) => void;
  initialDensity?: CodexAccountOrderDisplayMode;
  initialAccountFilter?: CodexAccountOrderFilter | 'all';
}) {
  const [density, setDensity] = useState<CodexAccountOrderDisplayMode>(() => initialDensity ?? readInitialDensity());
  const [accountFilter, setAccountFilter] = useState<CodexAccountOrderFilter>(() => normalizeCodexAccountOrderFilter(initialAccountFilter));
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const visibleRows = filterCodexAccountOrderRows(rows, accountFilter, codexQuotaByName, accountSearchTerm, routePolicyRowStates);
  const rowOrderIndexByID = new Map(rows.map((row, index) => [row.id, index]));

  let content: ReactNode;
  if (!ready) {
    content = <EmptyState>{waitingLabel}</EmptyState>;
  } else if (loading && rows.length === 0) {
    content = <EmptyState>{loadingLabel}</EmptyState>;
  } else if (rows.length === 0) {
    content = <EmptyState>{emptyLabel}</EmptyState>;
  } else if (visibleRows.length === 0) {
    content = <EmptyState>{t('codex.account_list_filter_empty')}</EmptyState>;
  } else {
    content = (
      <div className={getCodexAccountOrderGridClass(density)}>
        {visibleRows.map((row) => {
          const rowOrderIndex = rowOrderIndexByID.get(row.id) ?? 0;
          return (
            <AccountOrderRow
              key={row.id}
              row={row}
              index={rowOrderIndex}
              density={density}
              dragged={draggedID === row.id}
              pending={pendingToggleID === row.id}
              manualPending={pendingManualRequestableID === row.id}
              t={t}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onOpenDetail={() => onOpenDetail(row.id)}
              onToggle={() => onToggle(row)}
              onToggleManualRequestable={() => onToggleManualRequestable(row)}
              probeHit={latestRoutingProbeAccountID === row.id}
              routePolicyState={routePolicyRowStates[row.id]}
              quotaState={row.quotaKey ? codexQuotaByName[row.quotaKey] : undefined}
              usageSummary={accountUsageByID[row.id]}
              usageRefreshing={usageRefreshingAccountIDSet?.has(row.id)}
              rateLimitStatus={accountRateLimitByID[row.id]}
              rateLimitRefreshing={rateLimitRefreshingAccountIDSet?.has(row.id)}
              onRefreshQuota={onRefreshQuota}
            />
          );
        })}
      </div>
    );
  }

  return (
    <section className={CODEX_ACCOUNT_ORDER_SECTION_SHELL_CLASS}>
      <InlineActionControls
        density={density}
        accountFilter={accountFilter}
        accountSearchTerm={accountSearchTerm}
        disabled={!ready}
        loading={loading}
        saving={saving}
        routingProbeRunning={routingProbeRunning}
        refreshLabel={refreshLabel}
        loadingLabel={loadingLabel}
        savingLabel={savingLabel}
        unsavedLabel={unsavedLabel}
        orderChanged={orderChanged}
        t={t}
        onReload={onReload}
        onAccountFilterChange={setAccountFilter}
        onAccountSearchChange={setAccountSearchTerm}
        onDensityChange={(nextDensity) => updateDensity(nextDensity, setDensity)}
      />

      {content}
    </section>
  );
}

function readInitialDensity(): CodexAccountOrderDisplayMode {
  if (typeof window === 'undefined') {
    return DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE;
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const hashDensity = params.get('density');
  if (hashDensity) {
    return parseCodexAccountOrderDisplayMode(hashDensity);
  }
  try {
    return parseCodexAccountOrderDisplayMode(window.localStorage.getItem(CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE;
  }
}

function updateDensity(
  density: CodexAccountOrderDisplayMode,
  setDensity: (value: CodexAccountOrderDisplayMode) => void,
) {
  setDensity(density);
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY, density);
  } catch {
    // Ignore storage failures; the hash still keeps the current session shareable.
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  if (density !== DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE) {
    params.set('density', density);
  } else {
    params.delete('density');
  }
  window.location.hash = params.toString();
}

function InlineActionControls({
  density,
  accountFilter,
  accountSearchTerm,
  disabled,
  loading,
  saving,
  routingProbeRunning,
  refreshLabel,
  loadingLabel,
  savingLabel,
  unsavedLabel,
  orderChanged,
  t,
  onReload,
  onAccountFilterChange,
  onAccountSearchChange,
  onDensityChange,
}: {
  density: CodexAccountOrderDisplayMode;
  accountFilter: CodexAccountOrderFilter;
  accountSearchTerm: string;
  disabled: boolean;
  loading: boolean;
  saving: boolean;
  routingProbeRunning: boolean;
  refreshLabel: string;
  loadingLabel: string;
  savingLabel: string;
  unsavedLabel: string;
  orderChanged: boolean;
  t: (key: string) => string;
  onReload: () => void;
  onAccountFilterChange: (filter: CodexAccountOrderFilter) => void;
  onAccountSearchChange: (value: string) => void;
  onDensityChange: (density: CodexAccountOrderDisplayMode) => void;
}) {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterSummaryParts = summarizeCodexAccountOrderFilter(t, accountFilter);
  const filterControlParts = summarizeCodexAccountOrderFilter((key) => key, accountFilter);

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  function updateFilter(patch: Partial<CodexAccountOrderFilter>) {
    onAccountFilterChange(applyCodexAccountOrderFilter(accountFilter, patch));
  }

  function setFilterPreset(preset: CodexAccountOrderFilterPresetID) {
    onAccountFilterChange(buildCodexAccountOrderFilterPresetState(preset, accountFilter));
  }

  function removeFilterPart(index: number) {
    const controlPart = filterControlParts[index];
    if (!controlPart) {
      return;
    }
    onAccountFilterChange(removeCodexAccountOrderFilterSummaryPart(accountFilter, controlPart));
  }

  function setSourceFilter(source: CodexAccountOrderFilterSource) {
    updateFilter({ source });
  }

  function toggleFilter(key: 'requiresParticipating' | 'requiresSkipped' | 'requiresRequestable' | 'requiresBlocked' | 'requiresDisabled' | 'hasBalance' | 'hasLongestQuota' | 'requiresError') {
    updateFilter({ [key]: !accountFilter[key] });
  }

  return (
    <div className={CODEX_ACCOUNT_ORDER_SECTION_TOOLBAR_CLASS}>
      <div className="flex w-full flex-wrap items-center gap-2">
        <div ref={filterMenuRef} className="relative shrink-0">
          <Button
            size="small"
            onClick={() => setIsFilterMenuOpen((prev) => !prev)}
            disabled={disabled}
            aria-expanded={isFilterMenuOpen}
          >
            {buildToolbarFilterLabel(t, filterSummaryParts)}
          </Button>
          {isFilterMenuOpen ? (
            <div className={CODEX_ACCOUNT_ORDER_FILTER_MENU_CLASS}>
              <div className="grid gap-2">
                <p className={CODEX_ACCOUNT_ORDER_FILTER_TITLE_CLASS}>
                  {t('accounts.filter_group_presets')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPillOption active={filterSummaryParts.length === 0} onClick={() => setFilterPreset('all')}>
                    {t('accounts.filter_preset_all')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.requiresParticipating && !accountFilter.requiresSkipped} onClick={() => setFilterPreset('participating')}>
                    {t('codex.account_list_filter_participating_match')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.requiresRequestable && !accountFilter.requiresBlocked && !accountFilter.requiresDisabled && !accountFilter.requiresError} onClick={() => setFilterPreset('requestable')}>
                    {t('codex.account_list_filter_requestable_match')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.requiresBlocked && !accountFilter.requiresRequestable} onClick={() => setFilterPreset('blocked')}>
                    {t('codex.account_list_filter_blocked_match')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.source === 'openai-compatible'} onClick={() => setFilterPreset('openai-compatible')}>
                    {t('codex.account_list_source_openai_compatible')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.hasBalance} onClick={() => setFilterPreset('with-balance')}>
                    {t('codex.account_list_filter_balance_match')}
                  </FilterPillOption>
                </div>
              </div>
              {filterSummaryParts.length > 0 ? (
                <div className={CODEX_ACCOUNT_ORDER_FILTER_SECTION_DIVIDER_CLASS}>
                  <p className={CODEX_ACCOUNT_ORDER_FILTER_TITLE_CLASS}>
                    {t('accounts.filter_active_conditions')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {filterSummaryParts.map((part, index) => (
                      <Button
                        key={`${part.kind}-${part.id}-${index}`}
                        size="small"
                        icon={<X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                        onClick={() => removeFilterPart(index)}
                        title={t('accounts.filter_remove_condition')}
                      >
                        <span className="truncate">{part.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <p className={`col-span-2 ${CODEX_ACCOUNT_ORDER_FILTER_SECTION_TITLE_CLASS}`}>
                    {t('codex.account_list_filter_group_route')}
                  </p>
                  <FilterCheckOption active={accountFilter.requiresParticipating} onClick={() => toggleFilter('requiresParticipating')}>
                    {t('codex.account_list_filter_participating_match')}
                  </FilterCheckOption>
                  <FilterCheckOption active={accountFilter.requiresSkipped} onClick={() => toggleFilter('requiresSkipped')}>
                    {t('codex.account_list_filter_skipped_match')}
                  </FilterCheckOption>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[length:var(--gt-font-size-md-compact)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                  {t('accounts.filter_group_plan_source')}
                </p>
                <div className="grid grid-cols-4 gap-1">
                  <p className={`col-span-4 ${CODEX_ACCOUNT_ORDER_FILTER_SECTION_TITLE_CLASS}`}>
                    {t('accounts.filter_group_source')}
                  </p>
                  <FilterPillOption active={accountFilter.source === 'all'} onClick={() => setSourceFilter('all')}>
                    {t('codex.account_list_filter_all')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.source === 'codex-auth-file'} onClick={() => setSourceFilter('codex-auth-file')}>
                    {t('codex.account_list_source_auth_file')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.source === 'codex-api-key'} onClick={() => setSourceFilter('codex-api-key')}>
                    {t('codex.account_list_source_api_key')}
                  </FilterPillOption>
                  <FilterPillOption active={accountFilter.source === 'openai-compatible'} onClick={() => setSourceFilter('openai-compatible')}>
                    {t('codex.account_list_source_openai_compatible')}
                  </FilterPillOption>
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <p className={`col-span-2 ${CODEX_ACCOUNT_ORDER_FILTER_SECTION_TITLE_CLASS}`}>
                    {t('accounts.filter_group_status')}
                  </p>
                  <FilterCheckOption active={accountFilter.requiresRequestable} onClick={() => toggleFilter('requiresRequestable')}>
                    {t('codex.account_list_filter_requestable_match')}
                  </FilterCheckOption>
                  <FilterCheckOption active={accountFilter.requiresBlocked} onClick={() => toggleFilter('requiresBlocked')}>
                    {t('codex.account_list_filter_blocked_match')}
                  </FilterCheckOption>
                  <FilterCheckOption active={accountFilter.requiresDisabled} onClick={() => toggleFilter('requiresDisabled')}>
                    {t('codex.account_list_filter_disabled_match')}
                  </FilterCheckOption>
                  <FilterCheckOption active={accountFilter.requiresError} onClick={() => toggleFilter('requiresError')}>
                    {t('codex.account_list_filter_error_match')}
                  </FilterCheckOption>
                </div>
              </div>
              <div className="space-y-2">
                <p className={CODEX_ACCOUNT_ORDER_FILTER_SECTION_TITLE_CLASS}>
                  {t('accounts.filter_group_other')}
                </p>
                <FilterBinaryOptionRow
                  title={t('accounts.filter_group_balance')}
                  allLabel={t('accounts.filter_option_all')}
                  positiveLabel={t('codex.account_list_filter_balance_match')}
                  active={accountFilter.hasBalance}
                  onChange={(active) => updateFilter({ hasBalance: active })}
                />
                <FilterBinaryOptionRow
                  title={t('codex.account_list_filter_longest_quota_match')}
                  allLabel={t('accounts.filter_option_all')}
                  positiveLabel={t('codex.account_list_filter_longest_quota_match')}
                  active={accountFilter.hasLongestQuota}
                  onChange={(active) => updateFilter({ hasLongestQuota: active })}
                />
              </div>
              <div className={CODEX_ACCOUNT_ORDER_FILTER_FOOTER_CLASS}>
                <Button
                  size="small"
                  onClick={() => onAccountFilterChange({ ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER })}
                >
                  {t('accounts.filter_reset')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <SearchInput
          value={accountSearchTerm}
          onChange={onAccountSearchChange}
          disabled={disabled}
          placeholder={t('codex.account_list_search_placeholder')}
          clearLabel={t('common.clear_search')}
          className="min-w-[18rem] flex-1"
        />
        {saving || orderChanged ? (
          <div className={CODEX_ACCOUNT_ORDER_STATUS_TEXT_CLASS(saving)}>
            {saving ? savingLabel : unsavedLabel}
          </div>
        ) : null}
        {filterSummaryParts.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {filterSummaryParts.map((part, index) => (
              <Button
                key={`${part.kind}-${part.id}-${index}`}
                size="small"
                icon={<X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                onClick={() => removeFilterPart(index)}
                title={t('accounts.filter_remove_condition')}
              >
                <span className="truncate">{part.label}</span>
              </Button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <RefreshActionButton
            onClick={onReload}
            disabled={disabled || loading || saving || routingProbeRunning}
            label={refreshLabel}
            loading={loading}
            loadingLabel={loadingLabel}
            iconOnly
            className="!min-h-10"
          />
          <Segmented
            data-codex-account-order-density-switch="true"
            value={density}
            disabled={disabled}
            onChange={(value) => onDensityChange(value as CodexAccountOrderDisplayMode)}
            options={[
              { label: t('codex.account_list_density_full'), value: 'full' },
              { label: t('codex.account_list_density_list'), value: 'list' },
            ]}
            className="!h-10 !bg-[var(--gt-surface-canvas)]"
          />
        </div>
      </div>
    </div>
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
      className={`${CODEX_ACCOUNT_ORDER_FILTER_OPTION_CLASS} ${
        disabled
          ? 'cursor-not-allowed bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)] opacity-50'
          : active
            ? 'bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]'
            : 'bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
      }`}
    >
      <Checkbox
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
    <Button
      size="small"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`${active
        ? 'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
        : 'bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)] hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
      }`}
    >
      <span className="block truncate">{children}</span>
    </Button>
  );
}

function FilterBinaryOptionRow({
  title,
  allLabel,
  positiveLabel,
  active,
  onChange,
}: {
  title: string;
  allLabel: string;
  positiveLabel: string;
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <div className="grid gap-1">
      <p className={CODEX_ACCOUNT_ORDER_FILTER_SECTION_TITLE_CLASS}>
        {title}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <FilterPillOption active={!active} onClick={() => onChange(false)}>
          {allLabel}
        </FilterPillOption>
        <FilterPillOption active={active} onClick={() => onChange(true)}>
          {positiveLabel}
        </FilterPillOption>
      </div>
    </div>
  );
}

function buildToolbarFilterLabel(t: (key: string) => string, parts: ReturnType<typeof summarizeCodexAccountOrderFilter>) {
  if (parts.length === 0) {
    return t('accounts.display_filters');
  }
  return `${t('accounts.display_filters')} · ${parts.length}`;
}
