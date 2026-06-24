import type { ReactNode } from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
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
  const [isGroupDeleteConfirming, setIsGroupDeleteConfirming] = useState(false);
  const [renderMetrics, setRenderMetrics] = useState(() => ({
    columns: 1,
    viewportStart: 0,
    viewportEnd: resolveEstimatedAccountGroupRowHeight(displayMode) * 8,
    rowHeight: resolveEstimatedAccountGroupRowHeight(displayMode),
  }));
  const gridRef = useRef<HTMLDivElement | null>(null);
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

  const isListMode = displayMode === 'list';

  const groupHeader = (
      <div
        data-account-group-header="true"
        className={isListMode
          ? 'flex items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2.5'
          : 'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5'}
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
                aria-label={collapseLabel}
                aria-controls={groupBodyID}
                aria-expanded={!isCollapsed}
                onClick={() => onToggleCollapsed(group.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-canvas)]"
                icon={isCollapsed ? (
                  <ChevronRight size={16} strokeWidth={2} />
                ) : (
                  <ChevronDown size={16} strokeWidth={2} />
                )}
              />
            </Tooltip>
          ) : null}
          <h3
            className="min-w-0 truncate font-sans text-sm font-semibold leading-tight text-[var(--gt-ink-primary)]"
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
                onClick={() => onRefreshGroup(group.accounts)}
                disabled={!canRefreshGroup}
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
        id={groupBodyID}
        ref={gridRef}
        className={
          displayMode === 'list'
            ? 'grid grid-cols-1 divide-y divide-[var(--gt-border-subtle)]'
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
