import { useCallback, useRef, useState } from 'react';
import {
  getCodexSessionManagementSnapshot,
  refreshCodexSessionManagementSnapshot,
} from './api.ts';
import {
  persistSessionManagementSnapshot,
  readStoredSessionManagementSnapshot,
} from './cache.ts';
import type { SessionManagementSnapshot } from './model.ts';
import { EMPTY_SNAPSHOT, toErrorMessage } from './sessionManagementUtils.ts';

export function useSessionManagementSnapshot(loadFailedMessage: string) {
  const cachedSnapshotRef = useRef<SessionManagementSnapshot | null>(readStoredSessionManagementSnapshot());
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
            ? await refreshCodexSessionManagementSnapshot()
            : await getCodexSessionManagementSnapshot();
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshot(nextSnapshot);
        persistSessionManagementSnapshot(nextSnapshot);
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
    [loadFailedMessage],
  );

  const updateSnapshot = useCallback((nextSnapshot: SessionManagementSnapshot) => {
    setSnapshot(nextSnapshot);
    persistSessionManagementSnapshot(nextSnapshot);
  }, []);

  return {
    snapshot,
    snapshotLoading,
    snapshotRefreshing,
    snapshotError,
    loadSnapshot,
    updateSnapshot,
  };
}
