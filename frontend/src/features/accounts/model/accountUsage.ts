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

export interface AccountUsageAttributionBucket {
  start: string;
  requestCount: number;
  failedCount?: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AccountUsageAttributionItem {
  attributionKey?: string;
  accountKey: string;
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
): AccountUsageSummary {
  const item = attribution.items?.find((entry) => String(entry.accountKey || '').trim() === account.id);
  if (!item) {
    return buildEmptyAccountUsageSummary();
  }

  const requestCount = Math.max(0, Number(item.requestCount ?? 0));
  const failedCount = Math.max(0, Number(item.failedCount ?? 0));
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
    attributionKind: '',
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
  return accounts.reduce<Record<string, AccountUsageSummary>>((result, account) => {
    result[account.id] = buildAccountUsageSummary(account, usageData, nowMs);
    return result;
  }, {});
}
