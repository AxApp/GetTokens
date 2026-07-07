import { useCallback, useEffect, useRef, useState } from 'react';
import { ClearCodexLiveSessions, GetCodexLiveSessionHistory, GetCodexLiveSessionsSnapshot } from '../../../wailsjs/go/main/App';
import type { CodexLiveSessionsView, SidecarStatus } from '../../types';
import { hasWailsAppBindings } from '../../utils/previewMode';
import CodexLiveSessionsWorkbench from './components/CodexLiveSessionsWorkbench';
import { mapBackendCodexLiveSessionHistory, mapBackendCodexLiveSessionsSnapshot } from './model/adapters';
import {
  canLoadMoreBoundedCodexLiveHistory,
  codexLiveDetailHistoryMaxRetainedRequests,
  codexLiveOverviewHistoryMaxRetainedRequests,
  mergeBoundedCodexLiveHistoryRefresh,
  mergeBoundedCodexLiveHistoryRequests,
} from './model/historyMemory';
import { buildAnimatedCodexLiveSessionsPreviewSnapshot } from './model/mockData';
import {
  resolveCodexLiveSessionDetailPollIntervalMs,
  resolveCodexLiveSessionsPollIntervalMs,
} from './model/polling';
import {
  buildCodexLiveSessionsInitialSnapshot,
  buildCodexLiveSessionsLoadFailureSnapshot,
  buildCodexLiveSessionsSidecarUnavailableSnapshot,
} from './model/snapshotState';
import { mergeCodexLiveSessionsSnapshot } from './model/snapshotMerge';
import type { CodexLiveRequest, CodexLiveSessionSnapshot } from './model/types';

const codexLiveOverviewHistoryLimit = 80;
const codexLiveDetailHistoryLimit = 50;

interface CodexLiveSessionsFeatureProps {
  sidecarStatus: SidecarStatus;
  view: CodexLiveSessionsView;
  onViewChange: (view: CodexLiveSessionsView) => void;
}

interface CodexLiveSessionDetailState {
  sessionID?: string;
  requests: CodexLiveRequest[];
  generatedAt: string;
  window: string;
  limit: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error?: string;
}

interface CodexLiveSessionOverviewState {
  requests: CodexLiveRequest[];
  generatedAt: string;
  window: string;
  limit: number;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error?: string;
}

