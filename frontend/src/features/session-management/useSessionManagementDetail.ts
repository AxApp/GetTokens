import { useCallback, useRef, useState } from 'react';
import { getSessionDetail } from './api.ts';
import type { SessionDetailState } from './SessionManagementView.tsx';
import { INITIAL_DETAIL_STATE, toErrorMessage } from './sessionManagementUtils.ts';
import type { SessionManagementWorkspace } from '../../types';

export function useSessionManagementDetail(workspace: SessionManagementWorkspace, loadFailedMessage: string) {
  const [detailState, setDetailState] = useState<SessionDetailState>(INITIAL_DETAIL_STATE);
  const detailRequestRef = useRef(0);

  const clearDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setDetailState(INITIAL_DETAIL_STATE);
  }, []);

  const loadDetail = useCallback(
    async (sessionID: string, mode: 'initial' | 'refresh' = 'initial') => {
      const requestID = detailRequestRef.current + 1;
      detailRequestRef.current = requestID;

      setDetailState((previous) => {
        const keepCurrent = previous.sessionID === sessionID ? previous.detail : null;
        return {
          sessionID,
          detail: keepCurrent,
          loading: keepCurrent === null,
          refreshing: mode === 'refresh' && keepCurrent !== null,
          error: null,
        };
      });

      try {
        const detail = await getSessionDetail(workspace, sessionID);
        if (detailRequestRef.current !== requestID) {
          return;
        }
        setDetailState({
          sessionID,
          detail,
          loading: false,
          refreshing: false,
          error: null,
        });
      } catch (error) {
        if (detailRequestRef.current !== requestID) {
          return;
        }
        setDetailState((previous) => ({
          sessionID,
          detail: previous.sessionID === sessionID ? previous.detail : null,
          loading: false,
          refreshing: false,
          error: toErrorMessage(error, loadFailedMessage),
        }));
      }
    },
    [loadFailedMessage, workspace],
  );

  return {
    detailState,
    loadDetail,
    clearDetail,
  };
}
