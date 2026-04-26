import type { AppPage } from '../types';

export const ACTIVE_PAGE_STORAGE_KEY = 'gettokens.activePage';

const appPages: ReadonlySet<AppPage> = new Set(['status', 'accounts', 'settings', 'debug']);

export function isAppPage(value: string | null | undefined): value is AppPage {
  return typeof value === 'string' && appPages.has(value as AppPage);
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

export function persistActivePage(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  page: AppPage,
): void {
  storage?.setItem(ACTIVE_PAGE_STORAGE_KEY, page);
}
