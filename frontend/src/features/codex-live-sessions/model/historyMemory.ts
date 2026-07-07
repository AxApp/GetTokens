import type { CodexLiveRequest } from './types';

export const codexLiveOverviewHistoryMaxRetainedRequests = 400;
export const codexLiveDetailHistoryMaxRetainedRequests = 250;

export function mergeBoundedCodexLiveHistoryRequests(
  current: readonly CodexLiveRequest[],
  next: readonly CodexLiveRequest[],
  maxRequests: number,
): CodexLiveRequest[] {
  const limit = normalizeHistoryRequestLimit(maxRequests);
  if (limit <= 0) {
    return [];
  }

  const seen = new Set(current.map((request) => request.requestID));
  const merged = [...current];
  next.forEach((request) => {
    if (!seen.has(request.requestID)) {
      seen.add(request.requestID);
      merged.push(request);
    }
  });
  return merged.slice(0, limit);
}

export function mergeBoundedCodexLiveHistoryRefresh(
  current: readonly CodexLiveRequest[],
  refreshed: readonly CodexLiveRequest[],
  maxRequests: number,
): CodexLiveRequest[] {
  const limit = normalizeHistoryRequestLimit(maxRequests);
  if (limit <= 0) {
    return [];
  }
  if (current.length <= refreshed.length) {
    return [...refreshed].slice(0, limit);
  }

  const refreshedIDs = new Set(refreshed.map((request) => request.requestID));
  const preservedTail = current.filter((request) => !refreshedIDs.has(request.requestID));
  return [...refreshed, ...preservedTail].slice(0, limit);
}

export function canLoadMoreBoundedCodexLiveHistory(
  retainedRequestCount: number,
  fetchedRequestCount: number,
  pageLimit: number,
  maxRequests: number,
): boolean {
  const limit = normalizeHistoryRequestLimit(pageLimit);
  const maxRetained = normalizeHistoryRequestLimit(maxRequests);
  return maxRetained > 0 && limit > 0 && retainedRequestCount < maxRetained && fetchedRequestCount >= limit;
}

function normalizeHistoryRequestLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}
