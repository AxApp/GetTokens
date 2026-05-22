import { MoreHorizontal } from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import {
  type CodexAccountRow,
  type CodexRoutePolicyRowMode,
  type CodexRoutePolicyRowState,
} from '../model/codexAccountList';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import { AccountOrderRow } from './CodexAccountOrderRow';
import {
  CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE,
  DEFAULT_CODEX_ACCOUNT_ORDER_FILTER,
  filterCodexAccountOrderRows,
  getCodexAccountOrderGridClass,
  normalizeCodexAccountOrderFilter,
  parseCodexAccountOrderDisplayMode,
  shouldUseCodexOrderSectionActionMenu,
  type CodexAccountOrderFilter,
  type CodexAccountOrderFilterSource,
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
  onPolicyModeChange,
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
  onPolicyModeChange: (id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) => void;
  initialDensity?: CodexAccountOrderDisplayMode;
  initialAccountFilter?: CodexAccountOrderFilter | 'all' | 'requestable';
}) {
  const [density, setDensity] = useState<CodexAccountOrderDisplayMode>(() => initialDensity ?? readInitialDensity());
  const [accountFilter, setAccountFilter] = useState<CodexAccountOrderFilter>(() => normalizeCodexAccountOrderFilter(initialAccountFilter));
  const [useActionMenu, setUseActionMenu] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionAreaRef = useRef<HTMLDivElement | null>(null);
  const actionMeasureRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const visibleRows = filterCodexAccountOrderRows(rows, accountFilter, codexQuotaByName);
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
  }, [accountFilter, loading, loadingLabel, refreshLabel, saving]);

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
        {visibleRows.map((row) => (
          <AccountOrderRow
            key={row.id}
            row={row}
            index={rowOrderIndexByID.get(row.id) ?? 0}
            density={density}
            dragged={draggedID === row.id}
            pending={pendingToggleID === row.id}
            t={t}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onOpenDetail={() => onOpenDetail(row.id)}
            onToggle={() => onToggle(row)}
            probeHit={latestRoutingProbeAccountID === row.id}
            routePolicyState={routePolicyRowStates[row.id]}
            quotaState={row.quotaKey ? codexQuotaByName[row.quotaKey] : undefined}
            usageSummary={accountUsageByID[row.id]}
            rateLimitStatus={accountRateLimitByID[row.id]}
            onPolicyModeChange={onPolicyModeChange}
          />
        ))}
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
                disabled={!ready}
                loading={loading}
                saving={saving}
                routingProbeRunning={routingProbeRunning}
                refreshLabel={refreshLabel}
                loadingLabel={loadingLabel}
                t={t}
                onReload={onReload}
                onAccountFilterChange={setAccountFilter}
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
                disabled={!ready}
                loading={loading}
                saving={saving}
                routingProbeRunning={routingProbeRunning}
                refreshLabel={refreshLabel}
                loadingLabel={loadingLabel}
                t={t}
                onReload={onReload}
                onAccountFilterChange={setAccountFilter}
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
  onDensityChange,
}: {
  density: CodexAccountOrderDisplayMode;
  accountFilter: CodexAccountOrderFilter;
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
    onAccountFilterChange({
      ...accountFilter,
      ...patch,
    });
  }

  function toggleFilter(key: 'requestableOnly' | 'disabledOnly' | 'hasBalance' | 'hasLongestQuota' | 'errorsOnly') {
    updateFilter({
      [key]: !accountFilter[key],
    });
  }

  return (
    <div
      className={
        stacked
          ? 'grid w-full gap-2'
          : 'grid grid-cols-[5.75rem_minmax(12rem,auto)_12.5rem] items-center gap-2'
      }
    >
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
                {t('accounts.filter_group_source')}
              </p>
              <div className="grid grid-cols-2 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
                <SourceFilterButton active={accountFilter.source === 'all'} bordered onClick={() => updateFilter({ source: 'all' })}>
                  {t('codex.account_list_filter_all')}
                </SourceFilterButton>
                <SourceFilterButton active={accountFilter.source === 'codex-auth-file'} onClick={() => updateFilter({ source: 'codex-auth-file' })}>
                  {t('codex.account_list_source_auth_file')}
                </SourceFilterButton>
                <SourceFilterButton active={accountFilter.source === 'codex-api-key'} bordered topBorder onClick={() => updateFilter({ source: 'codex-api-key' })}>
                  {t('codex.account_list_source_api_key')}
                </SourceFilterButton>
                <SourceFilterButton active={accountFilter.source === 'openai-compatible'} topBorder onClick={() => updateFilter({ source: 'openai-compatible' })}>
                  {t('codex.account_list_source_openai_compatible')}
                </SourceFilterButton>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.filter_group_status')}
              </p>
              <FilterCheckbox checked={accountFilter.requestableOnly} onChange={() => toggleFilter('requestableOnly')}>
                {t('accounts.filter_requestable')}
              </FilterCheckbox>
              <FilterCheckbox checked={accountFilter.disabledOnly} onChange={() => toggleFilter('disabledOnly')}>
                {t('accounts.filter_disabled_only')}
              </FilterCheckbox>
              <FilterCheckbox checked={accountFilter.errorsOnly} onChange={() => toggleFilter('errorsOnly')}>
                {t('accounts.errors_only')}
              </FilterCheckbox>
              <FilterCheckbox checked={accountFilter.hasBalance} onChange={() => toggleFilter('hasBalance')}>
                {t('accounts.filter_has_balance')}
              </FilterCheckbox>
              <FilterCheckbox checked={accountFilter.hasLongestQuota} onChange={() => toggleFilter('hasLongestQuota')}>
                {t('accounts.filter_longest_quota')}
              </FilterCheckbox>
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

function SourceFilterButton({
  active,
  bordered = false,
  topBorder = false,
  children,
  onClick,
}: {
  active: boolean;
  bordered?: boolean;
  topBorder?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 min-w-0 px-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none tracking-[0.1em] ${
        bordered ? 'border-r border-[var(--border-color)]' : ''
      } ${topBorder ? 'border-t border-[var(--border-color)]' : ''} ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}

function FilterCheckbox({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-[var(--text-primary)]"
      />
      <span>{children}</span>
    </label>
  );
}

function buildCodexOrderFilterLabel(t: (key: string) => string, filter: CodexAccountOrderFilter) {
  const sourceLabels: Record<CodexAccountOrderFilterSource, string> = {
    all: '',
    'codex-auth-file': t('codex.account_list_source_auth_file'),
    'codex-api-key': t('codex.account_list_source_api_key'),
    'openai-compatible': t('codex.account_list_source_openai_compatible'),
  };
  const parts: string[] = [];
  const sourceLabel = sourceLabels[filter.source];
  if (sourceLabel) {
    parts.push(sourceLabel);
  }
  if (filter.requestableOnly) {
    parts.push(t('accounts.filter_requestable'));
  }
  if (filter.disabledOnly) {
    parts.push(t('accounts.filter_disabled_only'));
  }
  if (filter.errorsOnly) {
    parts.push(t('accounts.errors_only'));
  }
  if (filter.hasBalance) {
    parts.push(t('accounts.filter_has_balance'));
  }
  if (filter.hasLongestQuota) {
    parts.push(t('accounts.filter_longest_quota'));
  }
  if (parts.length === 0) {
    return t('accounts.display_filters');
  }
  return `${t('accounts.display_filters')} · ${parts.join(' · ')}`;
}
