import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, MoreVertical, Power, RefreshCw, SquareCheckBig, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroup, AccountRecord, Translator } from '../model/types';
import { resolveBulkDeleteTargets, resolveBulkQuotaRefreshTargets, resolveBulkSetDisabledTargets } from '../model/accountSelection';
import { countRenderedGridColumns } from '../model/accountCardLayout';
import {
  ACCOUNT_GROUP_FULL_ROW_ESTIMATE,
  ACCOUNT_GROUP_LIST_ROW_ESTIMATE,
  ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD,
  resolveAccountGroupRenderWindow,
} from '../model/accountListLayout';

interface AccountGroupSectionViewProps {
  t: Translator;
  group: AccountGroup;
  displayMode: AccountListDisplayMode;
  isCollapsed?: boolean;
  isSelectionMode?: boolean;
  isFilteredView?: boolean;
  selectedAccountIDSet?: ReadonlySet<string>;
  onToggleCollapsed?: (groupID: string) => void;
  onToggleGroupSelection?: (accounts: AccountRecord[]) => void;
  onRefreshGroup?: (accounts: AccountRecord[]) => void;
  onSetGroupDisabled?: (accounts: AccountRecord[], nextDisabled: boolean) => void;
  onDeleteGroup?: (accounts: AccountRecord[]) => void;
  renderAccount: (account: AccountRecord) => ReactNode;
  emptyContent?: ReactNode;
}

