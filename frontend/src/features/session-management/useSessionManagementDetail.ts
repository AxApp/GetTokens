import { useCallback, useRef, useState } from 'react';
import { getSessionDetail, getSessionMessagePage, getSessionMessageRawJSON } from './api.ts';
import type { SessionMessage } from './model.ts';
import type { SessionDetailState } from './SessionManagementView.tsx';
import { INITIAL_DETAIL_STATE, toErrorMessage } from './sessionManagementUtils.ts';
import type { SessionManagementWorkspace } from '../../types';

const SESSION_DETAIL_MESSAGE_PAGE_LIMIT = 50;

export function useSessionManagementDetail(workspace: SessionManagementWorkspace, loadFailedMessage: string) {
  const [detailState, setDetailState] = useState<SessionDetailState>(INITIAL_DETAIL_STATE);
  const detailRequestRef = useRef(0);
  const messagePageRequestRef = useRef(0);
  const messagePageLoadingRef = useRef(false);

  const clearDetail = useCallback(() => {
    detailRequestRef.current += 1;
    messagePageRequestRef.current += 1;
    messagePageLoadingRef.current = false;
    setDetailState(INITIAL_DETAIL_STATE);
  }, []);

  const loadDetail = useCallback(
    async (sessionID: string, mode: 'initial' | 'refresh' = 'initial') => {
      const requestID = detailRequestRef.current + 1;
      detailRequestRef.current = requestID;
      messagePageLoadingRef.current = false;

      setDetailState((previous) => {
        const keepCurrent = previous.sessionID === sessionID ? previous.detail : null;
        return {
          sessionID,
          detail: keepCurrent,
          loading: keepCurrent === null,
          refreshing: mode === 'refresh' && keepCurrent !== null,
          messagePageLoading: keepCurrent !== null,
          messagePageError: null,
          hasMoreMessages: false,
          nextMessageOffset: 0,
          rawJSONByMessageID: keepCurrent === null ? {} : previous.rawJSONByMessageID,
          rawJSONLoadingMessageID: null,
          rawJSONError: null,
          error: null,
        };
      });

      try {
        const detail = await getSessionDetail(workspace, sessionID);
        const page = await getSessionMessagePage(workspace, sessionID, {
          offset: 0,
          limit: SESSION_DETAIL_MESSAGE_PAGE_LIMIT,
        });
        if (detailRequestRef.current !== requestID) {
          return;
        }
        messagePageLoadingRef.current = false;
        const mergedDetail = {
          ...detail,
          messageCount: Math.max(detail.messageCount, page.messageCount),
          messages: page.messages,
        };
        setDetailState({
          sessionID,
          detail: mergedDetail,
          loading: false,
          refreshing: false,
          messagePageLoading: false,
          messagePageError: null,
          hasMoreMessages: page.hasMore,
          nextMessageOffset: page.nextOffset,
          rawJSONByMessageID: {},
          rawJSONLoadingMessageID: null,
          rawJSONError: null,
          error: null,
        });
      } catch (error) {
        if (detailRequestRef.current !== requestID) {
          return;
        }
        messagePageLoadingRef.current = false;
        setDetailState((previous) => ({
          sessionID,
          detail: previous.sessionID === sessionID ? previous.detail : null,
          loading: false,
          refreshing: false,
          messagePageLoading: false,
          messagePageError: null,
          hasMoreMessages: false,
          nextMessageOffset: 0,
          rawJSONByMessageID: {},
          rawJSONLoadingMessageID: null,
          rawJSONError: null,
          error: toErrorMessage(error, loadFailedMessage),
        }));
      }
    },
    [loadFailedMessage, workspace],
  );

  const loadMoreMessages = useCallback(async () => {
    const current = detailState;
    if (
      !current.sessionID ||
      !current.detail ||
      !current.hasMoreMessages ||
      current.messagePageLoading ||
      messagePageLoadingRef.current
    ) {
      return;
    }
    messagePageLoadingRef.current = true;
    const requestID = messagePageRequestRef.current + 1;
    messagePageRequestRef.current = requestID;
    const detailRequestID = detailRequestRef.current;
    const sessionID = current.sessionID;
    const offset = current.nextMessageOffset;

    setDetailState((previous) => {
      if (previous.sessionID !== sessionID) {
        return previous;
      }
      return {
        ...previous,
        messagePageLoading: true,
        messagePageError: null,
      };
    });

    try {
      const page = await getSessionMessagePage(workspace, sessionID, {
        offset,
        limit: SESSION_DETAIL_MESSAGE_PAGE_LIMIT,
      });
      if (messagePageRequestRef.current !== requestID || detailRequestRef.current !== detailRequestID) {
        return;
      }
      messagePageLoadingRef.current = false;
      setDetailState((previous) => {
        if (previous.sessionID !== sessionID || !previous.detail) {
          return previous;
        }
        return {
          ...previous,
          detail: {
            ...previous.detail,
            messageCount: Math.max(previous.detail.messageCount, page.messageCount),
            messages: [...previous.detail.messages, ...page.messages],
          },
          messagePageLoading: false,
          messagePageError: null,
          hasMoreMessages: page.hasMore,
          nextMessageOffset: page.nextOffset,
        };
      });
    } catch (error) {
      if (messagePageRequestRef.current !== requestID) {
        return;
      }
      messagePageLoadingRef.current = false;
      setDetailState((previous) => {
        if (previous.sessionID !== sessionID) {
          return previous;
        }
        return {
          ...previous,
          messagePageLoading: false,
          messagePageError: toErrorMessage(error, loadFailedMessage),
        };
      });
    }
  }, [detailState, loadFailedMessage, workspace]);

  const loadMessageRawJSON = useCallback(async (message: SessionMessage) => {
    const current = detailState;
    if (!current.sessionID || !message.lineNumber || current.rawJSONLoadingMessageID === message.id) {
      return;
    }
    if (current.rawJSONByMessageID[message.id]) {
      return;
    }
    const sessionID = current.sessionID;
    const detailRequestID = detailRequestRef.current;

    setDetailState((previous) => {
      if (previous.sessionID !== sessionID) {
        return previous;
      }
      return {
        ...previous,
        rawJSONLoadingMessageID: message.id,
        rawJSONError: null,
      };
    });

    try {
      const result = await getSessionMessageRawJSON(workspace, sessionID, message.lineNumber);
      if (detailRequestRef.current !== detailRequestID) {
        return;
      }
      setDetailState((previous) => {
        if (previous.sessionID !== sessionID) {
          return previous;
        }
        return {
          ...previous,
          rawJSONByMessageID: {
            ...previous.rawJSONByMessageID,
            [message.id]: result.rawJSON,
          },
          rawJSONLoadingMessageID: null,
          rawJSONError: null,
        };
      });
    } catch (error) {
      if (detailRequestRef.current !== detailRequestID) {
        return;
      }
      setDetailState((previous) => {
        if (previous.sessionID !== sessionID) {
          return previous;
        }
        return {
          ...previous,
          rawJSONLoadingMessageID: null,
          rawJSONError: toErrorMessage(error, loadFailedMessage),
        };
      });
    }
  }, [detailState, loadFailedMessage, workspace]);

  return {
    detailState,
    loadDetail,
    loadMoreMessages,
    loadMessageRawJSON,
    clearDetail,
  };
}
