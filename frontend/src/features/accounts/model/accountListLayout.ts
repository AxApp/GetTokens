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

export function buildAccountListDisplayModeHash(
  hash: string | null | undefined,
  displayMode: AccountListDisplayMode,
): string {
  return buildAccountListViewHash(hash, { displayMode });
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
