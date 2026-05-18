export const CODEX_ORDER_SECTION_ACTION_MENU_GAP = 24;
export const CODEX_ACCOUNT_ORDER_DISPLAY_MODE_STORAGE_KEY = 'gettokens.codex.account-order-display-mode';

export type CodexAccountOrderDisplayMode = 'full' | 'compact' | 'list';
export const DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE: CodexAccountOrderDisplayMode = 'compact';
export type CodexAccountOrderFilter = 'all' | 'requestable';
export const DEFAULT_CODEX_ACCOUNT_ORDER_FILTER: CodexAccountOrderFilter = 'all';

export function shouldUseCodexOrderSectionActionMenu(containerWidth: number, inlineActionsWidth: number) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return false;
  }
  if (!Number.isFinite(inlineActionsWidth) || inlineActionsWidth <= 0) {
    return false;
  }
  return containerWidth < inlineActionsWidth + CODEX_ORDER_SECTION_ACTION_MENU_GAP;
}

export function parseCodexAccountOrderDisplayMode(value: string | null | undefined): CodexAccountOrderDisplayMode {
  if (value === 'compact' || value === 'list') {
    return value;
  }
  if (value === 'full') {
    return value;
  }
  return DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE;
}

export function filterCodexAccountOrderRows<T extends { requestable?: boolean }>(
  rows: T[],
  filter: CodexAccountOrderFilter,
) {
  if (filter === 'requestable') {
    return rows.filter((row) => row.requestable !== false);
  }
  return rows;
}
