import type { SessionManagementSnapshot } from './model.ts';
import { mapSessionManagementSnapshotResponse } from './model.ts';
import type { SessionManagementWorkspace } from '../../types';

const SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY = 'gettokens.sessionManagement.snapshot';

function resolveSnapshotStorageKey(workspace: SessionManagementWorkspace) {
  return `${SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY}.${workspace}`;
}

export function readStoredSessionManagementSnapshot(workspace: SessionManagementWorkspace): SessionManagementSnapshot | null {
  try {
    const raw = globalThis.localStorage?.getItem(resolveSnapshotStorageKey(workspace));
    if (!raw) {
      return null;
    }
    return mapSessionManagementSnapshotResponse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function persistSessionManagementSnapshot(workspace: SessionManagementWorkspace, snapshot: SessionManagementSnapshot) {
  try {
    globalThis.localStorage?.setItem(resolveSnapshotStorageKey(workspace), JSON.stringify(snapshot));
  } catch {
    // Ignore cache write failures caused by private mode or quota limits.
  }
}
