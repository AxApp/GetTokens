import type { AccountWorkspace, AppPage, CodexWorkspace, SessionManagementWorkspace, UsageDeskWorkspace } from '../types';

export const ACTIVE_PAGE_STORAGE_KEY = 'gettokens.activePage';
export const ACCOUNT_WORKSPACE_STORAGE_KEY = 'gettokens.accounts.workspace';
export const CODEX_WORKSPACE_STORAGE_KEY = 'gettokens.codex.workspace';
export const SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY = 'gettokens.sessionManagement.workspace';
export const USAGE_DESK_WORKSPACE_STORAGE_KEY = 'gettokens.usageDesk.workspace';
export const USAGE_DESK_SOURCE_STORAGE_KEY = 'gettokens.usageDesk.source';
export const USAGE_DESK_RANGE_STORAGE_KEY = 'gettokens.usageDesk.range';

const appPages: ReadonlySet<AppPage> = new Set([
  'status',
  'accounts',
  'session-management',
  'vendor-status',
  'proxy-pool',
  'codex',
  'usage-desk',
  'settings',
  'debug',
]);
const accountWorkspaces: ReadonlySet<AccountWorkspace> = new Set(['all', 'codex', 'openai-compatible']);
const codexWorkspaces: ReadonlySet<CodexWorkspace> = new Set([
  'feature-config',
  'session-management',
  'vendor-status',
  'usage-codex',
]);
const sessionManagementWorkspaces: ReadonlySet<SessionManagementWorkspace> = new Set(['codex']);
const usageDeskWorkspaces: ReadonlySet<UsageDeskWorkspace> = new Set(['codex', 'gemini']);
const usageDeskSources = new Set(['observed', 'projected'] as const);
const usageDeskRanges = new Set(['TODAY', '7D', '14D', '30D', '全部'] as const);

export type UsageDeskSourceStorageValue = 'observed' | 'projected';
export type UsageDeskRangeStorageValue = 'TODAY' | '7D' | '14D' | '30D' | '全部';

export interface FrameHashState {
  page: AppPage;
  workspace?: AccountWorkspace;
  codexWorkspace?: CodexWorkspace;
  sessionManagementWorkspace?: SessionManagementWorkspace;
  usageDeskWorkspace?: UsageDeskWorkspace;
}

export function isAppPage(value: string | null | undefined): value is AppPage {
  return typeof value === 'string' && appPages.has(value as AppPage);
}

export function isAccountWorkspace(value: string | null | undefined): value is AccountWorkspace {
  return typeof value === 'string' && accountWorkspaces.has(value as AccountWorkspace);
}

export function isCodexWorkspace(value: string | null | undefined): value is CodexWorkspace {
  return typeof value === 'string' && codexWorkspaces.has(value as CodexWorkspace);
}

export function isSessionManagementWorkspace(value: string | null | undefined): value is SessionManagementWorkspace {
  return typeof value === 'string' && sessionManagementWorkspaces.has(value as SessionManagementWorkspace);
}

export function isUsageDeskWorkspace(value: string | null | undefined): value is UsageDeskWorkspace {
  return typeof value === 'string' && usageDeskWorkspaces.has(value as UsageDeskWorkspace);
}

export function isUsageDeskSourceStorageValue(value: string | null | undefined): value is UsageDeskSourceStorageValue {
  return typeof value === 'string' && usageDeskSources.has(value as UsageDeskSourceStorageValue);
}

export function isUsageDeskRangeStorageValue(value: string | null | undefined): value is UsageDeskRangeStorageValue {
  return typeof value === 'string' && usageDeskRanges.has(value as UsageDeskRangeStorageValue);
}

