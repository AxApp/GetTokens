import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionSnapshot,
  CodexLiveSessionSource,
  CodexLiveTimingMetrics,
  CodexLiveTimingSummary,
  CodexLiveTimelineEvent,
} from './types';

const liveStatuses = new Set(['active', 'streaming', 'reconnecting']);

export function mergeCodexLiveSessionsSnapshot(
  current: CodexLiveSessionSnapshot,
  next: CodexLiveSessionSnapshot,
): CodexLiveSessionSnapshot {
  if (current.source !== next.source || current.sidecarReady !== next.sidecarReady || current.retentionLabel !== next.retentionLabel) {
    return next;
  }

  if (!hasSummaryChanged(current, next) && areSessionsStructurallyEqual(current.sessions, next.sessions, current.source)) {
    return current;
  }

  const currentByID = new Map(current.sessions.map((session) => [session.sessionID, session]));
  let changed = current.sessions.length !== next.sessions.length;
  const sessions = next.sessions.map((nextSession, index) => {
    const currentSession = currentByID.get(nextSession.sessionID);
    if (!currentSession) {
      changed = true;
      return nextSession;
    }
    if (current.sessions[index]?.sessionID !== nextSession.sessionID) {
      changed = true;
    }
    if (areSessionsStructurallyEqual([currentSession], [nextSession], current.source)) {
      return currentSession;
    }
    changed = true;
    return mergeCodexLiveSession(currentSession, nextSession, current.source);
  });

  if (!changed) {
    return current;
  }

  return {
    ...next,
    sessions,
  };
}

function mergeCodexLiveSession(
  current: CodexLiveSession,
  next: CodexLiveSession,
  source: CodexLiveSessionSource,
): CodexLiveSession {
  const currentRequestsByID = new Map(current.requests.map((request) => [request.requestID, request]));
  let changed = current.requests.length !== next.requests.length;
  const requests = next.requests.map((nextRequest, index) => {
    const currentRequest = currentRequestsByID.get(nextRequest.requestID);
    if (!currentRequest) {
      changed = true;
      return nextRequest;
    }
    if (current.requests[index]?.requestID !== nextRequest.requestID) {
      changed = true;
    }
    if (areRequestStructurallyEqual(currentRequest, nextRequest, source)) {
      return currentRequest;
    }
    changed = true;
    return nextRequest;
  });

  return changed ? { ...next, requests } : next;
}

function hasSummaryChanged(current: CodexLiveSessionSnapshot, next: CodexLiveSessionSnapshot): boolean {
  return stableStringify(current.summary) !== stableStringify(next.summary);
}

function areSessionsStructurallyEqual(
  current: readonly CodexLiveSession[],
  next: readonly CodexLiveSession[],
  source: CodexLiveSessionSource,
): boolean {
  if (current.length !== next.length) {
    return false;
  }
  return current.every((session, index) => {
    const nextSession = next[index];
    return Boolean(nextSession) && stableStringify(normalizeSessionForDiff(session, source)) === stableStringify(normalizeSessionForDiff(nextSession, source));
  });
}

function areRequestStructurallyEqual(
  current: CodexLiveRequest,
  next: CodexLiveRequest,
  source: CodexLiveSessionSource,
): boolean {
  return stableStringify(normalizeRequestForDiff(current, source)) === stableStringify(normalizeRequestForDiff(next, source));
}

function normalizeSessionForDiff(session: CodexLiveSession, source: CodexLiveSessionSource) {
  const normalized: Record<string, unknown> = {
    ...session,
    requests: session.requests.map((request) => normalizeRequestForDiff(request, source)),
    recentEvents: session.recentEvents.map((event) => normalizeTimelineEventForDiff(event, source)),
    timingSummary: normalizeTimingSummaryForDiff(session.timingSummary, source, session),
  };

  if (isPreviewLikeSource(source)) {
    delete normalized.startedAt;
    delete normalized.lastEventAt;
    delete normalized.durationMs;
  } else if (isLiveStatus(session.status)) {
    delete normalized.durationMs;
  }

  return normalized;
}

function normalizeTimingSummaryForDiff(
  summary: CodexLiveTimingSummary | undefined,
  source: CodexLiveSessionSource,
  session: CodexLiveSession,
): CodexLiveTimingSummary | undefined {
  if (!summary) {
    return undefined;
  }
  const normalized: CodexLiveTimingSummary = {
    ...summary,
    averages: { ...summary.averages },
  };
  delete normalized.generatedAt;
  if (isPreviewLikeSource(source) || (Boolean(summary.activeIncluded) && isLiveStatus(session.status))) {
    delete normalized.averages.totalDurationMs;
    delete normalized.averages.streamDurationMs;
  }
  if (isPreviewLikeSource(source) && Boolean(summary.activeIncluded)) {
    delete normalized.averages.outputTokensPerSecond;
    delete normalized.averages.totalTokensPerSecond;
  }
  return normalized;
}

function normalizeRequestForDiff(request: CodexLiveRequest, source: CodexLiveSessionSource) {
  const normalized: Record<string, unknown> = {
    ...request,
    timing: normalizeTimingForDiff(request.timing, source, request),
    timeline: request.timeline.map((event) => normalizeTimelineEventForDiff(event, source)),
  };

  if (isPreviewLikeSource(source)) {
    delete normalized.startedAt;
    delete normalized.completedAt;
  }

  return normalized;
}

function normalizeTimingForDiff(
  timing: CodexLiveTimingMetrics | undefined,
  source: CodexLiveSessionSource,
  request: CodexLiveRequest,
): CodexLiveTimingMetrics | undefined {
  if (!timing) {
    return undefined;
  }
  const normalized: Partial<CodexLiveTimingMetrics> = { ...timing };
  if (isPreviewLikeSource(source) || (!request.completedAt && isLiveStatus(request.status))) {
    delete normalized.totalDurationMs;
    delete normalized.streamDurationMs;
  }
  if (isPreviewLikeSource(source) && !request.completedAt && isLiveStatus(request.status)) {
    delete normalized.outputTokensPerSecond;
    delete normalized.totalTokensPerSecond;
  }
  return normalized;
}

function normalizeTimelineEventForDiff(event: CodexLiveTimelineEvent, source: CodexLiveSessionSource) {
  if (!isPreviewLikeSource(source)) {
    return event;
  }
  const normalized: Partial<CodexLiveTimelineEvent> = { ...event };
  delete normalized.at;
  return normalized;
}

function isLiveStatus(status: string): boolean {
  return liveStatuses.has(status);
}

function isPreviewLikeSource(source: CodexLiveSessionSource): boolean {
  return source === 'preview' || source === 'cache';
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}
