import { MoreHorizontal } from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import SearchInput from '../../../components/ui/SearchInput';
import SegmentedControl from '../../../components/ui/SegmentedControl';
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
  filterCodexAccountOrderRows,
  getCodexAccountOrderGridClass,
  normalizeCodexAccountOrderFilter,
  parseCodexAccountOrderDisplayMode,
  summarizeCodexAccountOrderFilter,
  shouldUseCodexOrderSectionActionMenu,
  type CodexAccountOrderFilter,
  type CodexAccountOrderDisplayMode,
} from '../model/codexAccountOrderSectionLayout';

function EmptyState({ children }: { children: string }) {
  return (
    <div className="border-t-2 border-[var(--border-color)] px-8 py-14 text-center text-[length:var(--font-size-ui-md)] font-black uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export function CodexAccountOrderSection({
  title,
  hint,
  message,
  ready,
  loading,
  saving,
  routingProbeRunning,
  orderChanged,
  rows,
  draggedID,
  pendingToggleID,
  latestRoutingProbeAccountID,
  routePolicyRowStates,
  codexQuotaByName,
  accountUsageByID,
  accountRateLimitByID,
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
  onMoveToTop,
  onMoveToBottom,
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
  latestRoutingProbeAccountID: string;
  routePolicyRowStates: Record<string, CodexRoutePolicyRowState>;
  codexQuotaByName: Record<string, CodexQuotaState>;
  accountUsageByID: Record<string, AccountUsageSummary>;
  accountRateLimitByID: Record<string, RateLimitState>;
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
  onMoveToTop: (id: string) => void;
  onMoveToBottom: (id: string) => void;
  initialDensity?: CodexAccountOrderDisplayMode;
  initialAccountFilter?: CodexAccountOrderFilter | 'all';
}) {
  const [density, setDensity] = useState<CodexAccountOrderDisplayMode>(() => initialDensity ?? readInitialDensity());
  const [accountFilter, setAccountFilter] = useState<CodexAccountOrderFilter>(() => normalizeCodexAccountOrderFilter(initialAccountFilter));
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [useActionMenu, setUseActionMenu] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionAreaRef = useRef<HTMLDivElement | null>(null);
  const actionMeasureRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleRows = filterCodexAccountOrderRows(rows, accountFilter, codexQuotaByName, accountSearchTerm);
  const rowOrderIndexByID = new Map(rows.map((row, index) => [row.id, index]));

  useEffect(() => {
    function updateActionLayout() {
      const containerWidth = actionAreaRef.current?.clientWidth || 0;
      const inlineActionsWidth = actionMeasureRef.current?.scrollWidth || 0;
      setUseActionMenu(shouldUseCodexOrderSectionActionMenu(containerWidth, inlineActionsWidth));
    }

    updateActionLayout();
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }

    const frameID = window.requestAnimationFrame(updateActionLayout);
    const observer = new ResizeObserver(() => updateActionLayout());
    if (actionAreaRef.current) {
      observer.observe(actionAreaRef.current);
    }
    if (actionMeasureRef.current) {
      observer.observe(actionMeasureRef.current);
    }
    window.addEventListener('resize', updateActionLayout);
    return () => {
      window.cancelAnimationFrame(frameID);
      observer.disconnect();
      window.removeEventListener('resize', updateActionLayout);
    };
  }, [accountFilter, accountSearchTerm, loading, loadingLabel, refreshLabel, saving]);

  useEffect(() => {
    if (!useActionMenu) {
      setIsActionMenuOpen(false);
    }
  }, [useActionMenu]);

  useEffect(() => {
    if (!isActionMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsActionMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActionMenuOpen]);

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
              canMoveToTop={rowOrderIndex > 0}
              canMoveToBottom={rowOrderIndex < rows.length - 1}
              t={t}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onOpenDetail={() => onOpenDetail(row.id)}
              onToggle={() => onToggle(row)}
              onMoveToTop={() => onMoveToTop(row.id)}
              onMoveToBottom={() => onMoveToBottom(row.id)}
              probeHit={latestRoutingProbeAccountID === row.id}
              routePolicyState={routePolicyRowStates[row.id]}
              quotaState={row.quotaKey ? codexQuotaByName[row.quotaKey] : undefined}
              usageSummary={accountUsageByID[row.id]}
              rateLimitStatus={accountRateLimitByID[row.id]}
            />
          );
        })}
      </div>
    );
  }

  return (
    <section className="border-[3px] border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
      <header className="border-b-[3px] border-[var(--border-color)] bg-[var(--bg-surface)] xl:flex xl:items-stretch">
        <div className="px-5 py-4 xl:min-w-0 xl:flex-1">
          <h2 className="text-xl font-black uppercase leading-none tracking-normal text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {hint}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 border-t-2 border-[var(--border-color)] px-5 py-4 xl:min-w-0 xl:flex-1 xl:border-l-2 xl:border-t-0 xl:items-end">
          <div ref={actionAreaRef} className="relative flex w-full justify-start xl:justify-end">
            <div ref={actionMeasureRef} aria-hidden="true" className="pointer-events-none absolute invisible left-0 top-0">
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
                t={t}
                onReload={onReload}
                onAccountFilterChange={setAccountFilter}
                onAccountSearchChange={setAccountSearchTerm}
                onDensityChange={(nextDensity) => updateDensity(nextDensity, setDensity)}
              />
            </div>
            {useActionMenu ? (
              <div ref={actionMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsActionMenuOpen((prev) => !prev)}
                  className="btn-swiss !min-h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]"
                  aria-expanded={isActionMenuOpen}
                  aria-label={t('common.more_actions')}
                  title={t('common.more_actions')}
                >
                  <span className="flex items-center gap-2">
                    <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span>{t('common.more_actions')}</span>
                  </span>
                </button>
                {isActionMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 min-w-[17rem] border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[6px_6px_0_var(--shadow-color)]">
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
                      stacked
                      t={t}
                      onReload={() => {
                        setIsActionMenuOpen(false);
                        onReload();
                      }}
                      onAccountFilterChange={(nextFilter) => {
                        setAccountFilter(nextFilter);
                      }}
                      onAccountSearchChange={setAccountSearchTerm}
                      onDensityChange={(nextDensity) => {
                        updateDensity(nextDensity, setDensity);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
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
                t={t}
                onReload={onReload}
                onAccountFilterChange={setAccountFilter}
                onAccountSearchChange={setAccountSearchTerm}
                onDensityChange={(nextDensity) => updateDensity(nextDensity, setDensity)}
              />
            )}
          </div>
          {saving || orderChanged ? (
            <div className={`text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide ${saving ? 'text-[var(--text-muted)]' : 'text-[var(--accent-red)]'}`}>
              {saving ? savingLabel : unsavedLabel}
            </div>
          ) : null}
        </div>
      </header>

      {message ? (
        <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3 font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-primary)]">
          {message}
        </div>
      ) : null}

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
  stacked = false,
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
  stacked?: boolean;
  t: (key: string) => string;
  onReload: () => void;
  onAccountFilterChange: (filter: CodexAccountOrderFilter) => void;
  onAccountSearchChange: (value: string) => void;
  onDensityChange: (density: CodexAccountOrderDisplayMode) => void;
}) {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const densityOptions = [
    { id: 'full', label: t('codex.account_list_density_full') },
    { id: 'compact', label: t('codex.account_list_density_compact') },
    { id: 'list', label: t('codex.account_list_density_list') },
  ] satisfies Array<{ id: CodexAccountOrderDisplayMode; label: string }>;

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

  function toggleFilter(key: 'requiresRequestable' | 'requiresBlocked' | 'requiresDisabled' | 'hasBalance' | 'hasLongestQuota' | 'requiresError') {
    updateFilter({ [key]: !accountFilter[key] });
  }

  return (
    <div
      className={
        stacked
          ? 'grid w-full gap-2'
          : 'grid grid-cols-[minmax(12rem,17rem)_5.75rem_minmax(12rem,auto)_12.5rem] items-center gap-2'
      }
    >
      <SearchInput
        value={accountSearchTerm}
        onChange={onAccountSearchChange}
        disabled={disabled}
        placeholder={t('codex.account_list_search_placeholder')}
        clearLabel={t('common.clear_search')}
        className={stacked ? 'w-full' : 'w-full'}
      />
      <button
        type="button"
        onClick={onReload}
        disabled={disabled || loading || saving || routingProbeRunning}
        className={`btn-swiss min-w-0 !min-h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-sm)] disabled:cursor-not-allowed disabled:opacity-50 ${
          stacked ? 'w-full justify-center' : 'shrink-0'
        }`}
      >
        <span className="min-w-0 truncate">{loading ? loadingLabel : refreshLabel}</span>
      </button>
      <div ref={filterMenuRef} className="relative min-w-0">
        <button
          type="button"
          onClick={() => setIsFilterMenuOpen((prev) => !prev)}
          disabled={disabled}
          className="btn-swiss flex h-10 w-full min-w-0 items-center justify-center !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-expanded={isFilterMenuOpen}
        >
          <span className="min-w-0 truncate">{buildCodexOrderFilterLabel(t, accountFilter)}</span>
        </button>
        {isFilterMenuOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 grid min-w-[22rem] gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[6px_6px_0_var(--shadow-color)]">
            <div className="grid gap-2">
              <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.filter_group_status')}
              </p>
              <FilterCheckOption checked={accountFilter.requiresRequestable} onChange={() => toggleFilter('requiresRequestable')}>
                {t('codex.account_list_filter_requestable_match')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.requiresBlocked} onChange={() => toggleFilter('requiresBlocked')}>
                {t('codex.account_list_filter_blocked_match')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.requiresDisabled} onChange={() => toggleFilter('requiresDisabled')}>
                {t('codex.account_list_filter_disabled_match')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.requiresError} onChange={() => toggleFilter('requiresError')}>
                {t('codex.account_list_filter_error_match')}
              </FilterCheckOption>
            </div>
            <div className="grid gap-2">
              <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.filter_group_resource')}
              </p>
              <FilterCheckOption checked={accountFilter.hasBalance} onChange={() => toggleFilter('hasBalance')}>
                {t('codex.account_list_filter_balance_match')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.hasLongestQuota} onChange={() => toggleFilter('hasLongestQuota')}>
                {t('codex.account_list_filter_longest_quota_match')}
              </FilterCheckOption>
            </div>
            <div className="grid gap-2">
              <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.filter_group_source')}
              </p>
              <FilterCheckOption checked={accountFilter.source === 'all'} onChange={() => updateFilter({ source: 'all' })}>
                {t('codex.account_list_filter_all')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.source === 'codex-auth-file'} onChange={() => updateFilter({ source: 'codex-auth-file' })}>
                {t('codex.account_list_source_auth_file')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.source === 'codex-api-key'} onChange={() => updateFilter({ source: 'codex-api-key' })}>
                {t('codex.account_list_source_api_key')}
              </FilterCheckOption>
              <FilterCheckOption checked={accountFilter.source === 'openai-compatible'} onChange={() => updateFilter({ source: 'openai-compatible' })}>
                {t('codex.account_list_source_openai_compatible')}
              </FilterCheckOption>
            </div>
            <div className="flex justify-end border-t border-dashed border-[var(--border-color)] pt-3">
              <button
                type="button"
                onClick={() => onAccountFilterChange({ ...DEFAULT_CODEX_ACCOUNT_ORDER_FILTER })}
                className="btn-swiss h-8 !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
              >
                {t('accounts.filter_reset')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 [--gt-control-segmented-padding-inline:0.35rem]">
        <SegmentedControl
          options={densityOptions}
          value={density}
          onChange={onDensityChange}
        />
      </div>
    </div>
  );
}

function FilterCheckOption({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-9 cursor-pointer items-center gap-2 border-2 border-[var(--border-color)] px-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none tracking-[0.1em] ${
        checked
          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
          : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 shrink-0 accent-[var(--text-primary)]"
      />
      <span className="block min-w-0 truncate">{children}</span>
    </label>
  );
}

function buildCodexOrderFilterLabel(t: (key: string) => string, filter: CodexAccountOrderFilter) {
  const parts = summarizeCodexAccountOrderFilter(t, filter);
  if (parts.length === 0) {
    return t('accounts.display_filters');
  }
  return `${t('accounts.display_filters')} · ${parts.map((part) => part.label).join(' · ')}`;
}