export function resolveInitialActivePage(
  storageValue: string | null | undefined,
  fallback: AppPage = 'accounts',
): AppPage {
  if (storageValue === 'session-management' || storageValue === 'vendor-status' || storageValue === 'usage-desk') {
    return 'codex';
  }
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

export function resolveInitialCodexWorkspace(
  storageValue: string | null | undefined,
  fallback: CodexWorkspace = 'feature-config',
): CodexWorkspace {
  return isCodexWorkspace(storageValue) ? storageValue : fallback;
}

export function readStoredCodexWorkspace(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): CodexWorkspace {
  return resolveInitialCodexWorkspace(storage?.getItem(CODEX_WORKSPACE_STORAGE_KEY));
}

export function resolveInitialSessionManagementWorkspace(
  storageValue: string | null | undefined,
  fallback: SessionManagementWorkspace = 'codex',
): SessionManagementWorkspace {
  return isSessionManagementWorkspace(storageValue) ? storageValue : fallback;
}

export function readStoredSessionManagementWorkspace(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): SessionManagementWorkspace {
  return resolveInitialSessionManagementWorkspace(storage?.getItem(SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY));
}

export function resolveInitialUsageDeskWorkspace(
  storageValue: string | null | undefined,
  fallback: UsageDeskWorkspace = 'codex',
): UsageDeskWorkspace {
  return isUsageDeskWorkspace(storageValue) ? storageValue : fallback;
}

export function readStoredUsageDeskWorkspace(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): UsageDeskWorkspace {
  return resolveInitialUsageDeskWorkspace(storage?.getItem(USAGE_DESK_WORKSPACE_STORAGE_KEY));
}

export function codexWorkspaceFromUsageDeskWorkspace(_workspace: string | null | undefined): CodexWorkspace {
  return 'usage-codex';
}

export function resolveInitialUsageDeskSource(
  storageValue: string | null | undefined,
  fallback: UsageDeskSourceStorageValue = 'observed',
): UsageDeskSourceStorageValue {
  return isUsageDeskSourceStorageValue(storageValue) ? storageValue : fallback;
}

export function readStoredUsageDeskSource(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): UsageDeskSourceStorageValue {
  return resolveInitialUsageDeskSource(storage?.getItem(USAGE_DESK_SOURCE_STORAGE_KEY));
}

export function resolveInitialUsageDeskRange(
  storageValue: string | null | undefined,
  fallback: UsageDeskRangeStorageValue = '7D',
): UsageDeskRangeStorageValue {
  return isUsageDeskRangeStorageValue(storageValue) ? storageValue : fallback;
}

export function readStoredUsageDeskRange(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): UsageDeskRangeStorageValue {
  return resolveInitialUsageDeskRange(storage?.getItem(USAGE_DESK_RANGE_STORAGE_KEY));
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

export function persistCodexWorkspace(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  workspace: CodexWorkspace,
): void {
  storage?.setItem(CODEX_WORKSPACE_STORAGE_KEY, workspace);
}

export function persistSessionManagementWorkspace(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  workspace: SessionManagementWorkspace,
): void {
  storage?.setItem(SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY, workspace);
}

export function persistUsageDeskWorkspace(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  workspace: UsageDeskWorkspace,
): void {
  storage?.setItem(USAGE_DESK_WORKSPACE_STORAGE_KEY, workspace);
}

export function persistUsageDeskSource(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  source: UsageDeskSourceStorageValue,
): void {
  storage?.setItem(USAGE_DESK_SOURCE_STORAGE_KEY, source);
}

export function persistUsageDeskRange(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  range: UsageDeskRangeStorageValue,
): void {
  storage?.setItem(USAGE_DESK_RANGE_STORAGE_KEY, range);
}

export function readFrameHashState(hash: string | null | undefined): FrameHashState | null {
  if (typeof hash !== 'string' || hash.length === 0) {
    return null;
  }

  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalized);
  const page = params.get('frame');
  if (!isAppPage(page)) {
    return null;
  }

  if (page === 'session-management') {
    return {
      page: 'codex',
      codexWorkspace: 'session-management',
    };
  }

  if (page === 'vendor-status') {
    return {
      page: 'codex',
      codexWorkspace: 'vendor-status',
    };
  }

  if (page === 'accounts') {
    const workspace = params.get('workspace');
    return {
      page,
      workspace: isAccountWorkspace(workspace) ? workspace : 'all',
    };
  }

  if (page === 'codex') {
    const workspace = params.get('workspace');
    return {
      page,
      codexWorkspace: isCodexWorkspace(workspace) ? workspace : 'feature-config',
    };
  }

  if (page === 'usage-desk') {
    const workspace = params.get('workspace');
    return {
      page: 'codex',
      codexWorkspace: codexWorkspaceFromUsageDeskWorkspace(workspace),
    };
  }

  return { page };
}

export function buildFrameHash(
  page: AppPage,
  accountWorkspace: AccountWorkspace,
  codexWorkspace: CodexWorkspace,
  sessionManagementWorkspace: SessionManagementWorkspace,
  usageDeskWorkspace: UsageDeskWorkspace,
): string {
  const params = new URLSearchParams();
  params.set('frame', page);
  if (page === 'accounts' && accountWorkspace !== 'all') {
    params.set('workspace', accountWorkspace);
  }
  if (page === 'codex' && codexWorkspace !== 'feature-config') {
    params.set('workspace', codexWorkspace);
  }
  if (page === 'session-management' && sessionManagementWorkspace !== 'codex') {
    params.set('workspace', sessionManagementWorkspace);
  }
  if (page === 'usage-desk' && usageDeskWorkspace !== 'codex') {
    params.set('workspace', usageDeskWorkspace);
  }
  return `#${params.toString()}`;
}
