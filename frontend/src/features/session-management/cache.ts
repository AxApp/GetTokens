import type { SessionManagementSnapshot } from './model.ts';
import { mapSessionManagementSnapshotResponse } from './model.ts';
import type { SessionManagementWorkspace } from '../../types';

const SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY = 'gettokens.sessionManagement.snapshot';
const SESSION_MANAGEMENT_SNAPSHOT_WORKSPACES: SessionManagementWorkspace[] = ['codex', 'claude'];

type SessionManagementSnapshotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface SessionManagementSnapshotCacheOptions {
  enabled?: boolean;
  storage?: SessionManagementSnapshotStorage | null;
}

function resolveSnapshotStorageKey(workspace: SessionManagementWorkspace) {
  return `${SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY}.${workspace}`;
}

export function readStoredSessionManagementSnapshot(
  workspace: SessionManagementWorkspace,
  options: SessionManagementSnapshotCacheOptions = {},
): SessionManagementSnapshot | null {
  if (options.enabled === false) {
    return null;
  }

  try {
    const raw = resolveSessionManagementSnapshotStorage(options.storage)?.getItem(resolveSnapshotStorageKey(workspace));
    if (!raw) {
      return null;
    }
    return mapSessionManagementSnapshotResponse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function persistSessionManagementSnapshot(
  workspace: SessionManagementWorkspace,
  snapshot: SessionManagementSnapshot,
  options: SessionManagementSnapshotCacheOptions = {},
) {
  if (options.enabled === false) {
    return;
  }

  try {
    resolveSessionManagementSnapshotStorage(options.storage)?.setItem(
      resolveSnapshotStorageKey(workspace),
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore cache write failures caused by private mode or quota limits.
  }
}

export function cleanupSessionManagementSnapshotStorage(
  storage: Pick<Storage, 'removeItem'> | null | undefined = resolveSessionManagementSnapshotStorage(),
) {
  try {
    storage?.removeItem(SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY);
    SESSION_MANAGEMENT_SNAPSHOT_WORKSPACES.forEach((workspace) => {
      storage?.removeItem(resolveSnapshotStorageKey(workspace));
    });
  } catch {
    // Stale browser caches are best-effort cleanup.
  }
}

function resolveSessionManagementSnapshotStorage(
  storage?: SessionManagementSnapshotStorage | null,
): SessionManagementSnapshotStorage | null {
  if (storage !== undefined) {
    return storage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
