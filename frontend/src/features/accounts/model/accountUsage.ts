import type { AccountRecord } from '../../../types';

export interface UsageDetail {
  timestamp: string;
  source: string;
  auth_index: string | number | null;
  latency_ms?: number;
  failed: boolean;
}

export interface KeyStatBucket {
  success: number;
  failure: number;
}

export interface KeyStats {
  bySource: Record<string, KeyStatBucket>;
  byAuthIndex: Record<string, KeyStatBucket>;
}

export type StatusBlockState = 'success' | 'failure' | 'mixed' | 'idle';

export interface StatusBlockDetail {
  success: number;
  failure: number;
  rate: number;
  startTime: number;
  endTime: number;
}

export interface StatusBarData {
  blocks: StatusBlockState[];
  blockDetails: StatusBlockDetail[];
  successRate: number;
  totalSuccess: number;
  totalFailure: number;
}

export interface AccountUsageSummary {
  source: 'none' | 'legacy' | 'attribution';
  loadState?: 'ready' | 'empty' | 'stale' | 'error';
  errorMessage?: string;
  hasData: boolean;
  requestCount: number;
  failedCount: number;
  success: number;
  failure: number;
  successRate: number | null;
  averageLatencyMs: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastActivityAt: number | null;
  attributionKey: string;
  attributionKind: string;
  provider: string;
  requestedModels: string[];
  trafficBuckets: AccountUsageTrafficBucket[];
  statusBar: StatusBarData;
}

