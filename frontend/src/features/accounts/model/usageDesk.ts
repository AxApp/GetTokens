import type {
  AccountUsageAttributionBucket,
  AccountUsageAttributionItem,
  AccountUsageAttributionResponse,
} from './accountUsage';
import type { UsageDeskWorkspace } from '../../../types';

export type UsageDeskSource = 'observed' | 'projected';

export interface UsageDeskObservedDetail {
  timestamp: string;
  provider: string;
  model: string;
  accountKey: string;
  attributionKey: string;
  requestCount: number;
  failedCount: number;
  failed: boolean;
  latencyMs: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageDeskDailyPoint {
  dayKey: string;
  label: string;
  requests: number;
  success: number;
  failure: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageDeskMinutePoint {
  minuteKey: string;
  label: string;
  requests: number;
  success: number;
  failure: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageDeskMinuteRow {
  timeLabel: string;
  provider: string;
  model?: string;
  metric: string;
  value: string;
  note?: string;
  requests?: string;
  inputTokens?: string;
  cachedInputTokens?: string;
  outputTokens?: string;
}

export interface UsageDeskObservedSnapshot {
  hasData: boolean;
  success: number;
  failure: number;
  availableDayKeys: string[];
  selectedDayKey: string | null;
  dailyPoints: UsageDeskDailyPoint[];
  minutePoints: UsageDeskMinutePoint[];
  minuteRows: UsageDeskMinuteRow[];
}

export interface UsageDeskProjectedDetail {
  timestamp: string;
  provider: string;
  sourceKind: string;
  sessionID: string;
  projectName: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requestCount: number;
}

export interface UsageDeskProjectedDailyPoint {
  dayKey: string;
  label: string;
  model?: string;
  requests: number;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface UsageDeskProjectedMinutePoint {
  minuteKey: string;
  label: string;
  requests: number;
  totalTokens: number;
}

export interface UsageDeskProjectedSessionUsage {
  sessionID: string;
  fileLabel: string;
  projectName: string;
  model: string;
  requests: number;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  latestTimestamp: string;
}

export interface UsageDeskProjectedProjectUsage {
  projectName: string;
  sessions: number;
  model: string;
  requests: number;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  latestTimestamp: string;
}

type UsageDeskDominantModelState = {
  modelTokens: Map<string, number>;
  dominantModel: string;
  dominantModelTokens: number;
  modelCount: number;
};

function createDominantModelState(initialModel: string = ''): UsageDeskDominantModelState {
  return {
    modelTokens: new Map<string, number>(),
    dominantModel: initialModel,
    dominantModelTokens: 0,
    modelCount: 0,
  };
}

function pushDominantModel(state: UsageDeskDominantModelState, model: string, tokens: number) {
  const normalizedModel = String(model || '').trim();
  if (!normalizedModel) {
    return;
  }
  const hadModel = state.modelTokens.has(normalizedModel);
  const nextTokens = (state.modelTokens.get(normalizedModel) ?? 0) + tokens;
  state.modelTokens.set(normalizedModel, nextTokens);
  if (!hadModel) {
    state.modelCount += 1;
  }
  if (
    nextTokens > state.dominantModelTokens ||
    (nextTokens === state.dominantModelTokens && normalizedModel < state.dominantModel)
  ) {
    state.dominantModel = normalizedModel;
    state.dominantModelTokens = nextTokens;
  }
}

function formatDominantModel(state: Pick<UsageDeskDominantModelState, 'dominantModel' | 'modelCount'>): string {
  if (!state.dominantModel) {
    return '';
  }
  return state.modelCount > 1 ? `${state.dominantModel},*` : state.dominantModel;
}

export interface UsageDeskProjectedSnapshot {
  hasData: boolean;
  totalRequests: number;
  totalTokens: number;
  availableDayKeys: string[];
  selectedDayKey: string | null;
  dailyPoints: UsageDeskProjectedDailyPoint[];
  minutePoints: UsageDeskProjectedMinutePoint[];
  minuteRows: UsageDeskMinuteRow[];
  sessionUsageByDayKey: Record<string, UsageDeskProjectedSessionUsage[]>;
  sessionUsageByBucket: Record<string, UsageDeskProjectedSessionUsage[]>;
}

export interface UsageDeskProjectedStats {
  scannedFiles: number;
  cacheHitFiles: number;
  deltaAppendFiles: number;
  fullRebuildFiles: number;
  fileMissingFiles: number;
}

export type UsageDeskChartUnit = 'count' | 'tokens';
export type UsageDeskProjectedSurfaceView = 'daily' | 'minute' | 'projects' | 'sessions';

export const usageDeskProjectedSurfaceViewOptions: Array<{ id: UsageDeskProjectedSurfaceView; label: string }> = [
  { id: 'daily', label: '天级趋势' },
  { id: 'minute', label: '分钟明细' },
  { id: 'projects', label: '项目汇总' },
  { id: 'sessions', label: '会话列表' },
];

export const usageDeskSessionDrilldownColumnLabels = ['会话来源', '模型', '请求', 'Token', '输入', '缓存', '输出'] as const;
export const usageDeskProjectDrilldownColumnLabels = ['项目', '会话', '模型', '请求', 'Token', '输入', '缓存', '输出'] as const;

export function shouldOpenUsageDeskProjectedSessionSurface(source: UsageDeskSource, rowKey: string): boolean {
  return source === 'projected' && rowKey.trim().length > 0;
}
export type UsageDeskRangeOption = 'TODAY' | '7D' | '14D' | '30D' | '全部';
export type UsageDeskResolution = '1M' | '5M' | '15M' | '30M' | '60M';
export type UsageDeskCurveMotion = 'standard' | 'realtime';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAttributionResponse(payload: unknown): payload is AccountUsageAttributionResponse {
  return isRecord(payload) && (Array.isArray(payload.items) || Array.isArray(payload.unresolved));
}

function parseTimestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

function buildDayKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function buildMinuteKey(date: Date, resolution: UsageDeskResolution = '1M') {
  const mins = date.getMinutes();
  const resValue = parseInt(resolution);
  const roundedMins = Math.floor(mins / resValue) * resValue;
  return `${buildDayKey(date)} ${pad2(date.getHours())}:${pad2(roundedMins)}`;
}

function buildDayLabel(dayKey: string) {
  return dayKey.slice(5);
}

function buildMinuteLabel(date: Date, resolution: UsageDeskResolution = '1M') {
  const mins = date.getMinutes();
  const resValue = parseInt(resolution);
  const roundedMins = Math.floor(mins / resValue) * resValue;
  return `${pad2(date.getHours())}:${pad2(roundedMins)}`;
}

export function formatUsageDeskChartValue(value: number, unit: UsageDeskChartUnit): string {
  const normalized = Number.isFinite(value) ? value : 0;
  if (unit === 'count') {
    if (normalized >= 100000000) {
      return `${formatUsageDeskCompactNumber(normalized / 100000000)} 亿次`;
    }
    if (normalized >= 1000000) {
      return `${formatUsageDeskCompactNumber(normalized / 1000000)} 百万次`;
    }
    if (normalized >= 10000) {
      return `${formatUsageDeskCompactNumber(normalized / 10000)} 万次`;
    }
    return `${new Intl.NumberFormat('zh-CN').format(normalized)} 次`;
  }

  if (normalized >= 100000000) {
    return `${formatUsageDeskCompactNumber(normalized / 100000000)} 亿`;
  }
  if (normalized >= 1000000) {
    return `${formatUsageDeskCompactNumber(normalized / 1000000)} 百万`;
  }
  if (normalized >= 10000) {
    return `${formatUsageDeskCompactNumber(normalized / 10000)} 万`;
  }
  return `${new Intl.NumberFormat('zh-CN').format(normalized)}`;
}

export function buildUsageDeskObservedSummaryItems({
  drilldownDayKey,
  dailyPoints,
  visibleDailyPoints,
}: {
  drilldownDayKey: string | null;
  dailyPoints: UsageDeskDailyPoint[];
  visibleDailyPoints: UsageDeskDailyPoint[];
}): string[] {
  if (drilldownDayKey) {
    const dayPoint = dailyPoints.find((point) => point.dayKey === drilldownDayKey);
    if (!dayPoint) return [];
    return [
      `全天请求 ${formatUsageDeskChartValue(dayPoint.requests, 'count')}`,
      `全天失败 ${formatUsageDeskChartValue(dayPoint.failure, 'count')}`,
      `全天 Token ${formatUsageDeskChartValue(dayPoint.totalTokens, 'tokens')}`,
      `全天输入 ${formatUsageDeskChartValue(dayPoint.inputTokens, 'tokens')}`,
      `全天输出 ${formatUsageDeskChartValue(dayPoint.outputTokens, 'tokens')}`,
    ];
  }

  const requests = visibleDailyPoints.reduce((sum, point) => sum + point.requests, 0);
  const failure = visibleDailyPoints.reduce((sum, point) => sum + point.failure, 0);
  const totalTokens = visibleDailyPoints.reduce((sum, point) => sum + point.totalTokens, 0);
  const inputTokens = visibleDailyPoints.reduce((sum, point) => sum + point.inputTokens, 0);
  const outputTokens = visibleDailyPoints.reduce((sum, point) => sum + point.outputTokens, 0);
  return [
    `请求 ${formatUsageDeskChartValue(requests, 'count')}`,
    `失败 ${formatUsageDeskChartValue(failure, 'count')}`,
    `Token ${formatUsageDeskChartValue(totalTokens, 'tokens')}`,
    `输入 ${formatUsageDeskChartValue(inputTokens, 'tokens')}`,
    `输出 ${formatUsageDeskChartValue(outputTokens, 'tokens')}`,
  ];
}

export function buildUsageDeskProjectedSummaryItems({
  drilldownDayKey,
  dailyPoints,
  visibleDailyPoints,
}: {
  drilldownDayKey: string | null;
  dailyPoints: UsageDeskProjectedDailyPoint[];
  visibleDailyPoints: UsageDeskProjectedDailyPoint[];
}): string[] {
  if (drilldownDayKey) {
    const dayPoint = dailyPoints.find((point) => point.dayKey === drilldownDayKey);
    if (!dayPoint) return [];
    const nonCachedTokens = Math.max(0, dayPoint.inputTokens - dayPoint.cachedInputTokens) + dayPoint.outputTokens;
    return [
      `全天请求 ${formatUsageDeskChartValue(dayPoint.requests, 'count')}`,
      `全天 Token(含缓存) ${formatUsageDeskChartValue(dayPoint.totalTokens, 'tokens')}`,
      `全天非缓存估算 ${formatUsageDeskChartValue(nonCachedTokens, 'tokens')}`,
      `全天输入 ${formatUsageDeskChartValue(dayPoint.inputTokens, 'tokens')}`,
      `全天缓存 ${formatUsageDeskChartValue(dayPoint.cachedInputTokens, 'tokens')}`,
      `全天输出 ${formatUsageDeskChartValue(dayPoint.outputTokens, 'tokens')}`,
    ];
  }

  const requests = visibleDailyPoints.reduce((sum, point) => sum + point.requests, 0);
  const totalTokens = visibleDailyPoints.reduce((sum, point) => sum + point.totalTokens, 0);
  const inputTokens = visibleDailyPoints.reduce((sum, point) => sum + point.inputTokens, 0);
  const cachedInputTokens = visibleDailyPoints.reduce((sum, point) => sum + point.cachedInputTokens, 0);
  const outputTokens = visibleDailyPoints.reduce((sum, point) => sum + point.outputTokens, 0);
  const nonCachedTokens = Math.max(0, inputTokens - cachedInputTokens) + outputTokens;
  return [
    `请求 ${formatUsageDeskChartValue(requests, 'count')}`,
    `Token(含缓存) ${formatUsageDeskChartValue(totalTokens, 'tokens')}`,
    `非缓存估算 ${formatUsageDeskChartValue(nonCachedTokens, 'tokens')}`,
    `输入 ${formatUsageDeskChartValue(inputTokens, 'tokens')}`,
    `缓存 ${formatUsageDeskChartValue(cachedInputTokens, 'tokens')}`,
    `输出 ${formatUsageDeskChartValue(outputTokens, 'tokens')}`,
  ];
}

export function resolveUsageDeskRangeDrilldownDayKey(
  range: UsageDeskRangeOption,
  latestDayKey: string | null,
): string | null {
  if (range !== 'TODAY') {
    return null;
  }
  return latestDayKey;
}

export function resolveUsageDeskChartSelectionKey(
  row: Pick<UsageDeskMinuteRow, 'timeLabel'> | null | undefined,
): string {
  return row?.timeLabel ?? '';
}

export function resolveUsageDeskLinkedRowKey(
  rows: Array<
    Pick<
      UsageDeskMinuteRow,
      'timeLabel' | 'value' | 'note' | 'requests' | 'inputTokens' | 'cachedInputTokens' | 'outputTokens'
    >
  >,
  chartSelectionKey: string,
): string {
  if (!chartSelectionKey) {
    return '';
  }
  const matchedRow = rows.find((row) => row.timeLabel === chartSelectionKey);
  if (!matchedRow) {
    return '';
  }
  return [
    matchedRow.timeLabel,
    matchedRow.value,
    matchedRow.note ?? '',
    matchedRow.requests ?? '',
    matchedRow.inputTokens ?? '',
    matchedRow.cachedInputTokens ?? '',
    matchedRow.outputTokens ?? '',
  ].join('|');
}

export function buildUsageDeskChartPointStyle(x: number, y: number) {
  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
  };
}

export interface UsageDeskCurveAnimationConfig {
  durationMs: number;
  pointDelayMs: number;
}

export function resolveUsageDeskCurveAnimationConfig(
  motion: UsageDeskCurveMotion,
  pointCount: number,
): UsageDeskCurveAnimationConfig {
  if (motion === 'realtime') {
    const normalizedPointCount = Math.max(1, Number.isFinite(pointCount) ? pointCount : 1);
    return {
      durationMs: Math.min(3200, Math.max(1400, normalizedPointCount * 48)),
      pointDelayMs: Math.min(60, 1600 / normalizedPointCount),
    };
  }

  return {
    durationMs: 420,
    pointDelayMs: 0,
  };
}

export interface UsageDeskChartValueScale {
  mode: 'linear' | 'compressed';
  maxValue: number;
  ratio: (value: number) => number;
}

export function buildUsageDeskChartValueScale(values: number[]): UsageDeskChartValueScale {
  const positiveValues = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const maxValue = Math.max(positiveValues[positiveValues.length - 1] ?? 0, 1);
  const referenceValues = positiveValues.length > 1 ? positiveValues.slice(0, -1) : positiveValues;
  const referenceValue = Math.max(percentileUsageDeskValue(referenceValues, 0.75), 1);
  const outlierRatio = maxValue / referenceValue;
  const shouldCompress = positiveValues.length > 1 && outlierRatio >= 8;

  if (!shouldCompress) {
    return {
      mode: 'linear',
      maxValue,
      ratio: (value: number) => clampUsageDeskRatio(normalizeUsageDeskChartValue(value) / maxValue),
    };
  }

  const logMax = Math.log1p(maxValue);
  return {
    mode: 'compressed',
    maxValue,
    ratio: (value: number) => {
      const normalized = normalizeUsageDeskChartValue(value);
      if (normalized <= 0) {
        return 0;
      }
      const logRatio = logMax > 0 ? Math.log1p(normalized) / logMax : 0;
      return clampUsageDeskRatio(Math.max(0.08, logRatio));
    },
  };
}

function normalizeUsageDeskChartValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function percentileUsageDeskValue(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }
  const index = (values.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = values[lowerIndex] ?? 0;
  const upper = values[upperIndex] ?? lower;
  return lower + (upper - lower) * (index - lowerIndex);
}

function clampUsageDeskRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function formatUsageDeskCompactNumber(value: number): string {
  const normalized = Math.round(value * 10) / 10;
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(1).replace(/\.0$/, '');
}

function normalizeUsageDeskMetricValue(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function formatRequestedModelsLabel(models: unknown): string {
  if (!Array.isArray(models)) {
    return '';
  }
  const normalized = Array.from(
    new Set(
      models
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  ).sort();
  if (normalized.length === 0) {
    return '';
  }
  return normalized.length > 1 ? `${normalized[0]},*` : normalized[0];
}

export function buildUsageDeskProjectedSessionBucketKey(dayKey: string, timeLabel: string): string {
  return `${dayKey}|${timeLabel}`;
}

function formatUsageDeskSessionFileLabel(sessionID: string): string {
  const normalized = sessionID.trim().replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || normalized || '--';
}

export function buildUsageDeskProjectedProjectUsageRows(
  rows: UsageDeskProjectedSessionUsage[],
): UsageDeskProjectedProjectUsage[] {
  type ProjectUsageDraft = UsageDeskProjectedProjectUsage & {
    dominantModelState: UsageDeskDominantModelState;
  };
  const projectMap = new Map<string, ProjectUsageDraft>();

  rows.forEach((row) => {
    const projectName = row.projectName.trim() || '未知项目';
    const draft = projectMap.get(projectName) ?? {
      projectName,
      sessions: 0,
      model: '',
      dominantModelState: createDominantModelState(row.model),
      requests: 0,
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      latestTimestamp: '',
    };
    pushDominantModel(draft.dominantModelState, row.model, Math.max(1, row.totalTokens || row.requests));
    draft.model = formatDominantModel(draft.dominantModelState);
    draft.sessions += 1;
    draft.requests += row.requests;
    draft.totalTokens += row.totalTokens;
    draft.inputTokens += row.inputTokens;
    draft.cachedInputTokens += row.cachedInputTokens;
    draft.outputTokens += row.outputTokens;
    if (!draft.latestTimestamp || row.latestTimestamp.localeCompare(draft.latestTimestamp) > 0) {
      draft.latestTimestamp = row.latestTimestamp;
    }
    projectMap.set(projectName, draft);
  });

  return Array.from(projectMap.values())
    .map(({ dominantModelState: _dominantModelState, ...row }) => row)
    .sort((left, right) => {
      if (right.totalTokens !== left.totalTokens) {
        return right.totalTokens - left.totalTokens;
      }
      if (right.sessions !== left.sessions) {
        return right.sessions - left.sessions;
      }
      return left.projectName.localeCompare(right.projectName);
    });
}

function collectObservedDetailsFromAttributionItem(
  item: AccountUsageAttributionItem,
  result: UsageDeskObservedDetail[],
) {
  const provider = typeof item.provider === 'string' && item.provider.trim() ? item.provider : 'unknown';
  const model = formatRequestedModelsLabel(item.requestedModels);
  const accountKey = typeof item.accountKey === 'string' ? item.accountKey.trim() : '';
  const attributionKey = typeof item.attributionKey === 'string' ? item.attributionKey.trim() : '';
  const buckets = Array.isArray(item.buckets) ? item.buckets : [];

  buckets.forEach((bucket: AccountUsageAttributionBucket) => {
    if (!bucket || typeof bucket.start !== 'string' || !bucket.start.trim()) {
      return;
    }

    const requestCount = normalizeUsageDeskMetricValue(bucket.requestCount);
    const failedCount = Math.min(requestCount, normalizeUsageDeskMetricValue(bucket.failedCount));
    const inputTokens = normalizeUsageDeskMetricValue(bucket.inputTokens);
    const cachedInputTokens = normalizeUsageDeskMetricValue(bucket.cachedInputTokens);
    const outputTokens = normalizeUsageDeskMetricValue(bucket.outputTokens);
    const totalTokens =
      normalizeUsageDeskMetricValue(bucket.totalTokens) ||
      inputTokens + cachedInputTokens + outputTokens;

    result.push({
      timestamp: bucket.start,
      provider,
      model,
      accountKey,
      attributionKey,
      requestCount,
      failedCount,
      failed: requestCount > 0 && failedCount >= requestCount,
      latencyMs: null,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      totalTokens,
    });
  });
}

function isClaudeObservedDetail(detail: UsageDeskObservedDetail): boolean {
  const haystack = [
    detail.provider,
    detail.model,
    detail.accountKey,
    detail.attributionKey,
  ].join(' ').toLowerCase();

  return (
    usageDeskProviderSupportsClaude(detail.provider) ||
    haystack.includes('anthropic') ||
    haystack.includes('claude') ||
    haystack.includes('sonnet') ||
    haystack.includes('opus') ||
    haystack.includes('haiku')
  );
}

function usageDeskProviderSupportsClaude(provider: string): boolean {
  switch (provider.trim().toLowerCase()) {
    case 'anthropic':
    case 'claude':
    case 'deepseek':
    case 'zhipu':
    case 'glm':
    case 'kimi':
    case 'moonshot':
    case 'stepfun':
    case 'minimax':
    case 'doubao':
    case 'longcat':
    case 'xiaomimimo':
    case 'mimo':
    case 'bailian':
    case 'dashscope':
    case 'modelscope':
    case 'bailing':
    case 'ling':
    case 'siliconflow':
    case 'openrouter':
    case 'therouter':
      return true;
    default:
      return false;
  }
}

function filterUsageDeskObservedDetailsByWorkspace(
  details: UsageDeskObservedDetail[],
  workspace: UsageDeskWorkspace = 'codex',
): UsageDeskObservedDetail[] {
  if (workspace === 'claude') {
    return details.filter(isClaudeObservedDetail);
  }
  return details;
}

export function collectUsageDeskObservedDetails(
  usageData: unknown,
  workspace: UsageDeskWorkspace = 'codex',
): UsageDeskObservedDetail[] {
  if (isAttributionResponse(usageData)) {
    const result: UsageDeskObservedDetail[] = [];
    (usageData.items ?? []).forEach((item) => collectObservedDetailsFromAttributionItem(item, result));
    (usageData.unresolved ?? []).forEach((item) => collectObservedDetailsFromAttributionItem(item, result));
    return filterUsageDeskObservedDetailsByWorkspace(result, workspace)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }

  const usageRecord = isRecord(usageData) ? usageData : null;
  const apis = usageRecord && isRecord(usageRecord.apis) ? usageRecord.apis : null;
  if (!apis) return [];

  const result: UsageDeskObservedDetail[] = [];

  Object.entries(apis).forEach(([provider, apiEntry]) => {
    if (!isRecord(apiEntry) || !isRecord(apiEntry.models)) return;

    Object.entries(apiEntry.models).forEach(([model, modelEntry]) => {
      if (!isRecord(modelEntry) || !Array.isArray(modelEntry.details)) return;

      modelEntry.details.forEach((detail) => {
        if (!isRecord(detail)) return;
        const timestamp = typeof detail.timestamp === 'string' ? detail.timestamp : '';
        if (!timestamp) return;

        result.push({
          timestamp,
          provider,
          model,
          accountKey: '',
          attributionKey: '',
          requestCount: 1,
          failedCount: detail.failed === true ? 1 : 0,
          failed: detail.failed === true,
          latencyMs:
            typeof detail.latency_ms === 'number' && Number.isFinite(detail.latency_ms)
              ? detail.latency_ms
              : null,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        });
      });
    });
  });

  return filterUsageDeskObservedDetailsByWorkspace(result, workspace)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function buildUsageDeskObservedSnapshot(
  usageData: unknown,
  selectedDayKey?: string | null,
  resolution: UsageDeskResolution = '1M',
  workspace: UsageDeskWorkspace = 'codex',
): UsageDeskObservedSnapshot {
  const details = collectUsageDeskObservedDetails(usageData, workspace);
  if (details.length === 0) {
    return {
      hasData: false,
      success: 0,
      failure: 0,
      availableDayKeys: [],
      selectedDayKey: null,
      dailyPoints: [],
      minutePoints: [],
      minuteRows: [],
    };
  }

  const dailyMap = new Map<string, UsageDeskDailyPoint>();
  let success = 0;
  let failure = 0;

  details.forEach((detail) => {
    const date = parseTimestamp(detail.timestamp);
    if (!date) return;
    const dayKey = buildDayKey(date);
    const point = dailyMap.get(dayKey) ?? {
      dayKey,
      label: buildDayLabel(dayKey),
      requests: 0,
      success: 0,
      failure: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    const requestCount = Math.max(0, detail.requestCount);
    const failedCount = Math.min(requestCount, Math.max(0, detail.failedCount));
    const successCount = Math.max(0, requestCount - failedCount);
    point.requests += requestCount;
    point.success += successCount;
    point.failure += failedCount;
    point.inputTokens += Math.max(0, detail.inputTokens);
    point.cachedInputTokens += Math.max(0, detail.cachedInputTokens);
    point.outputTokens += Math.max(0, detail.outputTokens);
    point.totalTokens += Math.max(0, detail.totalTokens);
    success += successCount;
    failure += failedCount;
    dailyMap.set(dayKey, point);
  });

  const availableDayKeys = Array.from(dailyMap.keys()).sort();
  const resolvedDayKey =
    selectedDayKey && availableDayKeys.includes(selectedDayKey)
      ? selectedDayKey
      : availableDayKeys[availableDayKeys.length - 1] ?? null;

  const minuteMap = new Map<string, UsageDeskMinutePoint>();
  const minuteRowMap = new Map<
    string,
    {
      timeLabel: string;
      provider: string;
      model: string;
      accountKey: string;
      attributionKey: string;
      success: number;
      failure: number;
      requests: number;
      highLatencyCount: number;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      totalTokens: number;
      hasAttributionData: boolean;
      dominantModelState: UsageDeskDominantModelState;
    }
  >();

  details.forEach((detail) => {
    const date = parseTimestamp(detail.timestamp);
    if (!date || buildDayKey(date) !== resolvedDayKey) return;

    const minuteKey = buildMinuteKey(date, resolution);
    const minutePoint = minuteMap.get(minuteKey) ?? {
      minuteKey,
      label: buildMinuteLabel(date, resolution),
      requests: 0,
      success: 0,
      failure: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    const requestCount = Math.max(0, detail.requestCount);
    const failedCount = Math.min(requestCount, Math.max(0, detail.failedCount));
    const successCount = Math.max(0, requestCount - failedCount);
    minutePoint.requests += requestCount;
    minutePoint.success += successCount;
    minutePoint.failure += failedCount;
    minutePoint.inputTokens += Math.max(0, detail.inputTokens);
    minutePoint.cachedInputTokens += Math.max(0, detail.cachedInputTokens);
    minutePoint.outputTokens += Math.max(0, detail.outputTokens);
    minutePoint.totalTokens += Math.max(0, detail.totalTokens);
    minuteMap.set(minuteKey, minutePoint);

    const minuteRow = minuteRowMap.get(minuteKey) ?? {
      timeLabel: buildMinuteLabel(date, resolution),
      provider: detail.provider,
      model: detail.model,
      accountKey: detail.accountKey,
      attributionKey: detail.attributionKey,
      success: 0,
      failure: 0,
      requests: 0,
      highLatencyCount: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      hasAttributionData: false,
      dominantModelState: createDominantModelState(detail.model),
    };
    minuteRow.provider = minuteRow.provider === detail.provider ? detail.provider : 'mixed';
    minuteRow.accountKey =
      minuteRow.accountKey === detail.accountKey ? detail.accountKey : minuteRow.accountKey && detail.accountKey ? 'mixed' : minuteRow.accountKey || detail.accountKey;
    minuteRow.attributionKey =
      minuteRow.attributionKey === detail.attributionKey
        ? detail.attributionKey
        : minuteRow.attributionKey && detail.attributionKey
          ? 'mixed'
          : minuteRow.attributionKey || detail.attributionKey;
    minuteRow.requests += requestCount;
    minuteRow.success += successCount;
    minuteRow.failure += failedCount;
    minuteRow.inputTokens += Math.max(0, detail.inputTokens);
    minuteRow.cachedInputTokens += Math.max(0, detail.cachedInputTokens);
    minuteRow.outputTokens += Math.max(0, detail.outputTokens);
    minuteRow.totalTokens += Math.max(0, detail.totalTokens);
    minuteRow.hasAttributionData =
      minuteRow.hasAttributionData ||
      requestCount > 1 ||
      detail.accountKey.length > 0 ||
      detail.attributionKey.length > 0 ||
      minuteRow.totalTokens > 0;
    pushDominantModel(minuteRow.dominantModelState, detail.model, Math.max(1, detail.totalTokens || requestCount));
    minuteRow.model = formatDominantModel(minuteRow.dominantModelState);
    if (!detail.failed && detail.latencyMs && detail.latencyMs > 2000) {
      minuteRow.highLatencyCount += 1;
    }
    minuteRowMap.set(minuteKey, minuteRow);
  });

  const minuteRows = Array.from(minuteRowMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, row]) => {
      if (!row.hasAttributionData && row.requests === 1 && resolution === '1M') {
        return {
          timeLabel: row.timeLabel,
          provider: row.provider,
          metric: row.failure > 0 ? '请求失败' : '请求成功',
          value: '1',
          note:
            row.failure > 0
              ? '观测到失败请求'
              : row.highLatencyCount > 0
                ? `高延迟 ${row.highLatencyCount} 次`
                : 'relay 链路正常',
        };
      }

      const noteParts: string[] = [];
      if (row.accountKey && row.accountKey !== 'mixed') {
        noteParts.push(row.accountKey);
      } else if (row.accountKey === 'mixed') {
        noteParts.push('多个账号');
      } else if (row.attributionKey && row.attributionKey !== 'mixed') {
        noteParts.push(`未归因 ${row.attributionKey}`);
      } else if (row.attributionKey === 'mixed') {
        noteParts.push('多个未归因键');
      }
      if (row.failure > 0) {
        noteParts.push(`失败 ${formatUsageDeskChartValue(row.failure, 'count')}`);
      }

      return {
        timeLabel: row.timeLabel,
        provider: row.provider,
        model: row.model || '--',
        metric: '总请求',
        value: formatUsageDeskChartValue(row.requests, 'count'),
        note: noteParts.length > 0 ? noteParts.join(' / ') : undefined,
        requests: formatUsageDeskChartValue(row.requests, 'count'),
        inputTokens: formatUsageDeskChartValue(row.inputTokens, 'tokens'),
        cachedInputTokens: formatUsageDeskChartValue(row.cachedInputTokens, 'tokens'),
        outputTokens: formatUsageDeskChartValue(row.outputTokens, 'tokens'),
      };
    });

  return {
    hasData: true,
    success,
    failure,
    availableDayKeys,
    selectedDayKey: resolvedDayKey,
    dailyPoints: availableDayKeys.map((dayKey) => dailyMap.get(dayKey)!),
    minutePoints: Array.from(minuteMap.values()).sort((a, b) => a.minuteKey.localeCompare(b.minuteKey)),
    minuteRows,
  };
}

export function collectUsageDeskProjectedDetails(payload: unknown): UsageDeskProjectedDetail[] {
  if (!isRecord(payload) || !Array.isArray(payload.details)) return [];

  return payload.details
    .filter(isRecord)
    .map((detail) => ({
      timestamp: typeof detail.timestamp === 'string' ? detail.timestamp : '',
      provider: typeof detail.provider === 'string' ? detail.provider : 'codex',
      sourceKind: typeof detail.sourceKind === 'string' ? detail.sourceKind : 'local_projected',
      sessionID:
        typeof detail.sessionID === 'string'
          ? detail.sessionID
          : typeof detail.rolloutPath === 'string'
            ? detail.rolloutPath
            : '',
      projectName: typeof detail.projectName === 'string' ? detail.projectName : '',
      model: typeof detail.model === 'string' ? detail.model : '',
      inputTokens: typeof detail.inputTokens === 'number' ? detail.inputTokens : 0,
      cachedInputTokens: typeof detail.cachedInputTokens === 'number' ? detail.cachedInputTokens : 0,
      outputTokens: typeof detail.outputTokens === 'number' ? detail.outputTokens : 0,
      requestCount: typeof detail.requestCount === 'number' ? detail.requestCount : 0,
    }))
    .filter((detail) => detail.timestamp !== '')
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function buildUsageDeskProjectedSnapshot(
  payload: unknown,
  selectedDayKey?: string | null,
  resolution: UsageDeskResolution = '1M',
): UsageDeskProjectedSnapshot {
  const details = collectUsageDeskProjectedDetails(payload);
  if (details.length === 0) {
    return {
      hasData: false,
      totalRequests: 0,
      totalTokens: 0,
      availableDayKeys: [],
        selectedDayKey: null,
        dailyPoints: [],
        minutePoints: [],
        minuteRows: [],
        sessionUsageByDayKey: {},
        sessionUsageByBucket: {},
      };
    }

  type SessionUsageDraft = UsageDeskProjectedSessionUsage & {
    dominantModelState: UsageDeskDominantModelState;
  };
  const sessionUsageByDayDraft = new Map<string, Map<string, SessionUsageDraft>>();
  const sessionUsageByBucketDraft = new Map<string, Map<string, SessionUsageDraft>>();
  const dailyMap = new Map<
    string,
    UsageDeskProjectedDailyPoint & {
      dominantModelState: UsageDeskDominantModelState;
    }
  >();
  let totalRequests = 0;
  let totalTokens = 0;

  function pushProjectedSessionUsage(
    target: Map<string, Map<string, SessionUsageDraft>>,
    bucketKey: string,
    detail: UsageDeskProjectedDetail,
    tokens: number,
  ) {
    const sessionID = detail.sessionID.trim();
    if (!sessionID) {
      return;
    }
    const bucket = target.get(bucketKey) ?? new Map<string, SessionUsageDraft>();
    const session = bucket.get(sessionID) ?? {
      sessionID,
      fileLabel: formatUsageDeskSessionFileLabel(sessionID),
      projectName: detail.projectName.trim(),
      model: '',
      dominantModelState: createDominantModelState(detail.model),
      requests: 0,
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      latestTimestamp: '',
    };
    pushDominantModel(session.dominantModelState, detail.model, Math.max(1, tokens || detail.requestCount));
    if (!session.projectName && detail.projectName.trim()) {
      session.projectName = detail.projectName.trim();
    }
    session.model = formatDominantModel(session.dominantModelState);
    session.requests += detail.requestCount;
    session.totalTokens += tokens;
    session.inputTokens += detail.inputTokens;
    session.cachedInputTokens += detail.cachedInputTokens;
    session.outputTokens += detail.outputTokens;
    if (!session.latestTimestamp || Date.parse(detail.timestamp) > Date.parse(session.latestTimestamp)) {
      session.latestTimestamp = detail.timestamp;
    }
    bucket.set(sessionID, session);
    target.set(bucketKey, bucket);
  }

  details.forEach((detail) => {
    const date = parseTimestamp(detail.timestamp);
    if (!date) return;
    const dayKey = buildDayKey(date);
    const point = dailyMap.get(dayKey) ?? {
      dayKey,
      label: buildDayLabel(dayKey),
      model: '',
      requests: 0,
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      dominantModelState: createDominantModelState(detail.model),
    };
    const tokens = detail.inputTokens + detail.outputTokens;
    pushDominantModel(point.dominantModelState, detail.model, tokens);
    point.model = formatDominantModel(point.dominantModelState);
    point.requests += detail.requestCount;
    point.totalTokens += tokens;
    point.inputTokens += detail.inputTokens;
    point.cachedInputTokens += detail.cachedInputTokens;
    point.outputTokens += detail.outputTokens;
    totalRequests += detail.requestCount;
    totalTokens += tokens;
    dailyMap.set(dayKey, point);

    pushProjectedSessionUsage(sessionUsageByDayDraft, dayKey, detail, tokens);
    pushProjectedSessionUsage(
      sessionUsageByBucketDraft,
      buildUsageDeskProjectedSessionBucketKey(dayKey, buildMinuteLabel(date, resolution)),
      detail,
      tokens,
    );
  });

  const availableDayKeys = Array.from(dailyMap.keys()).sort();
  const resolvedDayKey =
    selectedDayKey && availableDayKeys.includes(selectedDayKey)
      ? selectedDayKey
      : availableDayKeys[availableDayKeys.length - 1] ?? null;

  const minuteMap = new Map<string, UsageDeskProjectedMinutePoint>();
  const minuteRowMap = new Map<
    string,
    {
      timeLabel: string;
      provider: string;
      model: string;
      dominantModelState: UsageDeskDominantModelState;
      totalTokens: number;
      requests: number;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
    }
  >();

  details.forEach((detail) => {
    const date = parseTimestamp(detail.timestamp);
    if (!date || buildDayKey(date) !== resolvedDayKey) return;

    const minuteKey = buildMinuteKey(date, resolution);
    const point = minuteMap.get(minuteKey) ?? {
      minuteKey,
      label: buildMinuteLabel(date, resolution),
      requests: 0,
      totalTokens: 0,
    };
    const tokens = detail.inputTokens + detail.outputTokens;
    point.requests += detail.requestCount;
    point.totalTokens += tokens;
    minuteMap.set(minuteKey, point);

    const minuteRow = minuteRowMap.get(minuteKey) ?? {
      timeLabel: buildMinuteLabel(date, resolution),
      provider: detail.provider,
      model: detail.model,
      dominantModelState: createDominantModelState(detail.model),
      totalTokens: 0,
      requests: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    };
    minuteRow.provider = minuteRow.provider === detail.provider ? detail.provider : 'mixed';
    pushDominantModel(minuteRow.dominantModelState, detail.model, tokens);
    minuteRow.totalTokens += tokens;
    minuteRow.requests += detail.requestCount;
    minuteRow.inputTokens += detail.inputTokens;
    minuteRow.cachedInputTokens += detail.cachedInputTokens;
    minuteRow.outputTokens += detail.outputTokens;
    minuteRow.model = formatDominantModel(minuteRow.dominantModelState);
    minuteRowMap.set(minuteKey, minuteRow);
  });

  const minuteRows = Array.from(minuteRowMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, row]) => ({
      timeLabel: row.timeLabel,
      provider: row.provider,
      model: row.model,
      metric: '总 tokens',
      value: formatUsageDeskChartValue(row.totalTokens, 'tokens'),
      requests: formatUsageDeskChartValue(row.requests, 'count'),
      inputTokens: formatUsageDeskChartValue(row.inputTokens, 'tokens'),
      cachedInputTokens: formatUsageDeskChartValue(row.cachedInputTokens, 'tokens'),
      outputTokens: formatUsageDeskChartValue(row.outputTokens, 'tokens'),
    }));

  const materializeSessionUsage = (
    source: Map<string, Map<string, SessionUsageDraft>>,
  ): Record<string, UsageDeskProjectedSessionUsage[]> => {
    const result: Record<string, UsageDeskProjectedSessionUsage[]> = {};
    source.forEach((sessions, bucketKey) => {
      result[bucketKey] = Array.from(sessions.values())
        .map(({ dominantModelState: _dominantModelState, ...session }) => session)
        .sort((left, right) => {
          if (right.totalTokens !== left.totalTokens) {
            return right.totalTokens - left.totalTokens;
          }
          if (right.latestTimestamp !== left.latestTimestamp) {
            return right.latestTimestamp.localeCompare(left.latestTimestamp);
          }
          return left.sessionID.localeCompare(right.sessionID);
        });
    });
    return result;
  };

  return {
    hasData: true,
    totalRequests,
    totalTokens,
    availableDayKeys,
    selectedDayKey: resolvedDayKey,
    dailyPoints: availableDayKeys.map((dayKey) => dailyMap.get(dayKey)!),
    minutePoints: Array.from(minuteMap.values()).sort((a, b) => a.minuteKey.localeCompare(b.minuteKey)),
    minuteRows,
    sessionUsageByDayKey: materializeSessionUsage(sessionUsageByDayDraft),
    sessionUsageByBucket: materializeSessionUsage(sessionUsageByBucketDraft),
  };
}

export function readUsageDeskProjectedStats(payload: unknown): UsageDeskProjectedStats {
  const record = isRecord(payload) ? payload : {};
  return {
    scannedFiles: typeof record.scannedFiles === 'number' ? record.scannedFiles : 0,
    cacheHitFiles: typeof record.cacheHitFiles === 'number' ? record.cacheHitFiles : 0,
    deltaAppendFiles: typeof record.deltaAppendFiles === 'number' ? record.deltaAppendFiles : 0,
    fullRebuildFiles: typeof record.fullRebuildFiles === 'number' ? record.fullRebuildFiles : 0,
    fileMissingFiles: typeof record.fileMissingFiles === 'number' ? record.fileMissingFiles : 0,
  };
}
