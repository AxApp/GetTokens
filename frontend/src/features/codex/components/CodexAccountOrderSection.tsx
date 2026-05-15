import { MoreHorizontal } from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type CodexAccountRow,
  type CodexRoutePolicyRowMode,
  type CodexRoutePolicyRowState,
} from '../model/codexAccountList';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { CodexQuotaState } from '../../accounts/model/types';
import { AccountOrderRow } from './CodexAccountOrderRow';
import { shouldUseCodexOrderSectionActionMenu } from '../model/codexAccountOrderSectionLayout';

function EmptyState({ children }: { children: string }) {
  return (
    <div className="border-t-2 border-[var(--border-color)] px-8 py-14 text-center text-[0.75rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
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
  refreshLabel,
  loadingLabel,
  saveLabel,
  savingLabel,
  unsavedLabel,
  emptyLabel,
  waitingLabel,
  t,
  onReload,
  onSaveOrder,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragEnd,
  onDrop,
  onOpenDetail,
  onToggle,
  onPolicyModeChange,
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
  refreshLabel: string;
  loadingLabel: string;
  saveLabel: string;
  savingLabel: string;
  unsavedLabel: string;
  emptyLabel: string;
  waitingLabel: string;
  t: (key: string) => string;
  onReload: () => void;
  onSaveOrder: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onOpenDetail: (id: string) => void;
  onToggle: (row: CodexAccountRow) => void;
  onPolicyModeChange: (id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) => void;
}) {
  const [density, setDensity] = useState<'full' | 'compact'>(() => readInitialDensity());
  const [useActionMenu, setUseActionMenu] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionAreaRef = useRef<HTMLDivElement | null>(null);
  const actionMeasureRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

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
  }, [loading, loadingLabel, refreshLabel, saveLabel, saving, savingLabel]);

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
  } else {
    content = (
      <div className="grid auto-rows-fr gap-4 p-4 xl:auto-rows-auto xl:grid-cols-3 xl:gap-x-4 xl:gap-y-0">
        {rows.map((row, index) => (
          <AccountOrderRow
            key={row.id}
            row={row}
            index={index}
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
          <p className="mt-2 max-w-3xl text-[0.625rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {hint}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 border-t-2 border-[var(--border-color)] px-5 py-4 xl:min-w-0 xl:flex-1 xl:border-l-2 xl:border-t-0 xl:items-end">
          <div ref={actionAreaRef} className="relative flex w-full justify-start xl:justify-end">
            <div ref={actionMeasureRef} aria-hidden="true" className="pointer-events-none absolute invisible left-0 top-0">
              <InlineActionControls
                density={density}
                disabled={!ready}
                loading={loading}
                saving={saving}
                orderChanged={orderChanged}
                routingProbeRunning={routingProbeRunning}
                refreshLabel={refreshLabel}
                loadingLabel={loadingLabel}
                saveLabel={saveLabel}
                savingLabel={savingLabel}
                t={t}
                onReload={onReload}
                onSaveOrder={onSaveOrder}
                onDensityChange={(nextDensity) => updateDensity(nextDensity, setDensity)}
              />
            </div>
            {useActionMenu ? (
              <div ref={actionMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsActionMenuOpen((prev) => !prev)}
                  className="btn-swiss !min-h-10 !px-3 !py-2 !text-[0.625rem]"
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
                      disabled={!ready}
                      loading={loading}
                      saving={saving}
                      orderChanged={orderChanged}
                      routingProbeRunning={routingProbeRunning}
                      refreshLabel={refreshLabel}
                      loadingLabel={loadingLabel}
                      saveLabel={saveLabel}
                      savingLabel={savingLabel}
                      stacked
                      t={t}
                      onReload={() => {
                        setIsActionMenuOpen(false);
                        onReload();
                      }}
                      onSaveOrder={() => {
                        setIsActionMenuOpen(false);
                        onSaveOrder();
                      }}
                      onDensityChange={(nextDensity) => {
                        updateDensity(nextDensity, setDensity);
                        setIsActionMenuOpen(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <InlineActionControls
                density={density}
                disabled={!ready}
                loading={loading}
                saving={saving}
                orderChanged={orderChanged}
                routingProbeRunning={routingProbeRunning}
                refreshLabel={refreshLabel}
                loadingLabel={loadingLabel}
                saveLabel={saveLabel}
                savingLabel={savingLabel}
                t={t}
                onReload={onReload}
                onSaveOrder={onSaveOrder}
                onDensityChange={(nextDensity) => updateDensity(nextDensity, setDensity)}
              />
            )}
          </div>
          {orderChanged ? (
            <div className="text-[0.5625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
              {unsavedLabel}
            </div>
          ) : null}
        </div>
      </header>

      {message ? (
        <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3 font-mono text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
          {message}
        </div>
      ) : null}

      {content}
    </section>
  );
}

function readInitialDensity(): 'full' | 'compact' {
  if (typeof window === 'undefined') {
    return 'full';
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get('density') === 'compact' ? 'compact' : 'full';
}

function updateDensity(
  density: 'full' | 'compact',
  setDensity: (value: 'full' | 'compact') => void,
) {
  setDensity(density);
  if (typeof window === 'undefined') {
    return;
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  if (density === 'compact') {
    params.set('density', density);
  } else {
    params.delete('density');
  }
  window.location.hash = params.toString();
}

function InlineActionControls({
  density,
  disabled,
  loading,
  saving,
  orderChanged,
  routingProbeRunning,
  refreshLabel,
  loadingLabel,
  saveLabel,
  savingLabel,
  stacked = false,
  t,
  onReload,
  onSaveOrder,
  onDensityChange,
}: {
  density: 'full' | 'compact';
  disabled: boolean;
  loading: boolean;
  saving: boolean;
  orderChanged: boolean;
  routingProbeRunning: boolean;
  refreshLabel: string;
  loadingLabel: string;
  saveLabel: string;
  savingLabel: string;
  stacked?: boolean;
  t: (key: string) => string;
  onReload: () => void;
  onSaveOrder: () => void;
  onDensityChange: (density: 'full' | 'compact') => void;
}) {
  return (
    <div className={`flex ${stacked ? 'w-full flex-col items-stretch gap-2' : 'flex-nowrap items-center gap-2'}`}>
      <button
        type="button"
        onClick={onReload}
        disabled={disabled || loading || saving || routingProbeRunning}
        className={`btn-swiss !min-h-10 !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50 ${
          stacked ? 'w-full justify-center' : 'shrink-0'
        }`}
      >
        {loading ? loadingLabel : refreshLabel}
      </button>
      <button
        type="button"
        onClick={onSaveOrder}
        disabled={disabled || saving || routingProbeRunning || !orderChanged}
        className={`btn-swiss !min-h-10 bg-[var(--text-primary)] !px-3 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50 ${
          stacked ? 'w-full justify-center' : 'shrink-0'
        }`}
      >
        {saving ? savingLabel : saveLabel}
      </button>
      <div
        className={`grid overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] ${
          stacked ? 'w-full grid-cols-2' : 'shrink-0 grid-cols-2'
        }`}
        data-account-card-ignore-click="true"
      >
        <DensityButton active={density === 'full'} bordered onClick={() => onDensityChange('full')}>
          {t('codex.account_list_density_full')}
        </DensityButton>
        <DensityButton active={density === 'compact'} onClick={() => onDensityChange('compact')}>
          {t('codex.account_list_density_compact')}
        </DensityButton>
      </div>
    </div>
  );
}

function DensityButton({
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
      className={`min-h-9 px-3 text-[0.5625rem] font-black uppercase tracking-[0.12em] ${
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