export interface AccountUsageTrafficBucket {
  start: string;
  requestCount: number;
  failedCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AccountTodayUsageTotals {
  requestCount: number;
  totalTokens: number;
}

export interface AccountUsageAttributionBucket {
  start: string;
  requestCount: number;
  failedCount?: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export function resolveUnboundedTrafficActivityPercent(
  currentValue: number,
  bucketValues: Array<number | null | undefined>,
): number {
  const current = normalizeTrafficActivityValue(currentValue);
  if (current <= 0) return 0;

  const recentBuckets = bucketValues
    .map((value) => normalizeTrafficActivityValue(value))
    .filter((value) => value > 0);

  if (recentBuckets.length === 0) return 12;

  const baseline = Math.max(...recentBuckets) * recentBuckets.length;
  if (baseline <= 0) return 12;

  const percent = Math.round((current / baseline) * 100);
  return Math.min(100, Math.max(8, percent));
}

function normalizeTrafficActivityValue(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function isSameLocalCalendarDay(timestamp: string, nowMs: number) {
  const time = parseTimestampMs(timestamp);
  if (!Number.isFinite(time) || !Number.isFinite(nowMs)) {
    return false;
  }
  const bucketDate = new Date(time);
  const nowDate = new Date(nowMs);
  return (
    bucketDate.getFullYear() === nowDate.getFullYear() &&
    bucketDate.getMonth() === nowDate.getMonth() &&
    bucketDate.getDate() === nowDate.getDate()
  );
}

export function buildAccountTodayUsageTotals(
  summary: AccountUsageSummary | undefined,
  nowMs: number = Date.now(),
): AccountTodayUsageTotals {
  const buckets = summary?.trafficBuckets ?? [];
  if (buckets.length === 0) {
    return {
      requestCount: Math.max(0, Number(summary?.requestCount ?? 0)),
      totalTokens: Math.max(0, Number(summary?.totalTokens ?? 0)),
    };
  }

  return buckets.reduce<AccountTodayUsageTotals>(
    (result, bucket) => {
      if (!isSameLocalCalendarDay(bucket.start, nowMs)) {
        return result;
      }
      return {
        requestCount: result.requestCount + Math.max(0, Number(bucket.requestCount ?? 0)),
        totalTokens: result.totalTokens + Math.max(0, Number(bucket.totalTokens ?? 0)),
      };
    },
    { requestCount: 0, totalTokens: 0 },
  );
}

export interface AccountUsageAttributionItem {
  attributionKey?: string;
  attributionKind?: string;
  accountKey?: string;
  provider?: string;
  requestedModels?: string[];
  requestCount: number;
  failedCount?: number;
  latencyAverageMs?: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  lastActivityAt?: string;
  buckets?: AccountUsageAttributionBucket[];
}

export interface AccountUsageAttributionResponse {
  items?: AccountUsageAttributionItem[];
  unresolved?: AccountUsageAttributionItem[];
}

interface AccountUsageAttributionIndex {
  byAccountKey: Map<string, AccountUsageAttributionItem[]>;
  byAuthIndex: Map<string, AccountUsageAttributionItem[]>;
}

export const ACCOUNT_USAGE_REFRESH_INTERVAL_MS = 15_000;

const EMPTY_STATUS_BAR: StatusBarData = {
  blocks: Array.from({ length: 20 }, () => 'idle'),
  blockDetails: Array.from({ length: 20 }, () => ({
    success: 0,
    failure: 0,
    rate: -1,
    startTime: 0,
    endTime: 0,
  })),
  successRate: 100,
  totalSuccess: 0,
  totalFailure: 0,
};

const USAGE_SOURCE_PREFIX_KEY = 'k:';
const USAGE_SOURCE_PREFIX_TEXT = 't:';

const KEY_LIKE_TOKEN_REGEX =
  /(sk-[A-Za-z0-9-_]{6,}|sk-ant-[A-Za-z0-9-_]{6,}|AIza[0-9A-Za-z-_]{8,}|AI[a-zA-Z0-9_-]{6,}|hf_[A-Za-z0-9]{6,}|pk_[A-Za-z0-9]{6,}|rk_[A-Za-z0-9]{6,})/;

export function normalizeAuthIndex(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function fnv1a64Hex(value: string) {
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;

  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, '0');
}

function looksLikeRawSecret(text: string) {
  if (!text || /\s/.test(text)) return false;

  const lower = text.toLowerCase();
  if (lower.endsWith('.json')) return false;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return false;
  if (/[\\/]/.test(text)) return false;

  if (KEY_LIKE_TOKEN_REGEX.test(text)) return true;

  if (text.length >= 32 && text.length <= 512) {
    return true;
  }

  if (text.length >= 16 && text.length < 32 && /^[A-Za-z0-9._=-]+$/.test(text)) {
    return /[A-Za-z]/.test(text) && /\d/.test(text);
  }

  return false;
}

function extractRawSecretFromText(text: string) {
  if (!text) return null;
  if (looksLikeRawSecret(text)) return text;

  const keyLikeMatch = text.match(KEY_LIKE_TOKEN_REGEX);
  if (keyLikeMatch?.[0]) return keyLikeMatch[0];

  const queryMatch = text.match(
    /(?:[?&])(api[-_]?key|key|token|access_token|authorization)=([^&#\s]+)/i
  );
  const queryValue = queryMatch?.[2];
  if (queryValue && looksLikeRawSecret(queryValue)) {
    return queryValue;
  }

  const headerMatch = text.match(
    /(api[-_]?key|key|token|access[-_]?token|authorization)\s*[:=]\s*([A-Za-z0-9._=-]+)/i
  );
  const headerValue = headerMatch?.[2];
  if (headerValue && looksLikeRawSecret(headerValue)) {
    return headerValue;
  }

  const bearerMatch = text.match(/\bBearer\s+([A-Za-z0-9._=-]{6,})/i);
  const bearerValue = bearerMatch?.[1];
  if (bearerValue && looksLikeRawSecret(bearerValue)) {
    return bearerValue;
  }

  return null;
}

export function normalizeUsageSourceId(value: unknown) {
  const raw =
    typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const extracted = extractRawSecretFromText(trimmed);
  if (extracted) {
    return `${USAGE_SOURCE_PREFIX_KEY}${fnv1a64Hex(extracted)}`;
  }

  return `${USAGE_SOURCE_PREFIX_TEXT}${trimmed}`;
}

export function buildCandidateUsageSourceIds(input: { apiKey?: string; prefix?: string }) {
  const result: string[] = [];

  const prefix = input.prefix?.trim();
  if (prefix) {
    result.push(`${USAGE_SOURCE_PREFIX_TEXT}${prefix}`);
  }

  const apiKey = input.apiKey?.trim();
  if (apiKey) {
    result.push(normalizeUsageSourceId(apiKey));
    result.push(`${USAGE_SOURCE_PREFIX_KEY}${fnv1a64Hex(apiKey)}`);
  }

  return Array.from(new Set(result));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseTimestampMs(value: unknown) {
  if (typeof value !== 'string') {
    return Number.NaN;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function shouldScheduleAccountUsageRefresh(input: {
  ready: boolean;
  hasRuntimeBindings: boolean;
  accounts: AccountRecord[];
}) {
  return input.ready && input.hasRuntimeBindings && input.accounts.length > 0;
}

export function collectUsageDetails(usageData: unknown): UsageDetail[] {
  const usageRecord = isRecord(usageData) ? usageData : null;
  const apis = usageRecord && isRecord(usageRecord.apis) ? usageRecord.apis : null;
  if (!apis) {
    return [];
  }

  const details: UsageDetail[] = [];

  Object.values(apis).forEach((apiEntry) => {
    if (!isRecord(apiEntry) || !isRecord(apiEntry.models)) {
      return;
    }

    Object.values(apiEntry.models).forEach((modelEntry) => {
      if (!isRecord(modelEntry) || !Array.isArray(modelEntry.details)) {
        return;
      }

      modelEntry.details.forEach((detail) => {
        if (!isRecord(detail)) {
          return;
        }
        const timestamp = typeof detail.timestamp === 'string' ? detail.timestamp : '';
        if (!timestamp) {
          return;
        }

        details.push({
          timestamp,
          source: normalizeUsageSourceId(detail.source),
          auth_index:
            typeof detail.auth_index === 'string' || typeof detail.auth_index === 'number'
              ? detail.auth_index
              : null,
          latency_ms:
            typeof detail.latency_ms === 'number' && Number.isFinite(detail.latency_ms)
              ? detail.latency_ms
              : undefined,
          failed: detail.failed === true,
        });
      });
    });
  });

  return details;
}

export function calculateStatusBarData(usageDetails: UsageDetail[], nowMs: number = Date.now()): StatusBarData {
  const blockCount = 20;
  const blockDurationMs = 10 * 60 * 1000;
  const windowMs = blockCount * blockDurationMs;
  const windowStart = nowMs - windowMs;

  const blockStats: Array<{ success: number; failure: number }> = Array.from(
    { length: blockCount },
    () => ({ success: 0, failure: 0 })
  );

  let totalSuccess = 0;
  let totalFailure = 0;

  usageDetails.forEach((detail) => {
    const timestamp = parseTimestampMs(detail.timestamp);
    if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > nowMs) {
      return;
    }

    const ageMs = nowMs - timestamp;
    const blockIndex = blockCount - 1 - Math.floor(ageMs / blockDurationMs);
    if (blockIndex < 0 || blockIndex >= blockCount) {
      return;
    }

    if (detail.failed) {
      blockStats[blockIndex].failure += 1;
      totalFailure += 1;
      return;
    }
    blockStats[blockIndex].success += 1;
    totalSuccess += 1;
  });

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBlockDetail[] = [];

  blockStats.forEach((stat, index) => {
    const total = stat.success + stat.failure;
    if (total === 0) {
      blocks.push('idle');
    } else if (stat.failure === 0) {
      blocks.push('success');
    } else if (stat.success === 0) {
      blocks.push('failure');
    } else {
      blocks.push('mixed');
    }

    const blockStartTime = windowStart + index * blockDurationMs;
    blockDetails.push({
      success: stat.success,
      failure: stat.failure,
      rate: total > 0 ? stat.success / total : -1,
      startTime: blockStartTime,
      endTime: blockStartTime + blockDurationMs,
    });
  });

  const total = totalSuccess + totalFailure;
  return {
    blocks,
    blockDetails,
    successRate: total > 0 ? (totalSuccess / total) * 100 : 100,
    totalSuccess,
    totalFailure,
  };
}

function resolveStatusBlockState(success: number, failure: number): StatusBlockState {
  if (success + failure === 0) {
    return 'idle';
  }
  if (failure === 0) {
    return 'success';
  }
  if (success === 0) {
    return 'failure';
  }
  return 'mixed';
}

function resolveResponsiveBlockCount(sourceBlockCount: number, containerWidth: number | null | undefined) {
  if (!Number.isFinite(containerWidth) || !containerWidth || containerWidth <= 0) {
    return sourceBlockCount;
  }

  const minReadableBlockWidth = 8;
  const blockGap = 6;
  const availableCount = Math.floor((containerWidth + blockGap) / (minReadableBlockWidth + blockGap));
  return Math.max(4, Math.min(sourceBlockCount, availableCount));
}

export function resolveResponsiveStatusBarData(statusBar: StatusBarData, containerWidth: number | null | undefined): StatusBarData {
  const sourceBlockCount = statusBar.blocks.length;
  const targetBlockCount = resolveResponsiveBlockCount(sourceBlockCount, containerWidth);
  if (targetBlockCount >= sourceBlockCount) {
    return statusBar;
  }

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBlockDetail[] = [];

  for (let index = 0; index < targetBlockCount; index += 1) {
    const startIndex = Math.floor((index * sourceBlockCount) / targetBlockCount);
    const endIndex = Math.floor(((index + 1) * sourceBlockCount) / targetBlockCount);
    const details = statusBar.blockDetails.slice(startIndex, Math.max(startIndex + 1, endIndex));
    let success = 0;
    let failure = 0;

    details.forEach((detail) => {
      success += detail.success;
      failure += detail.failure;
    });

    blocks.push(resolveStatusBlockState(success, failure));
    blockDetails.push({
      success,
      failure,
      rate: success + failure > 0 ? success / (success + failure) : -1,
      startTime: details[0]?.startTime ?? 0,
      endTime: details[details.length - 1]?.endTime ?? 0,
    });
  }

  return {
    blocks,
    blockDetails,
    successRate: statusBar.successRate,
    totalSuccess: statusBar.totalSuccess,
    totalFailure: statusBar.totalFailure,
  };
}

function buildEmptyAccountUsageSummary(): AccountUsageSummary {
  return {
    source: 'none',
    loadState: 'empty',
    errorMessage: '',
    hasData: false,
    requestCount: 0,
    failedCount: 0,
    success: 0,
    failure: 0,
    successRate: null,
    averageLatencyMs: null,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    lastActivityAt: null,
    attributionKey: '',
    attributionKind: '',
    provider: '',
    requestedModels: [],
    trafficBuckets: [],
    statusBar: EMPTY_STATUS_BAR,
  };
}

function usageErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  if (isRecord(error) && typeof error.message === 'string') return error.message.trim();
  return 'Usage data loading failed';
}

function buildFailedAccountUsageSummary(previous: AccountUsageSummary | undefined, error: unknown): AccountUsageSummary {
  const message = usageErrorMessage(error);
  if (previous) {
    return {
      ...previous,
      loadState: previous.hasData ? 'stale' : 'error',
      errorMessage: message,
    };
  }
  return {
    ...buildEmptyAccountUsageSummary(),
    loadState: 'error',
    errorMessage: message,
  };
}

function isAttributionResponse(payload: unknown): payload is AccountUsageAttributionResponse {
  return isRecord(payload) && (Array.isArray(payload.items) || Array.isArray(payload.unresolved));
}

function inferAttributionBucketDurationMs(buckets: AccountUsageAttributionBucket[]) {
  if (buckets.length < 2) {
    return 60 * 60 * 1000;
  }
  const current = parseTimestampMs(buckets[buckets.length - 1]?.start);
  const previous = parseTimestampMs(buckets[buckets.length - 2]?.start);
  const duration = current - previous;
  return Number.isFinite(duration) && duration > 0 ? duration : 60 * 60 * 1000;
}

function calculateStatusBarDataFromAttributionBuckets(
  buckets: AccountUsageAttributionBucket[],
): StatusBarData {
  const blockCount = 20;
  const relevantBuckets = buckets.slice(-blockCount);
  const bucketDurationMs = inferAttributionBucketDurationMs(relevantBuckets);
  const paddedBuckets: Array<AccountUsageAttributionBucket | null> = [
    ...Array.from({ length: Math.max(0, blockCount - relevantBuckets.length) }, () => null),
    ...relevantBuckets,
  ];

  const blocks: StatusBlockState[] = [];
  const blockDetails: StatusBlockDetail[] = [];
  let totalSuccess = 0;
  let totalFailure = 0;

  paddedBuckets.forEach((bucket) => {
    const requestCount = Math.max(0, Number(bucket?.requestCount ?? 0));
    const failure = Math.max(0, Number(bucket?.failedCount ?? 0));
    const success = Math.max(0, requestCount - failure);
    totalSuccess += success;
    totalFailure += failure;
    blocks.push(resolveStatusBlockState(success, failure));

    const startTime = bucket ? parseTimestampMs(bucket.start) : 0;
    blockDetails.push({
      success,
      failure,
      rate: success + failure > 0 ? success / (success + failure) : -1,
      startTime: Number.isFinite(startTime) ? startTime : 0,
      endTime: Number.isFinite(startTime) ? startTime + bucketDurationMs : 0,
    });
  });

  const total = totalSuccess + totalFailure;
  return {
    blocks,
    blockDetails,
    successRate: total > 0 ? (totalSuccess / total) * 100 : 100,
    totalSuccess,
    totalFailure,
  };
}

function buildAccountUsageSummaryFromAttribution(
  account: AccountRecord,
  attribution: AccountUsageAttributionResponse,
  index?: AccountUsageAttributionIndex,
): AccountUsageSummary {
  const matchedItems = collectAccountUsageAttributionItems(account, attribution, index);
  if (matchedItems.length === 0) {
    return buildEmptyAccountUsageSummary();
  }

  const item = mergeAccountUsageAttributionItems(matchedItems);
  const requestCount = item.requestCount;
  const failedCount = item.failedCount ?? 0;
  const success = Math.max(0, requestCount - failedCount);
  const lastActivityAt = item.lastActivityAt ? parseTimestampMs(item.lastActivityAt) : Number.NaN;
  const trafficBuckets = Array.isArray(item.buckets)
    ? item.buckets.map((bucket) => ({
        start: bucket.start,
        requestCount: Math.max(0, Number(bucket.requestCount ?? 0)),
        failedCount: Math.max(0, Number(bucket.failedCount ?? 0)),
        inputTokens: Math.max(0, Number(bucket.inputTokens ?? 0)),
        cachedInputTokens: Math.max(0, Number(bucket.cachedInputTokens ?? 0)),
        outputTokens: Math.max(0, Number(bucket.outputTokens ?? 0)),
        totalTokens: Math.max(
          0,
          Number(bucket.totalTokens ?? 0) ||
            Number(bucket.inputTokens ?? 0) +
              Number(bucket.cachedInputTokens ?? 0) +
              Number(bucket.outputTokens ?? 0),
        ),
      }))
    : [];

  return {
    source: 'attribution',
    loadState: requestCount > 0 ? 'ready' : 'empty',
    errorMessage: '',
    hasData: requestCount > 0,
    requestCount,
    failedCount,
    success,
    failure: failedCount,
    successRate: requestCount > 0 ? (success / requestCount) * 100 : null,
    averageLatencyMs:
      typeof item.latencyAverageMs === 'number' && Number.isFinite(item.latencyAverageMs)
        ? Math.round(item.latencyAverageMs)
        : null,
    inputTokens: Math.max(0, Number(item.inputTokens ?? 0)),
    cachedInputTokens: Math.max(0, Number(item.cachedInputTokens ?? 0)),
    outputTokens: Math.max(0, Number(item.outputTokens ?? 0)),
    totalTokens: Math.max(0, Number(item.totalTokens ?? 0)),
    lastActivityAt: Number.isFinite(lastActivityAt) ? lastActivityAt : null,
    attributionKey: typeof item.attributionKey === 'string' ? item.attributionKey.trim() : '',
    attributionKind: typeof item.attributionKind === 'string' ? item.attributionKind.trim() : '',
    provider: typeof item.provider === 'string' ? item.provider.trim() : String(account.provider || ''),
    requestedModels: Array.isArray(item.requestedModels)
      ? item.requestedModels
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0)
      : [],
    trafficBuckets,
    statusBar: calculateStatusBarDataFromAttributionBuckets(item.buckets ?? []),
  };
}

function collectAccountUsageAttributionItems(
  account: AccountRecord,
  attribution: AccountUsageAttributionResponse,
  index?: AccountUsageAttributionIndex,
): AccountUsageAttributionItem[] {
  if (index) {
    const seen = new Set<AccountUsageAttributionItem>();
    const items: AccountUsageAttributionItem[] = [];
    buildAccountUsageAccountKeys(account).forEach((key) => {
      for (const item of index.byAccountKey.get(key) ?? []) {
        if (!seen.has(item)) {
          seen.add(item);
          items.push(item);
        }
      }
    });
    buildAccountUsageAuthIndexes(account).forEach((authIndex) => {
      for (const item of index.byAuthIndex.get(authIndex) ?? []) {
        if (!seen.has(item)) {
          seen.add(item);
          items.push(item);
        }
      }
    });
    return items;
  }

  return [
    ...(attribution.items ?? []),
    ...(attribution.unresolved ?? []),
  ].filter((item) => usageAttributionItemMatchesAccount(account, item));
}

function buildAccountUsageAttributionIndex(attribution: AccountUsageAttributionResponse): AccountUsageAttributionIndex {
  const index: AccountUsageAttributionIndex = {
    byAccountKey: new Map(),
    byAuthIndex: new Map(),
  };

  for (const item of [...(attribution.items ?? []), ...(attribution.unresolved ?? [])]) {
    const accountKey = String(item.accountKey || '').trim();
    if (accountKey) {
      appendAttributionIndexItem(index.byAccountKey, accountKey, item);
    }
    const attributionKey = String(item.attributionKey || '').trim();
    if (attributionKey.startsWith('auth-index:')) {
      const authIndex = normalizeAuthIndex(attributionKey.slice('auth-index:'.length));
      if (authIndex) {
        appendAttributionIndexItem(index.byAuthIndex, authIndex, item);
      }
    }
  }

  return index;
}

function appendAttributionIndexItem(
  index: Map<string, AccountUsageAttributionItem[]>,
  key: string,
  item: AccountUsageAttributionItem,
) {
  const existing = index.get(key);
  if (existing) {
    existing.push(item);
    return;
  }
  index.set(key, [item]);
}

function usageAttributionItemMatchesAccount(account: AccountRecord, item: AccountUsageAttributionItem) {
  const accountKeys = buildAccountUsageAccountKeys(account);
  const itemAccountKey = String(item.accountKey || '').trim();
  if (itemAccountKey && accountKeys.has(itemAccountKey)) {
    return true;
  }

  const attributionKey = String(item.attributionKey || '').trim();
  if (!attributionKey) {
    return false;
  }

  if (attributionKey.startsWith('auth-index:')) {
    const authIndex = normalizeAuthIndex(attributionKey.slice('auth-index:'.length));
    return Boolean(authIndex && buildAccountUsageAuthIndexes(account).has(authIndex));
  }

  return false;
}

function buildAccountUsageAccountKeys(account: AccountRecord) {
  return new Set(
    [account.id, account.quotaKey]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0),
  );
}

function buildAccountUsageAuthIndexes(account: AccountRecord) {
  const values = [
    normalizeAuthIndex(account.authIndex),
    normalizeAuthIndex(account.rawAuthFile?.authIndex),
    account.id,
    account.quotaKey,
  ];
  return new Set(
    values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0),
  );
}

function mergeAccountUsageAttributionItems(items: AccountUsageAttributionItem[]): AccountUsageAttributionItem {
  const models = new Set<string>();
  const bucketsByStart = new Map<string, AccountUsageAttributionBucket>();
  let requestCount = 0;
  let failedCount = 0;
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let latencyWeightedTotal = 0;
  let latencyWeight = 0;
  let lastActivityAt = '';
  let lastActivityAtMs = Number.NEGATIVE_INFINITY;

  items.forEach((item) => {
    const itemRequestCount = Math.max(0, Number(item.requestCount ?? 0));
    requestCount += itemRequestCount;
    failedCount += Math.max(0, Number(item.failedCount ?? 0));
    inputTokens += Math.max(0, Number(item.inputTokens ?? 0));
    cachedInputTokens += Math.max(0, Number(item.cachedInputTokens ?? 0));
    outputTokens += Math.max(0, Number(item.outputTokens ?? 0));
    totalTokens += normalizeAttributionTokenTotal(item.totalTokens, item.inputTokens, item.cachedInputTokens, item.outputTokens);

    if (typeof item.latencyAverageMs === 'number' && Number.isFinite(item.latencyAverageMs) && itemRequestCount > 0) {
      latencyWeightedTotal += item.latencyAverageMs * itemRequestCount;
      latencyWeight += itemRequestCount;
    }

    if (Array.isArray(item.requestedModels)) {
      item.requestedModels.forEach((value) => {
        const model = typeof value === 'string' ? value.trim() : '';
        if (model) {
          models.add(model);
        }
      });
    }

    const itemLastActivityAtMs = item.lastActivityAt ? parseTimestampMs(item.lastActivityAt) : Number.NaN;
    if (Number.isFinite(itemLastActivityAtMs) && itemLastActivityAtMs > lastActivityAtMs) {
      lastActivityAtMs = itemLastActivityAtMs;
      lastActivityAt = item.lastActivityAt || '';
    }

    (item.buckets ?? []).forEach((bucket) => {
      const start = typeof bucket.start === 'string' ? bucket.start.trim() : '';
      if (!start) {
        return;
      }
      const existing = bucketsByStart.get(start);
      const merged: AccountUsageAttributionBucket = {
        start,
        requestCount: Math.max(0, Number(existing?.requestCount ?? 0)) + Math.max(0, Number(bucket.requestCount ?? 0)),
        failedCount: Math.max(0, Number(existing?.failedCount ?? 0)) + Math.max(0, Number(bucket.failedCount ?? 0)),
        inputTokens: Math.max(0, Number(existing?.inputTokens ?? 0)) + Math.max(0, Number(bucket.inputTokens ?? 0)),
        cachedInputTokens:
          Math.max(0, Number(existing?.cachedInputTokens ?? 0)) + Math.max(0, Number(bucket.cachedInputTokens ?? 0)),
        outputTokens: Math.max(0, Number(existing?.outputTokens ?? 0)) + Math.max(0, Number(bucket.outputTokens ?? 0)),
        totalTokens:
          Math.max(0, Number(existing?.totalTokens ?? 0)) +
          normalizeAttributionTokenTotal(bucket.totalTokens, bucket.inputTokens, bucket.cachedInputTokens, bucket.outputTokens),
      };
      bucketsByStart.set(start, merged);
    });
  });

  const first = items[0] ?? ({} as AccountUsageAttributionItem);
  return {
    ...first,
    requestedModels: Array.from(models),
    requestCount,
    failedCount,
    latencyAverageMs: latencyWeight > 0 ? Math.round(latencyWeightedTotal / latencyWeight) : undefined,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    lastActivityAt,
    buckets: Array.from(bucketsByStart.values()).sort((left, right) => parseTimestampMs(left.start) - parseTimestampMs(right.start)),
  };
}

function normalizeAttributionTokenTotal(
  totalTokens: unknown,
  inputTokens: unknown,
  cachedInputTokens: unknown,
  outputTokens: unknown,
) {
  const explicitTotal = Math.max(0, Number(totalTokens ?? 0));
  if (explicitTotal > 0) {
    return explicitTotal;
  }
  return (
    Math.max(0, Number(inputTokens ?? 0)) +
    Math.max(0, Number(cachedInputTokens ?? 0)) +
    Math.max(0, Number(outputTokens ?? 0))
  );
}

function resolveAccountUsageDetails(account: AccountRecord, usageDetails: UsageDetail[]) {
  const authIndexKey = normalizeAuthIndex(account.authIndex ?? account.rawAuthFile?.authIndex);
  if (authIndexKey) {
    const matchedByAuthIndex = usageDetails.filter((detail) => normalizeAuthIndex(detail.auth_index) === authIndexKey);
    if (matchedByAuthIndex.length > 0) {
      return matchedByAuthIndex;
    }
  }

  const candidateSources = buildCandidateUsageSourceIds({
    apiKey: account.apiKey,
    prefix: account.prefix,
  });
  if (candidateSources.length === 0) {
    return [];
  }
  const sourceSet = new Set(candidateSources);
  return usageDetails.filter((detail) => sourceSet.has(detail.source));
}

export function buildAccountUsageSummary(account: AccountRecord, usageData: unknown, nowMs: number = Date.now()): AccountUsageSummary {
  if (isAttributionResponse(usageData)) {
    return buildAccountUsageSummaryFromAttribution(account, usageData);
  }
  const usageDetails = resolveAccountUsageDetails(account, collectUsageDetails(usageData));
  if (usageDetails.length === 0) {
    return buildEmptyAccountUsageSummary();
  }

  let success = 0;
  let failure = 0;
  let latencyTotal = 0;
  let latencySamples = 0;
  let lastActivityAt: number | null = null;

  usageDetails.forEach((detail) => {
    if (detail.failed) {
      failure += 1;
    } else {
      success += 1;
    }

    if (typeof detail.latency_ms === 'number' && Number.isFinite(detail.latency_ms)) {
      latencyTotal += detail.latency_ms;
      latencySamples += 1;
    }

    const timestamp = parseTimestampMs(detail.timestamp);
    if (Number.isFinite(timestamp) && (lastActivityAt === null || timestamp > lastActivityAt)) {
      lastActivityAt = timestamp;
    }
  });

  const total = success + failure;
  return {
    source: 'legacy',
    loadState: 'ready',
    errorMessage: '',
    hasData: total > 0,
    requestCount: total,
    failedCount: failure,
    success,
    failure,
    successRate: total > 0 ? (success / total) * 100 : null,
    averageLatencyMs: latencySamples > 0 ? Math.round(latencyTotal / latencySamples) : null,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    lastActivityAt,
    attributionKey: '',
    attributionKind: '',
    provider: String(account.provider || ''),
    requestedModels: [],
    trafficBuckets: [],
    statusBar: calculateStatusBarData(usageDetails, nowMs),
  };
}

export function buildAccountUsageSummaryMap(accounts: AccountRecord[], usageData: unknown, nowMs: number = Date.now()) {
  if (isAttributionResponse(usageData)) {
    const index = buildAccountUsageAttributionIndex(usageData);
    return accounts.reduce<Record<string, AccountUsageSummary>>((result, account) => {
      result[account.id] = buildAccountUsageSummaryFromAttribution(account, usageData, index);
      return result;
    }, {});
  }

  return accounts.reduce<Record<string, AccountUsageSummary>>((result, account) => {
    result[account.id] = buildAccountUsageSummary(account, usageData, nowMs);
    return result;
  }, {});
}

export function buildFailedAccountUsageSummaryMap(
  accounts: AccountRecord[],
  previous: Record<string, AccountUsageSummary> = {},
  error: unknown,
) {
  return accounts.reduce<Record<string, AccountUsageSummary>>((result, account) => {
    result[account.id] = buildFailedAccountUsageSummary(previous[account.id], error);
    return result;
  }, {});
}