export default function CodexLiveSessionsFeature({ sidecarStatus, view, onViewChange }: CodexLiveSessionsFeatureProps) {
  const sidecarReady = sidecarStatus?.code === 'ready';
  const browserMode = !hasWailsAppBindings();
  const [snapshot, setSnapshot] = useState<CodexLiveSessionSnapshot>(() =>
    buildCodexLiveSessionsInitialSnapshot({ browserMode, sidecarReady }),
  );
  const [selectedSessionID, setSelectedSessionID] = useState<string>();
  const [detailState, setDetailState] = useState<CodexLiveSessionDetailState>({
    requests: [],
    generatedAt: '',
    window: 'all',
    limit: codexLiveDetailHistoryLimit,
    offset: 0,
    hasMore: false,
    loading: false,
  });
  const [overviewState, setOverviewState] = useState<CodexLiveSessionOverviewState>({
    requests: [],
    generatedAt: '',
    window: 'all',
    limit: codexLiveOverviewHistoryLimit,
    offset: 0,
    hasMore: false,
    loading: false,
  });
  const [documentHidden, setDocumentHidden] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState !== 'visible' : false,
  );
  const detailRequestVersionRef = useRef(0);
  const overviewRequestVersionRef = useRef(0);

  const loadSnapshot = useCallback(async () => {
    if (browserMode) {
      const previewSnapshot = buildAnimatedCodexLiveSessionsPreviewSnapshot();
      setSnapshot((current) =>
        mergeCodexLiveSessionsSnapshot(
          current,
          sidecarReady ? previewSnapshot : { ...previewSnapshot, sidecarReady: false, source: 'cache' },
        ),
      );
      return;
    }
    if (!sidecarReady) {
      setSnapshot((current) => mergeCodexLiveSessionsSnapshot(current, buildCodexLiveSessionsSidecarUnavailableSnapshot()));
      return;
    }
    const nextSnapshot = await GetCodexLiveSessionsSnapshot();
    setSnapshot((current) => mergeCodexLiveSessionsSnapshot(current, mapBackendCodexLiveSessionsSnapshot(nextSnapshot)));
  }, [browserMode, sidecarReady]);

  const refreshSnapshot = useCallback(async () => {
    try {
      await loadSnapshot();
    } catch (error) {
      console.error(error);
      setSnapshot((current) => buildCodexLiveSessionsLoadFailureSnapshot(current));
    }
  }, [loadSnapshot]);


  const clearSessions = useCallback(async () => {
    try {
      if (!browserMode && sidecarReady) {
        await ClearCodexLiveSessions();
      }
      detailRequestVersionRef.current += 1;
      overviewRequestVersionRef.current += 1;
      setSelectedSessionID(undefined);
      setDetailState(createEmptyDetailHistoryState());
      setOverviewState(createEmptyOverviewHistoryState());
      setSnapshot((current) => ({
        ...current,
        summary: {
          activeSessions: 0,
          activeRequests: 0,
          websocketSessions: 0,
          httpSessions: 0,
          degradedSessions: 0,
          errorSessions: 0,
        },
        sessions: [],
      }));
    } catch (error) {
      console.error(error);
      setSnapshot((current) => buildCodexLiveSessionsLoadFailureSnapshot(current));
    }
  }, [browserMode, sidecarReady]);

  const loadOverview = useCallback(async () => {
    if (selectedSessionID) {
      return;
    }
    if (browserMode) {
      overviewRequestVersionRef.current += 1;
      const requests = snapshot.sessions.flatMap((session) => session.requests);
      setOverviewState({
        requests,
        generatedAt: snapshot.generatedAt,
        window: 'preview',
        limit: requests.length,
        offset: 0,
        hasMore: false,
        loading: false,
      });
      return;
    }
    if (!sidecarReady) {
      overviewRequestVersionRef.current += 1;
      setOverviewState((current) => ({ ...current, loading: false }));
      return;
    }

    setOverviewState((current) => ({ ...current, loading: true }));
    const requestVersion = overviewRequestVersionRef.current + 1;
    overviewRequestVersionRef.current = requestVersion;

    try {
      const nextHistory = await GetCodexLiveSessionHistory({
        sessionID: '',
        window: 'all',
        limit: codexLiveOverviewHistoryLimit,
        offset: 0,
      });
      const history = mapBackendCodexLiveSessionHistory(nextHistory);
      if (overviewRequestVersionRef.current != requestVersion) {
        return;
      }
      const refreshedRequests = markCodexLiveHistoryRequests(history.items);
      setOverviewState((current) => {
        const limit = history.limit || current.limit || codexLiveOverviewHistoryLimit;
        const offset = history.offset || current.offset || 0;
        const requests = offset === current.offset
          ? mergeBoundedCodexLiveHistoryRefresh(current.requests, refreshedRequests, codexLiveOverviewHistoryMaxRetainedRequests)
          : refreshedRequests.slice(0, codexLiveOverviewHistoryMaxRetainedRequests);
        return {
          requests,
          generatedAt: history.generatedAt,
          window: history.window || current.window || 'all',
          limit,
          offset,
          hasMore: canLoadMoreBoundedCodexLiveHistory(
            requests.length,
            requests.length > refreshedRequests.length ? limit : refreshedRequests.length,
            limit,
            codexLiveOverviewHistoryMaxRetainedRequests,
          ),
          loading: false,
          error: undefined,
        };
      });
    } catch (error) {
      if (overviewRequestVersionRef.current != requestVersion) {
        return;
      }
      console.error(error);
      setOverviewState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'overview-load-failed',
      }));
    }
  }, [browserMode, selectedSessionID, sidecarReady, snapshot.generatedAt, snapshot.sessions]);

  const loadMoreOverview = useCallback(async () => {
    if (browserMode || selectedSessionID || !sidecarReady || overviewState.loading || !overviewState.hasMore) {
      return;
    }
    setOverviewState((current) => ({ ...current, loading: true }));
    const requestVersion = overviewRequestVersionRef.current + 1;
    overviewRequestVersionRef.current = requestVersion;
    const nextOffset = overviewState.offset + overviewState.requests.length;
    const limit = overviewState.limit || codexLiveOverviewHistoryLimit;

    try {
      const nextHistory = await GetCodexLiveSessionHistory({
        sessionID: '',
        window: overviewState.window || 'all',
        limit,
        offset: nextOffset,
      });
      const history = mapBackendCodexLiveSessionHistory(nextHistory);
      if (overviewRequestVersionRef.current != requestVersion) {
        return;
      }
      const nextRequests = markCodexLiveHistoryRequests(history.items);
      setOverviewState((current) => {
        const nextLimit = history.limit || limit;
        const requests = mergeBoundedCodexLiveHistoryRequests(
          current.requests,
          nextRequests,
          codexLiveOverviewHistoryMaxRetainedRequests,
        );
        return {
          ...current,
          requests,
          generatedAt: history.generatedAt,
          window: history.window || current.window,
          limit: nextLimit,
          offset: current.offset,
          hasMore: canLoadMoreBoundedCodexLiveHistory(
            requests.length,
            nextRequests.length,
            nextLimit,
            codexLiveOverviewHistoryMaxRetainedRequests,
          ),
          loading: false,
          error: undefined,
        };
      });
    } catch (error) {
      if (overviewRequestVersionRef.current != requestVersion) {
        return;
      }
      console.error(error);
      setOverviewState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'overview-load-more-failed',
      }));
    }
  }, [browserMode, overviewState.hasMore, overviewState.limit, overviewState.loading, overviewState.offset, overviewState.requests, overviewState.window, selectedSessionID, sidecarReady]);

  const loadDetail = useCallback(async () => {
    if (!selectedSessionID) {
      detailRequestVersionRef.current += 1;
      setDetailState(createEmptyDetailHistoryState());
      return;
    }
    if (browserMode) {
      detailRequestVersionRef.current += 1;
      const previewSession = snapshot.sessions.find((session) => session.sessionID === selectedSessionID);
      setDetailState({
        sessionID: selectedSessionID,
        requests: previewSession?.requests ?? [],
        generatedAt: snapshot.generatedAt,
        window: 'preview',
        limit: previewSession?.requests.length ?? 0,
        offset: 0,
        hasMore: false,
        loading: false,
      });
      return;
    }
    if (!sidecarReady) {
      detailRequestVersionRef.current += 1;
      setDetailState((current) => ({
        sessionID: selectedSessionID,
        requests: current.sessionID === selectedSessionID ? current.requests : [],
        generatedAt: current.generatedAt,
        window: current.window,
        limit: current.limit,
        offset: current.offset,
        hasMore: false,
        loading: false,
        error: current.error,
      }));
      return;
    }

    setDetailState((current) => ({
      sessionID: selectedSessionID,
      requests: current.sessionID === selectedSessionID ? current.requests : [],
      generatedAt: current.generatedAt,
      window: current.window,
      limit: current.limit,
      offset: current.offset,
      hasMore: current.hasMore,
      loading: true,
    }));
    const requestVersion = detailRequestVersionRef.current + 1;
    detailRequestVersionRef.current = requestVersion;

    try {
      const nextHistory = await GetCodexLiveSessionHistory({
        sessionID: selectedSessionID,
        window: 'all',
        limit: codexLiveDetailHistoryLimit,
        offset: 0,
      });
      const history = mapBackendCodexLiveSessionHistory(nextHistory);
      if (detailRequestVersionRef.current != requestVersion) {
        return;
      }
      const refreshedRequests = markCodexLiveHistoryRequests(history.items);
      setDetailState((current) => {
        const limit = history.limit || current.limit || codexLiveDetailHistoryLimit;
        const offset = history.offset || current.offset || 0;
        const requests = current.sessionID === selectedSessionID && offset === current.offset
          ? mergeBoundedCodexLiveHistoryRefresh(current.requests, refreshedRequests, codexLiveDetailHistoryMaxRetainedRequests)
          : refreshedRequests.slice(0, codexLiveDetailHistoryMaxRetainedRequests);
        return {
          sessionID: selectedSessionID,
          requests,
          generatedAt: history.generatedAt,
          window: history.window || current.window || 'all',
          limit,
          offset,
          hasMore: canLoadMoreBoundedCodexLiveHistory(
            requests.length,
            requests.length > refreshedRequests.length ? limit : refreshedRequests.length,
            limit,
            codexLiveDetailHistoryMaxRetainedRequests,
          ),
          loading: false,
          error: undefined,
        };
      });
    } catch (error) {
      if (detailRequestVersionRef.current != requestVersion) {
        return;
      }
      console.error(error);
      setDetailState((current) => ({
        sessionID: selectedSessionID,
        requests: current.sessionID === selectedSessionID ? current.requests : [],
        generatedAt: current.generatedAt,
        window: current.window,
        limit: current.limit,
        offset: current.offset,
        hasMore: current.hasMore,
        loading: false,
        error: error instanceof Error ? error.message : 'detail-load-failed',
      }));
    }
  }, [browserMode, selectedSessionID, sidecarReady, snapshot.generatedAt, snapshot.sessions]);

  const loadMoreDetail = useCallback(async () => {
    if (browserMode || !selectedSessionID || !sidecarReady || detailState.loading || !detailState.hasMore) {
      return;
    }
    setDetailState((current) => ({ ...current, loading: true }));
    const requestVersion = detailRequestVersionRef.current + 1;
    detailRequestVersionRef.current = requestVersion;
    const nextOffset = detailState.offset + detailState.requests.length;
    const limit = detailState.limit || codexLiveDetailHistoryLimit;

    try {
      const nextHistory = await GetCodexLiveSessionHistory({
        sessionID: selectedSessionID,
        window: detailState.window || 'all',
        limit,
        offset: nextOffset,
      });
      const history = mapBackendCodexLiveSessionHistory(nextHistory);
      if (detailRequestVersionRef.current != requestVersion) {
        return;
      }
      const nextRequests = markCodexLiveHistoryRequests(history.items);
      setDetailState((current) => {
        const nextLimit = history.limit || limit;
        const requests = mergeBoundedCodexLiveHistoryRequests(
          current.requests,
          nextRequests,
          codexLiveDetailHistoryMaxRetainedRequests,
        );
        return {
          ...current,
          sessionID: selectedSessionID,
          requests,
          generatedAt: history.generatedAt,
          window: history.window || current.window,
          limit: nextLimit,
          offset: current.offset,
          hasMore: canLoadMoreBoundedCodexLiveHistory(
            requests.length,
            nextRequests.length,
            nextLimit,
            codexLiveDetailHistoryMaxRetainedRequests,
          ),
          loading: false,
          error: undefined,
        };
      });
    } catch (error) {
      if (detailRequestVersionRef.current != requestVersion) {
        return;
      }
      console.error(error);
      setDetailState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'detail-load-more-failed',
      }));
    }
  }, [browserMode, detailState.hasMore, detailState.limit, detailState.loading, detailState.offset, detailState.requests, detailState.window, selectedSessionID, sidecarReady]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const handleVisibilityChange = () => setDocumentHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const pollMs = resolveCodexLiveSessionsPollIntervalMs({
      browserMode,
      sidecarReady,
      hidden: documentHidden,
      activeSessionCount: snapshot.summary.activeSessions,
    });
    if (pollMs === null) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void refreshSnapshot();
    }, pollMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [browserMode, documentHidden, refreshSnapshot, sidecarReady, snapshot.summary.activeSessions]);

  useEffect(() => {
    if (browserMode || selectedSessionID !== detailState.sessionID) {
      void loadDetail();
    }
  }, [browserMode, detailState.sessionID, loadDetail, selectedSessionID]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const pollMs = resolveCodexLiveSessionDetailPollIntervalMs({
      browserMode,
      sidecarReady,
      hidden: documentHidden,
      hasSelection: Boolean(selectedSessionID),
    });
    if (pollMs === null) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadDetail();
    }, pollMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [browserMode, documentHidden, loadDetail, selectedSessionID, sidecarReady]);

  useEffect(() => {
    const pollMs = resolveCodexLiveSessionDetailPollIntervalMs({
      browserMode,
      sidecarReady,
      hidden: documentHidden,
      hasSelection: !selectedSessionID,
    });
    if (pollMs === null) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadOverview();
    }, pollMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [browserMode, documentHidden, loadOverview, selectedSessionID, sidecarReady]);

  const handleRefresh = useCallback(() => {
    void refreshSnapshot();
    void loadDetail();
    void loadOverview();
  }, [loadDetail, loadOverview, refreshSnapshot]);

  return (
    <CodexLiveSessionsWorkbench
      snapshot={snapshot}
      view={view}
      onViewChange={onViewChange}
      detailRequests={detailState.sessionID === selectedSessionID ? detailState.requests : []}
      overviewRequests={!selectedSessionID ? overviewState.requests : []}
      overviewHistoryLabel={!selectedSessionID ? buildHistoryWindowLabel(overviewState) : undefined}
      overviewCanLoadMore={!selectedSessionID && overviewState.hasMore}
      onLoadMoreOverview={loadMoreOverview}
      detailHistoryLabel={detailState.sessionID === selectedSessionID ? buildHistoryWindowLabel(detailState) : undefined}
      detailCanLoadMore={detailState.sessionID === selectedSessionID && detailState.hasMore}
      onLoadMoreDetail={loadMoreDetail}
      overviewLoading={!selectedSessionID && overviewState.loading}
      overviewError={!selectedSessionID ? overviewState.error : undefined}
      detailLoading={detailState.loading}
      detailError={detailState.sessionID === selectedSessionID ? detailState.error : undefined}
      onRefresh={handleRefresh}
      onClearSessions={clearSessions}
      onSelectionChange={setSelectedSessionID}
    />
  );
}

