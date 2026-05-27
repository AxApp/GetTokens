import type { CodexLiveRequest } from './types';

export type CodexLiveTimingTrendMetric =
  | 'totalDurationMs'
  | 'firstEventMs'
  | 'firstTokenMs'
  | 'streamDurationMs'
  | 'queueWaitMs'
  | 'authSelectMs'
  | 'upstreamConnectMs'
  | 'averageEventGapMs'
  | 'longestEventGapMs';

export interface CodexLiveRequestTimingTrendPoint {
  requestID: string;
  sequence: number;
  startedAt: string;
  startedAtMs: number;
  label: string;
  isLive: boolean;
  values: Record<CodexLiveTimingTrendMetric, number | null>;
}

export interface CodexLiveRequestTimingTrend {
  points: CodexLiveRequestTimingTrendPoint[];
  maxMs: number;
  hasData: boolean;
  startedAtMinMs: number;
  startedAtMaxMs: number;
  windowMs: number;
  maxPoints: number;
}

interface BuildCodexLiveRequestTimingTrendOptions {
  maxPoints?: number;
  nowMs?: number;
}

export const codexLiveRequestTimingTrendMaxPoints = 50;
const liveElapsedMaxMs = 2 * 60 * 60 * 1000;
const liveStatuses: ReadonlySet<CodexLiveRequest['status']> = new Set(['active', 'streaming', 'reconnecting']);

export function buildCodexLiveRequestTimingTrend(
  requests: readonly CodexLiveRequest[],
  activeRequest?: CodexLiveRequest,
  options: BuildCodexLiveRequestTimingTrendOptions = {},
): CodexLiveRequestTimingTrend {
  const byID = new Map<string, CodexLiveRequest>();
  for (const request of requests) {
    byID.set(request.requestID, request);
  }
  if (activeRequest) {
    byID.set(activeRequest.requestID, activeRequest);
  }
  const activeRequestID = activeRequest?.requestID;

  const points = Array.from(byID.values())
    .map((request) => buildTimingTrendPoint(request, options, activeRequestID))
    .filter((point): point is CodexLiveRequestTimingTrendPoint => Boolean(point))
    .sort((left, right) => left.startedAtMs - right.startedAtMs || left.sequence - right.sequence);
  const maxPoints = normalizeTimingMaxPoints(options.maxPoints);
  const windowedPoints = points.slice(-maxPoints);
  const startedAtMinMs = windowedPoints[0]?.startedAtMs ?? 0;
  const startedAtMaxMs = windowedPoints[windowedPoints.length - 1]?.startedAtMs ?? 0;
  const windowMs = Math.max(0, startedAtMaxMs - startedAtMinMs);

  const maxMs = windowedPoints.reduce((max, point) => {
    return Math.max(max, ...Object.values(point.values).map((value) => value ?? 0));
  }, 0);

  return {
    points: windowedPoints,
    maxMs,
    hasData: maxMs > 0,
    startedAtMinMs,
    startedAtMaxMs,
    windowMs,
    maxPoints,
  };
}

function buildTimingTrendPoint(
  request: CodexLiveRequest,
  options: BuildCodexLiveRequestTimingTrendOptions,
  activeRequestID?: string,
): CodexLiveRequestTimingTrendPoint | null {
  const startedAtMs = Date.parse(request.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  const isLive = isLiveRequest(request, activeRequestID);
  const values = {
    totalDurationMs: normalizeTimingValue(request.timing?.totalDurationMs),
    firstEventMs: normalizeTimingValue(request.timing?.firstEventMs),
    firstTokenMs: normalizeTimingValue(request.timing?.firstTokenMs),
    streamDurationMs: normalizeTimingValue(request.timing?.streamDurationMs),
    queueWaitMs: normalizeTimingValue(request.timing?.queueWaitMs),
    authSelectMs: normalizeTimingValue(request.timing?.authSelectMs),
    upstreamConnectMs: normalizeTimingValue(request.timing?.upstreamConnectMs),
    averageEventGapMs: normalizeTimingValue(request.timing?.averageEventGapMs),
    longestEventGapMs: normalizeTimingValue(request.timing?.longestEventGapMs),
  };

  if (!values.totalDurationMs && request.completedAt) {
    const completedAtMs = Date.parse(request.completedAt);
    if (Number.isFinite(completedAtMs) && completedAtMs >= startedAtMs) {
      values.totalDurationMs = completedAtMs - startedAtMs;
    }
  }
  if (isLive && typeof options.nowMs === 'number' && Number.isFinite(options.nowMs) && options.nowMs >= startedAtMs) {
    const elapsedMs = Math.round(options.nowMs - startedAtMs);
    if (elapsedMs <= liveElapsedMaxMs) {
      values.totalDurationMs = Math.max(values.totalDurationMs ?? 0, elapsedMs);
    }
  }

  return {
    requestID: request.requestID,
    sequence: request.sequence,
    startedAt: request.startedAt,
    startedAtMs,
    label: buildTimingTrendLabel(request, startedAtMs),
    isLive,
    values,
  };
}

function isLiveRequest(request: CodexLiveRequest, activeRequestID?: string): boolean {
  if (activeRequestID && request.requestID !== activeRequestID) {
    return false;
  }
  return !request.completedAt && liveStatuses.has(request.status);
}

function normalizeTimingValue(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value);
}

function normalizeTimingMaxPoints(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return codexLiveRequestTimingTrendMaxPoints;
  }
  return Math.max(1, Math.round(value));
}

function buildTimingTrendLabel(request: CodexLiveRequest, startedAtMs: number): string {
  const timeLabel = new Date(startedAtMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `#${request.sequence} ${timeLabel}`;
}
