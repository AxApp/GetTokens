import { useCallback, useEffect, useRef, useState } from 'react';
import { ClearCodexLiveSessions, GetCodexLiveSessionHistory, GetCodexLiveSessionsSnapshot } from '../../../wailsjs/go/main/App';
import type { CodexLiveSessionsView, SidecarStatus } from '../../types';
import { hasWailsAppBindings } from '../../utils/previewMode';
import CodexLiveSessionsWorkbench from './components/CodexLiveSessionsWorkbench';
import { mapBackendCodexLiveSessionHistory, mapBackendCodexLiveSessionsSnapshot } from './model/adapters';
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

interface CodexLiveSessionsFeatureProps {
  sidecarStatus: SidecarStatus;
  view: CodexLiveSessionsView;
  onViewChange: (view: CodexLiveSessionsView) => void;
}

interface CodexLiveSessionDetailState {
  sessionID?: string;
  requests: CodexLiveRequest[];
  generatedAt: string;
  loading: boolean;
  error?: string;
}

interface CodexLiveSessionOverviewState {
  requests: CodexLiveRequest[];
  generatedAt: string;
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
    loading: false,
  });
  const [overviewState, setOverviewState] = useState<CodexLiveSessionOverviewState>({
    requests: [],
    generatedAt: '',
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
      setDetailState({ sessionID: undefined, requests: [], generatedAt: '', loading: false });
      setOverviewState({ requests: [], generatedAt: '', loading: false });
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
      setOverviewState({ requests, generatedAt: snapshot.generatedAt, loading: false });
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
        limit: 80,
        offset: 0,
      });
      const history = mapBackendCodexLiveSessionHistory(nextHistory);
      if (overviewRequestVersionRef.current != requestVersion) {
        return;
      }
      setOverviewState({
        requests: history.items,
        generatedAt: history.generatedAt,
        loading: false,
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

  const loadDetail = useCallback(async () => {
    if (!selectedSessionID) {
      detailRequestVersionRef.current += 1;
      setDetailState({ sessionID: undefined, requests: [], generatedAt: '', loading: false });
      return;
    }
    if (browserMode) {
      detailRequestVersionRef.current += 1;
      const previewSession = snapshot.sessions.find((session) => session.sessionID === selectedSessionID);
      setDetailState({
        sessionID: selectedSessionID,
        requests: previewSession?.requests ?? [],
        generatedAt: snapshot.generatedAt,
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
        loading: false,
        error: current.error,
      }));
      return;
    }

    setDetailState((current) => ({
      sessionID: selectedSessionID,
      requests: current.sessionID === selectedSessionID ? current.requests : [],
      generatedAt: current.generatedAt,
      loading: true,
    }));
    const requestVersion = detailRequestVersionRef.current + 1;
    detailRequestVersionRef.current = requestVersion;

    try {
      const nextHistory = await GetCodexLiveSessionHistory({
        sessionID: selectedSessionID,
        window: 'all',
        limit: 50,
        offset: 0,
      });
      const history = mapBackendCodexLiveSessionHistory(nextHistory);
      if (detailRequestVersionRef.current != requestVersion) {
        return;
      }
      setDetailState({
        sessionID: selectedSessionID,
        requests: history.items,
        generatedAt: history.generatedAt,
        loading: false,
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
        loading: false,
        error: error instanceof Error ? error.message : 'detail-load-failed',
      }));
    }
  }, [browserMode, selectedSessionID, sidecarReady, snapshot.generatedAt, snapshot.sessions]);

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