function createEmptyDetailHistoryState(): CodexLiveSessionDetailState {
  return {
    sessionID: undefined,
    requests: [],
    generatedAt: '',
    window: 'all',
    limit: codexLiveDetailHistoryLimit,
    offset: 0,
    hasMore: false,
    loading: false,
  };
}

function createEmptyOverviewHistoryState(): CodexLiveSessionOverviewState {
  return {
    requests: [],
    generatedAt: '',
    window: 'all',
    limit: codexLiveOverviewHistoryLimit,
    offset: 0,
    hasMore: false,
    loading: false,
  };
}

function markCodexLiveHistoryRequests(requests: readonly CodexLiveRequest[]): CodexLiveRequest[] {
  return requests.map((request) => ({
    ...request,
    historyState: isCodexLiveHistoryUnclosed(request.status) ? 'historical_unclosed' : 'history',
  }));
}

function isCodexLiveHistoryUnclosed(status: string): boolean {
  return status === 'active' || status === 'streaming' || status === 'reconnecting' || status === 'upstream_disconnected';
}

function buildHistoryWindowLabel(state: Pick<CodexLiveSessionOverviewState, 'requests' | 'limit' | 'offset' | 'window'>): string {
  const start = state.requests.length > 0 ? state.offset + 1 : 0;
  const end = state.offset + state.requests.length;
  const limit = state.limit || state.requests.length;
  return `History ${state.window || 'all'} · ${start}-${end} · ${limit}/page`;
}
