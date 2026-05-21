import {
  codexLiveSessionsPreviewSnapshot,
  codexLiveSessionsSidecarNotReadySnapshot,
} from './mockData.ts';
import { snapshotWithDerivedSummary } from './selectors.ts';
import type { CodexLiveSessionSnapshot } from './types';

const unavailableSnapshot: CodexLiveSessionSnapshot = snapshotWithDerivedSummary({
  generatedAt: '',
  sidecarReady: false,
  source: 'unavailable',
  retentionLabel: '',
  summary: {
    activeSessions: 0,
    activeRequests: 0,
    websocketSessions: 0,
    httpSessions: 0,
    degradedSessions: 0,
    errorSessions: 0,
  },
  sessions: [],
});

export function buildCodexLiveSessionsInitialSnapshot(input: {
  browserMode: boolean;
  sidecarReady: boolean;
}): CodexLiveSessionSnapshot {
  if (input.browserMode) {
    return input.sidecarReady ? codexLiveSessionsPreviewSnapshot : codexLiveSessionsSidecarNotReadySnapshot;
  }
  return unavailableSnapshot;
}

export function buildCodexLiveSessionsLoadFailureSnapshot(
  current: CodexLiveSessionSnapshot,
): CodexLiveSessionSnapshot {
  if (current.source === 'live' && current.sessions.length > 0) {
    return {
      ...current,
      sidecarReady: false,
      source: 'cache',
    };
  }
  return unavailableSnapshot;
}

export function buildCodexLiveSessionsSidecarUnavailableSnapshot(): CodexLiveSessionSnapshot {
  return unavailableSnapshot;
}
