import type { CodexLiveRequest } from './types';

export type CodexLiveTimingTrendMetric = 'totalDurationMs' | 'firstEventMs' | 'firstTokenMs';

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
}

interface BuildCodexLiveRequestTimingTrendOptions {
  nowMs?: number;
}

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

  const points = Array.from(byID.values())
    .map((request) => buildTimingTrendPoint(request, options))
    .filter((point): point is CodexLiveRequestTimingTrendPoint => Boolean(point))
    .sort((left, right) => left.startedAtMs - right.startedAtMs || left.sequence - right.sequence);

  const maxMs = points.reduce((max, point) => {
    return Math.max(
      max,
      point.values.totalDurationMs ?? 0,
      point.values.firstEventMs ?? 0,
      point.values.firstTokenMs ?? 0,
    );
  }, 0);
  const startedAtValues = points.map((point) => point.startedAtMs);
  const startedAtMinMs = startedAtValues.length > 0 ? Math.min(...startedAtValues) : 0;
  const startedAtMaxMs = startedAtValues.length > 0 ? Math.max(...startedAtValues) : 0;

  return {
    points,
    maxMs,
    hasData: maxMs > 0,
    startedAtMinMs,
    startedAtMaxMs,
  };
}

function buildTimingTrendPoint(
  request: CodexLiveRequest,
  options: BuildCodexLiveRequestTimingTrendOptions,
): CodexLiveRequestTimingTrendPoint | null {
  const startedAtMs = Date.parse(request.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  const isLive = isLiveRequest(request);
  const values = {
    totalDurationMs: normalizeTimingValue(request.timing?.totalDurationMs),
    firstEventMs: normalizeTimingValue(request.timing?.firstEventMs),
    firstTokenMs: normalizeTimingValue(request.timing?.firstTokenMs),
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

function isLiveRequest(request: CodexLiveRequest): boolean {
  return !request.completedAt && liveStatuses.has(request.status);
}

function normalizeTimingValue(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value);
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
