import { useCallback, useRef, useState } from 'react';
import {
  getSessionManagementSnapshot,
  refreshSessionManagementSnapshot,
} from './api.ts';
import {
  persistSessionManagementSnapshot,
  readStoredSessionManagementSnapshot,
} from './cache.ts';
import type { SessionManagementSnapshot } from './model.ts';
import { EMPTY_SNAPSHOT, toErrorMessage } from './sessionManagementUtils.ts';
import type { SessionManagementWorkspace } from '../../types';

export function useSessionManagementSnapshot(workspace: SessionManagementWorkspace, loadFailedMessage: string) {
  const cachedSnapshotRef = useRef<SessionManagementSnapshot | null>(readStoredSessionManagementSnapshot(workspace));
  const [snapshot, setSnapshot] = useState<SessionManagementSnapshot>(cachedSnapshotRef.current ?? EMPTY_SNAPSHOT);
  const [snapshotLoading, setSnapshotLoading] = useState(cachedSnapshotRef.current === null);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const snapshotRequestRef = useRef(0);

  const loadSnapshot = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const requestID = snapshotRequestRef.current + 1;
      snapshotRequestRef.current = requestID;

      if (mode === 'refresh') {
        setSnapshotRefreshing(true);
      } else {
        setSnapshotLoading(true);
      }
      setSnapshotError(null);

      try {
        const nextSnapshot =
          mode === 'refresh'
            ? await refreshSessionManagementSnapshot(workspace)
            : await getSessionManagementSnapshot(workspace);
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshot(nextSnapshot);
        persistSessionManagementSnapshot(workspace, nextSnapshot);
      } catch (error) {
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshotError(toErrorMessage(error, loadFailedMessage));
      } finally {
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshotLoading(false);
        setSnapshotRefreshing(false);
      }
    },
    [loadFailedMessage, workspace],
  );

  const updateSnapshot = useCallback((nextSnapshot: SessionManagementSnapshot) => {
    setSnapshot(nextSnapshot);
    persistSessionManagementSnapshot(workspace, nextSnapshot);
  }, [workspace]);

  return {
    snapshot,
    snapshotLoading,
    snapshotRefreshing,
    snapshotError,
    loadSnapshot,
    updateSnapshot,
  };
}