export default function AccountGroupSectionView({
  t,
  group,
  displayMode,
  isCollapsed = false,
  isSelectionMode = false,
  isFilteredView = false,
  selectedAccountIDSet,
  onToggleCollapsed,
  onToggleGroupSelection,
  onRefreshGroup,
  onSetGroupDisabled,
  onDeleteGroup,
  renderAccount,
  emptyContent = null,
}: AccountGroupSectionViewProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGroupDeleteConfirming, setIsGroupDeleteConfirming] = useState(false);
  const [renderMetrics, setRenderMetrics] = useState(() => ({
    columns: 1,
    viewportStart: 0,
    viewportEnd: resolveEstimatedAccountGroupRowHeight(displayMode) * 8,
    rowHeight: resolveEstimatedAccountGroupRowHeight(displayMode),
  }));
  const gridRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasAccounts = group.accounts.length > 0;
  const allGroupSelected = hasAccounts && group.accounts.every((account) => selectedAccountIDSet?.has(account.id));
  const canRefreshGroup = resolveBulkQuotaRefreshTargets(group.accounts).targets.length > 0;
  const canEnableGroup = resolveBulkSetDisabledTargets(group.accounts, false).targets.length > 0;
  const canDisableGroup = resolveBulkSetDisabledTargets(group.accounts, true).targets.length > 0;
  const deleteGroupResolution = resolveBulkDeleteTargets(group.accounts);
  const canDeleteGroup = deleteGroupResolution.targets.length > 0;
  const groupBodyID = `account-group-body-${group.id}`;
  const collapseLabel = isCollapsed
    ? t('accounts.group_expand')
    : t('accounts.group_collapse');
  const deleteGroupLabel = isFilteredView
    ? t('accounts.delete_group_visible')
    : t('accounts.delete_group');
  const deleteGroupConfirmLabel = isFilteredView
    ? t('accounts.group_remove_visible_confirm')
    : t('accounts.group_remove_confirm');
  const groupSelectionAction = isSelectionMode ? onToggleGroupSelection : undefined;
  const showGroupActionsMenu = Boolean(onSetGroupDisabled || onDeleteGroup);
  const shouldVirtualize = group.accounts.length > ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD;
  const renderWindow = shouldVirtualize
    ? resolveAccountGroupRenderWindow({
        itemCount: group.accounts.length,
        columns: renderMetrics.columns,
        viewportStart: renderMetrics.viewportStart,
        viewportEnd: renderMetrics.viewportEnd,
        rowHeight: renderMetrics.rowHeight,
      })
    : {
        startIndex: 0,
        endIndex: group.accounts.length,
        renderedCount: group.accounts.length,
        rowCount: Math.ceil(group.accounts.length / Math.max(1, renderMetrics.columns)),
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
  const visibleAccounts = useMemo(
    () => group.accounts.slice(renderWindow.startIndex, renderWindow.endIndex),
    [group.accounts, renderWindow.endIndex, renderWindow.startIndex],
  );

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeGroupActionsMenu() {
      setIsMenuOpen(false);
      setIsGroupDeleteConfirming(false);
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeGroupActionsMenu();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeGroupActionsMenu();
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  function closeGroupActionsMenu() {
    setIsMenuOpen(false);
    setIsGroupDeleteConfirming(false);
  }

  function toggleGroupActionsMenu() {
    if (isMenuOpen) {
      setIsGroupDeleteConfirming(false);
    }
    setIsMenuOpen((prev) => !prev);
  }

  useLayoutEffect(() => {
    setRenderMetrics((current) => ({
      ...current,
      rowHeight: resolveEstimatedAccountGroupRowHeight(displayMode),
    }));
  }, [displayMode]);

  useLayoutEffect(() => {
    if (!shouldVirtualize) {
      return undefined;
    }
    const gridNode = gridRef.current;
    if (!gridNode) {
      return undefined;
    }

    const scrollParent = resolveAccountGroupScrollParent(gridNode);
    let frameID = 0;

    const measure = () => {
      frameID = 0;
      const gridRect = gridNode.getBoundingClientRect();
      const rootRect = getAccountGroupScrollRootRect(scrollParent);
      const columns = resolveAccountGroupRenderedColumns(gridNode);

      setRenderMetrics((current) => {
        const nextMetrics = {
          columns,
          viewportStart: rootRect.top - gridRect.top,
          viewportEnd: rootRect.bottom - gridRect.top,
          rowHeight: resolveEstimatedAccountGroupRowHeight(displayMode),
        };
        if (
          current.columns === nextMetrics.columns &&
          Math.abs(current.viewportStart - nextMetrics.viewportStart) < 1 &&
          Math.abs(current.viewportEnd - nextMetrics.viewportEnd) < 1 &&
          Math.abs(current.rowHeight - nextMetrics.rowHeight) < 1
        ) {
          return current;
        }
        return nextMetrics;
      });
    };

    const scheduleMeasure = () => {
      if (frameID) {
        return;
      }
      frameID = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(gridNode);
    if (scrollParent instanceof HTMLElement) {
      resizeObserver?.observe(scrollParent);
      scrollParent.addEventListener('scroll', scheduleMeasure, { passive: true });
    } else {
      window.addEventListener('scroll', scheduleMeasure, { passive: true });
    }
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameID) {
        window.cancelAnimationFrame(frameID);
      }
      resizeObserver?.disconnect();
      if (scrollParent instanceof HTMLElement) {
        scrollParent.removeEventListener('scroll', scheduleMeasure);
      } else {
        window.removeEventListener('scroll', scheduleMeasure);
      }
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [displayMode, group.accounts.length, shouldVirtualize]);

  return (
    <section className="space-y-4" data-account-group-collapsed={isCollapsed ? 'true' : 'false'}>
      <div className="flex items-center justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleCollapsed ? (
            <button
              type="button"
              aria-label={collapseLabel}
              aria-controls={groupBodyID}
              aria-expanded={!isCollapsed}
              onClick={() => onToggleCollapsed(group.id)}
              className="btn-swiss flex h-8 w-8 shrink-0 items-center justify-center !px-0 !py-0"
              title={collapseLabel}
            >
              {isCollapsed ? (
                <ChevronRight size={16} strokeWidth={3} />
              ) : (
                <ChevronDown size={16} strokeWidth={3} />
              )}
            </button>
          ) : null}
          <h3 className="min-w-0 truncate text-[length:var(--font-size-ui-6xl)] font-black uppercase leading-none tracking-[-0.04em] text-[var(--text-primary)]">
            {group.label}
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {group.accounts.length} {t('accounts.plan_group_meta')}
          </p>
          {groupSelectionAction ? (
            <button
              type="button"
              aria-pressed={allGroupSelected}
              onClick={() => groupSelectionAction(group.accounts)}
              disabled={!hasAccounts}
              className="btn-swiss flex h-8 items-center gap-1.5 !px-2.5 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SquareCheckBig size={13} strokeWidth={3} />
              {allGroupSelected ? t('accounts.unselect_group') : t('accounts.select_group')}
            </button>
          ) : null}
          {onRefreshGroup ? (
            <button
              type="button"
              onClick={() => onRefreshGroup(group.accounts)}
              disabled={!canRefreshGroup}
              className="btn-swiss flex h-8 items-center gap-1.5 !px-2.5 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw size={13} strokeWidth={3} />
              {t('accounts.refresh_group')}
            </button>
          ) : null}
          {showGroupActionsMenu ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label={t('accounts.group_actions')}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={toggleGroupActionsMenu}
                className="btn-swiss flex h-8 w-8 items-center justify-center !px-0 !py-0"
                title={t('accounts.group_actions')}
              >
                <MoreVertical size={14} strokeWidth={3} />
              </button>
              {isMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-2 w-56 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-[6px_6px_0_var(--shadow-color)]"
                >
                  {onSetGroupDisabled ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canEnableGroup}
                        onClick={() => {
                          closeGroupActionsMenu();
                          onSetGroupDisabled(group.accounts, false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Power size={14} strokeWidth={3} />
                        {t('accounts.enable_group')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canDisableGroup}
                        onClick={() => {
                          closeGroupActionsMenu();
                          onSetGroupDisabled(group.accounts, true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--color-status-danger)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Power size={14} strokeWidth={3} />
                        {t('accounts.disable_group')}
                      </button>
                    </>
                  ) : null}
                  {onDeleteGroup ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!canDeleteGroup}
                        onClick={() => setIsGroupDeleteConfirming(true)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--color-status-danger)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={14} strokeWidth={3} />
                        {deleteGroupLabel}
                      </button>
                      {isGroupDeleteConfirming ? (
                        <div className="mt-1 grid gap-2 border-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] p-2">
                          <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--color-status-danger)]">
                            {deleteGroupConfirmLabel} · {deleteGroupResolution.targets.length}/{group.accounts.length}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setIsGroupDeleteConfirming(false)}
                              className="btn-swiss !px-2 !py-2 !text-[length:var(--font-size-ui-2xs)]"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                closeGroupActionsMenu();
                                onDeleteGroup(group.accounts);
                              }}
                              disabled={!canDeleteGroup}
                              className="btn-swiss !px-2 !py-2 !text-[length:var(--font-size-ui-2xs)] !text-[var(--color-status-danger)]"
                            >
                              {t('accounts.group_remove_confirm_action')}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isCollapsed ? null : (
        group.accounts.length === 0 && emptyContent ? (
          emptyContent
        ) : (
          <div
            id={groupBodyID}
            ref={gridRef}
            className={
              displayMode === 'list'
                ? 'grid grid-cols-1 gap-3'
                : 'account-card-grid-full grid gap-8'
            }
            data-plan-group-grid={group.id}
            data-account-group-virtualized={shouldVirtualize ? 'true' : undefined}
            data-account-group-render-window={shouldVirtualize ? `${renderWindow.startIndex}:${renderWindow.endIndex}` : undefined}
          >
            {shouldVirtualize && renderWindow.topSpacerHeight > 0 ? (
              <div
                aria-hidden="true"
                className="col-span-full"
                data-account-group-virtual-spacer="top"
                style={{ height: renderWindow.topSpacerHeight }}
              />
            ) : null}
            {visibleAccounts.map((account) => renderAccount(account))}
            {shouldVirtualize && renderWindow.bottomSpacerHeight > 0 ? (
              <div
                aria-hidden="true"
                className="col-span-full"
                data-account-group-virtual-spacer="bottom"
                style={{ height: renderWindow.bottomSpacerHeight }}
              />
            ) : null}
          </div>
        )
      )}
    </section>
  );
}

function resolveEstimatedAccountGroupRowHeight(displayMode: AccountListDisplayMode) {
  return displayMode === 'list' ? ACCOUNT_GROUP_LIST_ROW_ESTIMATE : ACCOUNT_GROUP_FULL_ROW_ESTIMATE;
}

function resolveAccountGroupRenderedColumns(gridNode: HTMLElement) {
  if (gridNode.classList.contains('grid-cols-1')) {
    return 1;
  }
  const columns = countRenderedGridColumns(window.getComputedStyle(gridNode).gridTemplateColumns);
  return Math.max(1, columns);
}

function resolveAccountGroupScrollParent(node: HTMLElement): HTMLElement | Window {
  let current = node.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function getAccountGroupScrollRootRect(scrollParent: HTMLElement | Window) {
  if (scrollParent instanceof HTMLElement) {
    return scrollParent.getBoundingClientRect();
  }
  return {
    top: 0,
    bottom: window.innerHeight,
  };
}
