export const ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY = 'gettokens.accounts.display-mode';

export type AccountListDisplayMode = 'full' | 'compact' | 'list';
export const DEFAULT_ACCOUNT_LIST_DISPLAY_MODE: AccountListDisplayMode = 'full';

export function parseAccountListDisplayMode(value: string | null | undefined): AccountListDisplayMode {
  if (value === 'compact' || value === 'list' || value === 'full') {
    return value;
  }
  return DEFAULT_ACCOUNT_LIST_DISPLAY_MODE;
}

export function buildAccountListDisplayModeHash(
  hash: string | null | undefined,
  displayMode: AccountListDisplayMode,
): string {
  const normalized = typeof hash === 'string' && hash.startsWith('#') ? hash.slice(1) : hash || '';
  const params = new URLSearchParams(normalized);
  params.set('frame', 'accounts');
  if (displayMode === DEFAULT_ACCOUNT_LIST_DISPLAY_MODE) {
    params.delete('density');
  } else {
    params.set('density', displayMode);
  }
  return `#${params.toString()}`;
}
