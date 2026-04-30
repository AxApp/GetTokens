import type { SessionManagementSnapshot } from './model.ts';
import { mapSessionManagementSnapshotResponse } from './model.ts';

const SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY = 'gettokens.sessionManagement.snapshot';

export function readStoredSessionManagementSnapshot(): SessionManagementSnapshot | null {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return mapSessionManagementSnapshotResponse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function persistSessionManagementSnapshot(snapshot: SessionManagementSnapshot) {
  try {
    globalThis.localStorage?.setItem(SESSION_MANAGEMENT_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore cache write failures caused by private mode or quota limits.
  }
}
