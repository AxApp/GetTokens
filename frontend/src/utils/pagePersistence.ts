import type { AccountWorkspace, AppPage } from '../types';

export const ACTIVE_PAGE_STORAGE_KEY = 'gettokens.activePage';
export const ACCOUNT_WORKSPACE_STORAGE_KEY = 'gettokens.accounts.workspace';

const appPages: ReadonlySet<AppPage> = new Set(['status', 'accounts', 'settings', 'debug']);
const accountWorkspaces: ReadonlySet<AccountWorkspace> = new Set(['all', 'codex', 'openai-compatible']);

export function isAppPage(value: string | null | undefined): value is AppPage {
  return typeof value === 'string' && appPages.has(value as AppPage);
}

export function isAccountWorkspace(value: string | null | undefined): value is AccountWorkspace {
  return typeof value === 'string' && accountWorkspaces.has(value as AccountWorkspace);
}

export function resolveInitialActivePage(
  storageValue: string | null | undefined,
  fallback: AppPage = 'accounts',
): AppPage {
  return isAppPage(storageValue) ? storageValue : fallback;
}

export function readStoredActivePage(storage: Pick<Storage, 'getItem'> | null | undefined): AppPage {
  return resolveInitialActivePage(storage?.getItem(ACTIVE_PAGE_STORAGE_KEY));
}

export function resolveInitialAccountWorkspace(
  storageValue: string | null | undefined,
  fallback: AccountWorkspace = 'all',
): AccountWorkspace {
  return isAccountWorkspace(storageValue) ? storageValue : fallback;
}

export function readStoredAccountWorkspace(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): AccountWorkspace {
  return resolveInitialAccountWorkspace(storage?.getItem(ACCOUNT_WORKSPACE_STORAGE_KEY));
}

export function persistActivePage(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  page: AppPage,
): void {
  storage?.setItem(ACTIVE_PAGE_STORAGE_KEY, page);
}

export function persistAccountWorkspace(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  workspace: AccountWorkspace,
): void {
  storage?.setItem(ACCOUNT_WORKSPACE_STORAGE_KEY, workspace);
}
