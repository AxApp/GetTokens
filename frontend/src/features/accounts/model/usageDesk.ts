export type UsageDeskSource = 'observed' | 'projected';

export interface UsageDeskObservedDetail {
  timestamp: string;
  provider: string;
  model: string;
  failed: boolean;
  latencyMs: number | null;
}

export interface UsageDeskDailyPoint {
  dayKey: string;
  label: string;
  success: number;
  failure: number;
}

export interface UsageDeskMinutePoint {
  minuteKey: string;
  label: string;
  success: number;
  failure: number;
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
}

export interface UsageDeskProjectedStats {
  scannedFiles: number;
  cacheHitFiles: number;
  deltaAppendFiles: number;
  fullRebuildFiles: number;
  fileMissingFiles: number;
}

export type UsageDeskChartUnit = 'count' | 'tokens';
export type UsageDeskRangeOption = 'TODAY' | '7D' | '14D' | '30D' | '全部';
export type UsageDeskResolution = '1M' | '5M' | '15M' | '30M' | '60M';
export type UsageDeskCurveMotion = 'standard' | 'realtime';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
    const total = dayPoint.success + dayPoint.failure;
    return [
      `全天请求 ${formatUsageDeskChartValue(total, 'count')}`,
      `全天成功 ${formatUsageDeskChartValue(dayPoint.success, 'count')}`,
      `全天失败 ${formatUsageDeskChartValue(dayPoint.failure, 'count')}`,
    ];
  }

  const success = visibleDailyPoints.reduce((sum, point) => sum + point.success, 0);
  const failure = visibleDailyPoints.reduce((sum, point) => sum + point.failure, 0);
  const total = success + failure;
  return [
    `请求 ${formatUsageDeskChartValue(total, 'count')}`,
    `成功 ${formatUsageDeskChartValue(success, 'count')}`,
    `失败 ${formatUsageDeskChartValue(failure, 'count')}`,
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
    return [
      `全天请求 ${formatUsageDeskChartValue(dayPoint.requests, 'count')}`,
      `全天 Token ${formatUsageDeskChartValue(dayPoint.totalTokens, 'tokens')}`,
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
  return [
    `请求 ${formatUsageDeskChartValue(requests, 'count')}`,
    `Token ${formatUsageDeskChartValue(totalTokens, 'tokens')}`,
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

export function collectUsageDeskObservedDetails(usageData: unknown): UsageDeskObservedDetail[] {
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
          failed: detail.failed === true,
          latencyMs:
            typeof detail.latency_ms === 'number' && Number.isFinite(detail.latency_ms)
              ? detail.latency_ms
              : null,
        });
      });
    });
  });

  return result.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function buildUsageDeskObservedSnapshot(
  usageData: unknown,
  selectedDayKey?: string | null,
  resolution: UsageDeskResolution = '1M',
): UsageDeskObservedSnapshot {
  const details = collectUsageDeskObservedDetails(usageData);
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
      success: 0,
      failure: 0,
    };
    if (detail.failed) {
      point.failure += 1;
      failure += 1;
    } else {
      point.success += 1;
      success += 1;
    }
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
      success: number;
      failure: number;
      requests: number;
      highLatencyCount: number;
    }
  >();

  details.forEach((detail) => {
    const date = parseTimestamp(detail.timestamp);
    if (!date || buildDayKey(date) !== resolvedDayKey) return;

    const minuteKey = buildMinuteKey(date, resolution);
    const minutePoint = minuteMap.get(minuteKey) ?? {
      minuteKey,
      label: buildMinuteLabel(date, resolution),
      success: 0,
      failure: 0,
    };

    if (detail.failed) {
      minutePoint.failure += 1;
    } else {
      minutePoint.success += 1;
    }
    minuteMap.set(minuteKey, minutePoint);

    const minuteRow = minuteRowMap.get(minuteKey) ?? {
      timeLabel: buildMinuteLabel(date, resolution),
      provider: detail.provider,
      success: 0,
      failure: 0,
      requests: 0,
      highLatencyCount: 0,
    };
    minuteRow.provider = minuteRow.provider === detail.provider ? detail.provider : 'mixed';
    minuteRow.requests += 1;
    if (detail.failed) {
      minuteRow.failure += 1;
    } else {
      minuteRow.success += 1;
      if (detail.latencyMs && detail.latencyMs > 2000) {
        minuteRow.highLatencyCount += 1;
      }
    }
    minuteRowMap.set(minuteKey, minuteRow);
  });

  const minuteRows = Array.from(minuteRowMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, row]) => {
      if (row.requests === 1 && resolution === '1M') {
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

      return {
        timeLabel: row.timeLabel,
        provider: row.provider,
        metric: '请求汇总',
        value: `${row.success} / ${row.failure}`,
        note:
          row.failure > 0
            ? `总请求 ${row.requests} 次 / 失败 ${row.failure} 次`
            : row.highLatencyCount > 0
              ? `总请求 ${row.requests} 次 / 高延迟 ${row.highLatencyCount} 次`
              : `总请求 ${row.requests} 次`,
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
    };
  }

  const dailyMap = new Map<
    string,
    UsageDeskProjectedDailyPoint & {
      dominantModelState: UsageDeskDominantModelState;
    }
  >();
  let totalRequests = 0;
  let totalTokens = 0;

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

  return {
    hasData: true,
    totalRequests,
    totalTokens,
    availableDayKeys,
    selectedDayKey: resolvedDayKey,
    dailyPoints: availableDayKeys.map((dayKey) => dailyMap.get(dayKey)!),
    minutePoints: Array.from(minuteMap.values()).sort((a, b) => a.minuteKey.localeCompare(b.minuteKey)),
    minuteRows,
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
