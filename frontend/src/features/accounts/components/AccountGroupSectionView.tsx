import type { ReactNode } from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import { ChevronDown, ChevronRight, MoreVertical, Power, RefreshCw, SquareCheckBig, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroup, AccountRecord, Translator } from '../model/types';
import { resolveAccountGroupActionAvailability } from '../model/accountSelection';
import { countRenderedGridColumns } from '../model/accountCardLayout';
import {
  ACCOUNT_GROUP_FULL_ROW_ESTIMATE,
  ACCOUNT_GROUP_LIST_ROW_ESTIMATE,
  ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD,
  resolveAccountGroupMeasuredRowHeight,
  resolveAccountGroupRenderWindow,
} from '../model/accountListLayout';

interface AccountGroupSectionViewProps {
  t: Translator;
  group: AccountGroup;
  displayMode: AccountListDisplayMode;
  isRefreshing?: boolean;
  isCollapsed?: boolean;
  isSelectionMode?: boolean;
  isFilteredView?: boolean;
  selectedAccountIDSet?: ReadonlySet<string>;
  onToggleCollapsed?: (groupID: string) => void;
  onVisibleAccountsChange?: (groupID: string, accountIDs: string[]) => void;
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
  isRefreshing = false,
  isCollapsed = false,
  isSelectionMode = false,
  isFilteredView = false,
  selectedAccountIDSet,
  onToggleCollapsed,
  onVisibleAccountsChange,
  onToggleGroupSelection,
  onRefreshGroup,
  onSetGroupDisabled,
  onDeleteGroup,
  renderAccount,
  emptyContent = null,
}: AccountGroupSectionViewProps) {
  const [isGroupDeleteConfirming, setIsGroupDeleteConfirming] = useState(false);
  const [renderMetrics, setRenderMetrics] = useState(() => ({
    columns: 1,
    viewportStart: 0,
    viewportEnd: resolveEstimatedAccountGroupRowHeight(displayMode) * 8,
    rowHeight: resolveEstimatedAccountGroupRowHeight(displayMode),
  }));
  const virtualWrapperRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const {
    hasAccounts,
    allGroupSelected,
    canRefreshGroup,
    canEnableGroup,
    canDisableGroup,
    canDeleteGroup,
  } = useMemo(
    () => resolveAccountGroupActionAvailability(group.accounts, selectedAccountIDSet),
    [group.accounts, selectedAccountIDSet],
  );
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
  const visibleAccountIDs = useMemo(
    () => (isCollapsed ? [] : visibleAccounts.map((account) => account.id)),
    [isCollapsed, visibleAccounts],
  );

  useEffect(() => {
    onVisibleAccountsChange?.(group.id, visibleAccountIDs);
  }, [group.id, onVisibleAccountsChange, visibleAccountIDs]);

  useEffect(() => {
    return () => {
      onVisibleAccountsChange?.(group.id, []);
    };
  }, [group.id, onVisibleAccountsChange]);

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
    const virtualWrapperNode = virtualWrapperRef.current;
    const gridNode = gridRef.current;
    if (!virtualWrapperNode || !gridNode) {
      return undefined;
    }

    const scrollParent = resolveAccountGroupScrollParent(virtualWrapperNode);
    let frameID = 0;

    const measure = () => {
      frameID = 0;
      const wrapperRect = virtualWrapperNode.getBoundingClientRect();
      const rootRect = getAccountGroupScrollRootRect(scrollParent);
      const columns = resolveAccountGroupRenderedColumns(gridNode);
      const fallbackRowHeight = resolveEstimatedAccountGroupRowHeight(displayMode);
      const rowHeight = measureRenderedAccountGroupRowHeight(gridNode, fallbackRowHeight);

      setRenderMetrics((current) => {
        const nextMetrics = {
          columns,
          viewportStart: rootRect.top - wrapperRect.top,
          viewportEnd: rootRect.bottom - wrapperRect.top,
          rowHeight,
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
    resizeObserver?.observe(virtualWrapperNode);
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

  const isListMode = displayMode === 'list';

  const groupHeader = (
      <div
        data-account-group-header="true"
        className={isListMode
          ? 'flex items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2.5'
          : 'flex items-center justify-between gap-3 rounded-md border px-3.5 py-2.5'}
        style={isListMode ? undefined : {
          borderColor: 'var(--gt-border-subtle)',
          backgroundColor: 'color-mix(in srgb, var(--gt-surface-muted) 54%, transparent)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onToggleCollapsed ? (
            <Tooltip title={collapseLabel}>
              <Button
                size="small"
                type="text"
                aria-label={collapseLabel}
                aria-controls={groupBodyID}
                aria-expanded={!isCollapsed}
                onClick={() => onToggleCollapsed(group.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md !border-0 !bg-transparent !shadow-none text-[var(--gt-ink-secondary)] transition-colors hover:!bg-transparent hover:text-[var(--gt-ink-primary)]"
                icon={isCollapsed ? (
                  <ChevronRight size={16} strokeWidth={2} />
                ) : (
                  <ChevronDown size={16} strokeWidth={2} />
                )}
              />
            </Tooltip>
          ) : null}
          <h3
            className="min-w-0 truncate font-sans text-[length:var(--gt-font-size-md)] font-semibold leading-tight text-[var(--gt-ink-primary)]"
          >
            {group.label}
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <p
            className="font-mono text-[length:var(--gt-font-size-xs)] font-normal leading-none text-[var(--gt-ink-muted)]"
          >
            {group.accounts.length} {t('accounts.plan_group_meta')}
          </p>
          {groupSelectionAction ? (
            <Button
              size="small"
              type="text"
              aria-pressed={allGroupSelected}
              onClick={() => groupSelectionAction(group.accounts)}
              disabled={!hasAccounts}
              icon={<SquareCheckBig size={13} strokeWidth={2} />}
            >
              {allGroupSelected ? t('accounts.unselect_group') : t('accounts.select_group')}
            </Button>
          ) : null}
          {onRefreshGroup ? (
            <Tooltip title={t('accounts.refresh_group')}>
              <Button
                type="text"
                size="small"
                aria-label={t('accounts.refresh_group')}
                aria-busy={isRefreshing ? 'true' : undefined}
                data-account-group-refreshing={isRefreshing ? 'true' : undefined}
                onClick={() => onRefreshGroup(group.accounts)}
                disabled={!canRefreshGroup || isRefreshing}
                loading={isRefreshing}
                icon={<RefreshCw size={13} strokeWidth={2} />}
              />
            </Tooltip>
          ) : null}
          {showGroupActionsMenu ? (
            <Dropdown
              menu={{
                items: [
                  ...(onSetGroupDisabled ? [
                    {
                      key: 'enable',
                      icon: <Power size={14} />,
                      label: t('accounts.enable_group'),
                      disabled: !canEnableGroup,
                      onClick: () => onSetGroupDisabled(group.accounts, false),
                    },
                    {
                      key: 'disable',
                      icon: <Power size={14} />,
                      label: t('accounts.disable_group'),
                      disabled: !canDisableGroup,
                      danger: true,
                      onClick: () => onSetGroupDisabled(group.accounts, true),
                    },
                  ] : []),
                  ...(onDeleteGroup ? [
                    { type: 'divider' as const },
                    {
                      key: 'delete',
                      icon: <Trash2 size={14} />,
                      label: deleteGroupLabel,
                      danger: true,
                      disabled: !canDeleteGroup,
                      onClick: () => setIsGroupDeleteConfirming(true),
                    },
                  ] : []),
                ],
              }}
              trigger={['click']}
            >
              <Tooltip title={t('accounts.group_actions')}>
                <Button
                  type="text"
                  size="small"
                  aria-label={t('accounts.group_actions')}
                  icon={<MoreVertical size={14} strokeWidth={2} />}
                />
              </Tooltip>
            </Dropdown>
          ) : null}
          {isGroupDeleteConfirming && onDeleteGroup ? (
            <div className="flex items-center gap-1 rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,transparent)] px-2 py-1">
              <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)]">
                {deleteGroupConfirmLabel}
              </span>
              <Button
                size="small"
                danger
                disabled={!canDeleteGroup}
                onClick={() => {
                  setIsGroupDeleteConfirming(false);
                  onDeleteGroup(group.accounts);
                }}
              >
                {t('accounts.group_remove_confirm_action')}
              </Button>
              <Button size="small" type="text" onClick={() => setIsGroupDeleteConfirming(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
  );

  const groupBody = isCollapsed ? null : (
    group.accounts.length === 0 && emptyContent ? (
      emptyContent
    ) : (
      <div
        ref={virtualWrapperRef}
        className={shouldVirtualize ? 'account-group-virtual-wrapper' : undefined}
        data-account-group-virtualized={shouldVirtualize ? 'true' : undefined}
        data-account-group-total-count={shouldVirtualize ? group.accounts.length : undefined}
        data-account-group-render-window={shouldVirtualize ? `${renderWindow.startIndex}:${renderWindow.endIndex}` : undefined}
        data-account-group-rendered-count={shouldVirtualize ? renderWindow.renderedCount : undefined}
        data-account-group-hidden-before-count={shouldVirtualize ? renderWindow.startIndex : undefined}
        data-account-group-hidden-after-count={shouldVirtualize ? group.accounts.length - renderWindow.endIndex : undefined}
      >
        {shouldVirtualize && renderWindow.topSpacerHeight > 0 ? (
          <div
            aria-hidden="true"
            data-account-group-virtual-spacer="top"
            data-account-group-hidden-count={renderWindow.startIndex}
            style={{ height: renderWindow.topSpacerHeight }}
          />
        ) : null}
        <div
          id={groupBodyID}
          ref={gridRef}
          className={
            displayMode === 'list'
              ? 'grid grid-cols-1 divide-y divide-[var(--gt-border-subtle)]'
              : 'account-card-grid-full grid gap-8'
          }
          data-plan-group-grid={group.id}
        >
          {visibleAccounts.map((account) => renderAccount(account))}
        </div>
        {shouldVirtualize && renderWindow.bottomSpacerHeight > 0 ? (
          <div
            aria-hidden="true"
            data-account-group-virtual-spacer="bottom"
            data-account-group-hidden-count={group.accounts.length - renderWindow.endIndex}
            style={{ height: renderWindow.bottomSpacerHeight }}
          />
        ) : null}
      </div>
    )
  );

  if (isListMode) {
    return (
      <section data-account-group-collapsed={isCollapsed ? 'true' : 'false'}>
        {isCollapsed ? groupHeader : (
          <div className="overflow-hidden rounded-lg border border-[var(--gt-border-subtle)]">
            {groupHeader}
            {groupBody}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3" data-account-group-collapsed={isCollapsed ? 'true' : 'false'}>
      {groupHeader}
      {groupBody}
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

function measureRenderedAccountGroupRowHeight(gridNode: HTMLElement, fallbackRowHeight: number) {
  const gridRect = gridNode.getBoundingClientRect();
  const gridStyle = window.getComputedStyle(gridNode);
  const rowGap = Number.parseFloat(gridStyle.rowGap || '0') || 0;
  const measurements = Array.from(gridNode.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-account-card'))
    .map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        top: rect.top - gridRect.top,
        height: rect.height,
      };
    });

  return resolveAccountGroupMeasuredRowHeight(measurements, { fallbackRowHeight, rowGap });
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
