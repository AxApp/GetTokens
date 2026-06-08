export const ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY = 'gettokens.accounts.display-mode';
export const ACCOUNT_GROUP_MODE_STORAGE_KEY = 'gettokens.accounts.group-mode';
export const ACCOUNT_SORT_MODE_STORAGE_KEY = 'gettokens.accounts.sort-mode';

export type AccountListDisplayMode = 'full' | 'list';
export type AccountGroupMode = 'plan' | 'source' | 'status' | 'provider' | 'resource';
export type AccountSortMode = 'priority' | 'name' | 'status' | 'quota' | 'reset' | 'recent';

export const DEFAULT_ACCOUNT_LIST_DISPLAY_MODE: AccountListDisplayMode = 'full';
export const DEFAULT_ACCOUNT_GROUP_MODE: AccountGroupMode = 'plan';
export const DEFAULT_ACCOUNT_SORT_MODE: AccountSortMode = 'priority';
export const ACCOUNTS_SELECTION_ACTION_MENU_GAP = 16;
export const ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD = 120;
export const ACCOUNT_GROUP_VIRTUALIZATION_OVERSCAN_ROWS = 3;
export const ACCOUNT_GROUP_FULL_ROW_ESTIMATE = 448;
export const ACCOUNT_GROUP_LIST_ROW_ESTIMATE = 124;

export interface AccountGroupRenderWindow {
  startIndex: number;
  endIndex: number;
  renderedCount: number;
  rowCount: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export function parseAccountListDisplayMode(value: string | null | undefined): AccountListDisplayMode {
  if (value === 'list' || value === 'full') {
    return value;
  }
  return DEFAULT_ACCOUNT_LIST_DISPLAY_MODE;
}

export function parseAccountGroupMode(value: string | null | undefined): AccountGroupMode {
  if (value === 'plan' || value === 'source' || value === 'status' || value === 'provider' || value === 'resource') {
    return value;
  }
  return DEFAULT_ACCOUNT_GROUP_MODE;
}

export function parseAccountSortMode(value: string | null | undefined): AccountSortMode {
  if (value === 'priority' || value === 'name' || value === 'status' || value === 'quota' || value === 'reset' || value === 'recent') {
    return value;
  }
  return DEFAULT_ACCOUNT_SORT_MODE;
}

export function shouldUseAccountsSelectionActionMenu(containerWidth: number, inlineActionsWidth: number): boolean {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return false;
  }
  if (!Number.isFinite(inlineActionsWidth) || inlineActionsWidth <= 0) {
    return false;
  }
  return containerWidth < inlineActionsWidth + ACCOUNTS_SELECTION_ACTION_MENU_GAP;
}

export function resolveAccountGroupRenderWindow({
  itemCount,
  columns,
  viewportStart,
  viewportEnd,
  rowHeight,
  overscanRows = ACCOUNT_GROUP_VIRTUALIZATION_OVERSCAN_ROWS,
}: {
  itemCount: number;
  columns: number;
  viewportStart: number;
  viewportEnd: number;
  rowHeight: number;
  overscanRows?: number;
}): AccountGroupRenderWindow {
  const safeItemCount = Math.max(0, Math.floor(itemCount));
  const safeColumns = Math.max(1, Math.floor(columns));
  const safeRowHeight = Math.max(1, Math.floor(rowHeight));
  const safeOverscanRows = Math.max(0, Math.floor(overscanRows));
  const rowCount = Math.ceil(safeItemCount / safeColumns);

  if (safeItemCount === 0 || rowCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      renderedCount: 0,
      rowCount: 0,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
    };
  }

  const rawStartRow = Math.floor(Math.max(0, viewportStart) / safeRowHeight);
  const rawEndRow = Math.ceil(Math.max(0, viewportEnd) / safeRowHeight);
  const startRow = clampNumber(rawStartRow - safeOverscanRows, 0, rowCount);
  const endRow = clampNumber(rawEndRow + safeOverscanRows, startRow, rowCount);
  const startIndex = Math.min(safeItemCount, startRow * safeColumns);
  const endIndex = Math.min(safeItemCount, endRow * safeColumns);

  return {
    startIndex,
    endIndex,
    renderedCount: Math.max(0, endIndex - startIndex),
    rowCount,
    topSpacerHeight: startRow * safeRowHeight,
    bottomSpacerHeight: Math.max(0, rowCount - endRow) * safeRowHeight,
  };
}

export function buildAccountListDisplayModeHash(
  hash: string | null | undefined,
  displayMode: AccountListDisplayMode,
): string {
  return buildAccountListViewHash(hash, { displayMode });
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildAccountListViewHash(
  hash: string | null | undefined,
  modes: {
    displayMode?: AccountListDisplayMode;
    groupMode?: AccountGroupMode;
    sortMode?: AccountSortMode;
  },
): string {
  const normalized = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : hash || '';
  const params = new URLSearchParams(normalized);
  params.set('frame', 'accounts');

  if (modes.displayMode) {
    if (modes.displayMode === DEFAULT_ACCOUNT_LIST_DISPLAY_MODE) {
      params.delete('density');
    } else {
      params.set('density', modes.displayMode);
    }
  }

  if (modes.groupMode) {
    if (modes.groupMode === DEFAULT_ACCOUNT_GROUP_MODE) {
      params.delete('group');
    } else {
      params.set('group', modes.groupMode);
    }
  }

  if (modes.sortMode) {
    if (modes.sortMode === DEFAULT_ACCOUNT_SORT_MODE) {
      params.delete('sort');
    } else {
      params.set('sort', modes.sortMode);
    }
  }

  return `#${params.toString()}`;
}
