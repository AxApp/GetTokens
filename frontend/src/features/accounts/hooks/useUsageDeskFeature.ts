import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GetCodexLocalUsage,
  GetUsageStatistics,
  RebuildCodexLocalUsage,
  RefreshCodexLocalUsage,
} from '../../../../wailsjs/go/main/App';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { useDebug } from '../../../context/DebugContext';
import type { SidecarStatus, UsageDeskWorkspace as UsageDeskWorkspaceID } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import {
  persistUsageDeskRange,
  persistUsageDeskSource,
  readStoredUsageDeskRange,
  readStoredUsageDeskSource,
} from '../../../utils/pagePersistence';
import {
  buildUsageDeskChartPointStyle,
  buildUsageDeskObservedSnapshot,
  buildUsageDeskProjectedSnapshot,
  formatUsageDeskChartValue,
  resolveUsageDeskChartSelectionKey,
  resolveUsageDeskLinkedRowKey,
  type UsageDeskDailyPoint,
  type UsageDeskChartUnit,
  type UsageDeskMinuteRow,
  type UsageDeskProjectedDailyPoint,
  type UsageDeskRangeOption,
  type UsageDeskSource,
  resolveUsageDeskRangeDrilldownDayKey,
} from '../model/usageDesk';
import { buildUsageDetailRowKey, resolveUsageDetailColumns, type UsageDetailTableRow } from '../components/usage-desk/UsageDetailTable';

export const rangeOptions: UsageDeskRangeOption[] = ['7D', '14D', '30D', '全部'];
export const resolutionOptions = ['1M', '5M', '15M', '30M', '60M'] as const;
export type UsageDeskResolution = (typeof resolutionOptions)[number];

export type LocalUsageProgressEvent = {
  phase?: string;
  currentFile?: string;
  processedFiles?: number;
  totalFiles?: number;
  source?: string;
};
export type ProjectedChartMetric = 'tokens' | 'requests';

function applyRange<T extends UsageDeskDailyPoint | UsageDeskProjectedDailyPoint>(points: T[], range: UsageDeskRangeOption) {
  if (range === '全部') return points;
  const limit = range === '7D' ? 7 : range === '14D' ? 14 : range === '30D' ? 30 : 7;
  return points.slice(-limit);
}

export function useUsageDeskFeature(sidecarStatus: SidecarStatus, workspace: UsageDeskWorkspaceID) {
  const { trackRequest } = useDebug();
  const ready = sidecarStatus?.code === 'ready';

  const [source, setSource] = useState<UsageDeskSource>(() =>
    readStoredUsageDeskSource(typeof window === 'undefined' ? null : window.localStorage),
  );
  const [range, setRange] = useState<UsageDeskRangeOption>(() => {
    const stored = readStoredUsageDeskRange(typeof window === 'undefined' ? null : window.localStorage);
    return (stored as any) === 'TODAY' ? '7D' : stored;
  });
  const [viewScale, setViewScale] = useState<'daily' | 'minute'>('daily');
  const [resolution, setResolution] = useState<UsageDeskResolution>('5M');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [observedUsageData, setObservedUsageData] = useState<unknown>(null);
  const [projectedUsageData, setProjectedUsageData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [projectedLoading, setProjectedLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [projectedLoadError, setProjectedLoadError] = useState('');
  const [projectedActionMessage, setProjectedActionMessage] = useState('');
  const [projectedProgress, setProjectedProgress] = useState<LocalUsageProgressEvent | null>(null);
  const [projectedChartMetric, setProjectedChartMetric] = useState<ProjectedChartMetric>('tokens');
  const [selectedDetailRowKey, setSelectedDetailRowKey] = useState('');
  const [selectedChartPointKey, setSelectedChartPointKey] = useState('');
  const [detailTransitionActive, setDetailTransitionActive] = useState(false);
  const [rangeAnimationVersion, setRangeAnimationVersion] = useState(0);
  const [stickyProgress, setStickyProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    persistUsageDeskSource(typeof window === 'undefined' ? null : window.localStorage, source);
  }, [source]);

  useEffect(() => {
    persistUsageDeskRange(typeof window === 'undefined' ? null : window.localStorage, range);
  }, [range]);

  useEffect(() => {
    if (!hasWailsAppBindings()) {
      return;
    }

    const offProgress = EventsOn('usage-local:progress', (payload: LocalUsageProgressEvent) => {
      setProjectedProgress(payload ?? null);
    });
    const offUpdated = EventsOn('usage-local:updated', (payload: unknown) => {
      setProjectedUsageData(payload ?? null);
      setProjectedProgress(null);
      setProjectedActionMessage('');
      setProjectedLoading(false);
    });

    return () => {
      offProgress?.();
      offUpdated?.();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadObservedUsage() {
      if (!ready) {
        setObservedUsageData(null);
        setLoadError('');
        return;
      }

      setLoading(true);
      setLoadError('');
      try {
        const response = await trackRequest<any>('GetUsageStatistics', { args: [] }, () => GetUsageStatistics());
        if (!mounted) return;
        setObservedUsageData(response?.usage ?? response ?? null);
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setObservedUsageData(null);
        setLoadError('真实请求量暂时不可用');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadObservedUsage();

    return () => {
      mounted = false;
    };
  }, [ready, trackRequest]);

  useEffect(() => {
    let mounted = true;

    async function loadProjectedUsage() {
      setProjectedLoading(true);
      setProjectedLoadError('');
      setProjectedProgress(null);
      try {
        const response = await trackRequest<any>('GetCodexLocalUsage', { args: [] }, () => GetCodexLocalUsage());
        if (!mounted) return;
        setProjectedUsageData(response ?? null);
        setProjectedProgress(null);
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setProjectedUsageData(null);
        setProjectedLoadError('本地投影用量暂时不可用');
        setProjectedProgress(null);
        setProjectedActionMessage('');
      } finally {
        if (mounted) {
          setProjectedLoading(false);
        }
      }
    }

    void loadProjectedUsage();

    return () => {
      mounted = false;
    };
  }, [trackRequest]);

  const refreshProjectedUsage = async () => {
    setProjectedLoading(true);
    setProjectedLoadError('');
    setProjectedProgress(null);
    setProjectedActionMessage('正在刷新索引…');
    try {
      const response = await trackRequest<any>('RefreshCodexLocalUsage', { args: [] }, () => RefreshCodexLocalUsage());
      setProjectedUsageData(response ?? null);
      setProjectedProgress(null);
      setProjectedActionMessage('索引已刷新');
    } catch (error) {
      console.error(error);
      setProjectedLoadError('本地投影用量暂时不可用');
      setProjectedProgress(null);
      setProjectedActionMessage('');
    } finally {
      setProjectedLoading(false);
    }
  };

  const rebuildProjectedUsage = async () => {
    setProjectedLoading(true);
    setProjectedLoadError('');
    setProjectedProgress(null);
    setProjectedActionMessage('正在重建索引…');
    try {
      const response = await trackRequest<any>('RebuildCodexLocalUsage', { args: [] }, () => RebuildCodexLocalUsage());
      setProjectedUsageData(response ?? null);
      setProjectedProgress(null);
      setProjectedActionMessage('索引已重建');
    } catch (error) {
      console.error(error);
      setProjectedLoadError('本地投影用量重建失败');
      setProjectedProgress(null);
      setProjectedActionMessage('');
    } finally {
      setProjectedLoading(false);
    }
  };

  const observedSnapshot = useMemo(
    () => buildUsageDeskObservedSnapshot(observedUsageData, selectedDayKey, resolution),
    [observedUsageData, selectedDayKey, resolution],
  );
  const projectedSnapshot = useMemo(
    () => buildUsageDeskProjectedSnapshot(projectedUsageData, selectedDayKey, resolution),
    [projectedUsageData, selectedDayKey, resolution],
  );
  const visibleDailyPoints = useMemo(
    () => applyRange(observedSnapshot.dailyPoints, range),
    [observedSnapshot.dailyPoints, range],
  );
  const visibleProjectedDailyPoints = useMemo(
    () => applyRange(projectedSnapshot.dailyPoints, range),
    [projectedSnapshot.dailyPoints, range],
  );

  const activeObservedDayKey = visibleDailyPoints[visibleDailyPoints.length - 1]?.dayKey ?? observedSnapshot.selectedDayKey;
  const observedDrilldownDayKey = viewScale === 'minute' ? (selectedDayKey ?? observedSnapshot.selectedDayKey) : null;
  const activeProjectedDayKey = visibleProjectedDailyPoints[visibleProjectedDailyPoints.length - 1]?.dayKey ?? projectedSnapshot.selectedDayKey;
  const projectedDrilldownDayKey = viewScale === 'minute' ? (selectedDayKey ?? projectedSnapshot.selectedDayKey) : null;

  const observedSummaryItems = useMemo(() => {
    if (observedDrilldownDayKey) {
      const dayPoint = observedSnapshot.dailyPoints.find((point) => point.dayKey === observedDrilldownDayKey);
      if (!dayPoint) return [];
      const total = dayPoint.success + dayPoint.failure;
      return [
        `请求 ${formatUsageDeskChartValue(total, 'count')}`,
        `成功 ${formatUsageDeskChartValue(dayPoint.success, 'count')}`,
        `失败 ${formatUsageDeskChartValue(dayPoint.failure, 'count')}`,
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
  }, [observedDrilldownDayKey, observedSnapshot.dailyPoints, visibleDailyPoints]);

  const projectedSummaryItems = useMemo(() => {
    if (projectedDrilldownDayKey) {
      const dayPoint = projectedSnapshot.dailyPoints.find((point) => point.dayKey === projectedDrilldownDayKey);
      if (!dayPoint) return [];
      return [
        `请求 ${formatUsageDeskChartValue(dayPoint.requests, 'count')}`,
        `Token ${formatUsageDeskChartValue(dayPoint.totalTokens, 'tokens')}`,
        `输入 ${formatUsageDeskChartValue(dayPoint.inputTokens, 'tokens')}`,
        `缓存 ${formatUsageDeskChartValue(dayPoint.cachedInputTokens, 'tokens')}`,
        `输出 ${formatUsageDeskChartValue(dayPoint.outputTokens, 'tokens')}`,
      ];
    }

    const requests = visibleProjectedDailyPoints.reduce((sum, point) => sum + point.requests, 0);
    const totalTokens = visibleProjectedDailyPoints.reduce((sum, point) => sum + point.totalTokens, 0);
    const inputTokens = visibleProjectedDailyPoints.reduce((sum, point) => sum + point.inputTokens, 0);
    const cachedInputTokens = visibleProjectedDailyPoints.reduce((sum, point) => sum + point.cachedInputTokens, 0);
    const outputTokens = visibleProjectedDailyPoints.reduce((sum, point) => sum + point.outputTokens, 0);
    return [
      `请求 ${formatUsageDeskChartValue(requests, 'count')}`,
      `Token ${formatUsageDeskChartValue(totalTokens, 'tokens')}`,
      `输入 ${formatUsageDeskChartValue(inputTokens, 'tokens')}`,
      `缓存 ${formatUsageDeskChartValue(cachedInputTokens, 'tokens')}`,
      `输出 ${formatUsageDeskChartValue(outputTokens, 'tokens')}`,
    ];
  }, [projectedDrilldownDayKey, projectedSnapshot.dailyPoints, visibleProjectedDailyPoints]);

  const projectedChartUnit: UsageDeskChartUnit = projectedChartMetric === 'requests' ? 'count' : 'tokens';
  const projectedPrimaryChartPoints = projectedDrilldownDayKey
    ? projectedSnapshot.minutePoints.map((point) => ({
        label: point.label,
        value: projectedChartMetric === 'requests' ? point.requests : point.totalTokens,
        color: '#1f6feb',
      }))
    : visibleProjectedDailyPoints.map((point) => ({
        label: point.label,
        value: projectedChartMetric === 'requests' ? point.requests : point.totalTokens,
        color: '#1f6feb',
        drilldownDayKey: point.dayKey,
      }));

  const observedDailyRows = visibleDailyPoints
    .slice()
    .reverse()
    .map((point) => ({
      timeLabel: point.label,
      provider: 'observed',
      metric: '成功 / 失败',
      value: `${point.success} / ${point.failure}`,
      note: `总请求 ${point.success + point.failure} 次`,
      drilldownDayKey: point.dayKey,
    }));

  const projectedDailyRows = visibleProjectedDailyPoints
    .slice()
    .reverse()
    .map((point) => ({
      timeLabel: point.label,
      provider: 'codex',
      model: point.model ?? '--',
      metric: '总 tokens',
      value: formatUsageDeskChartValue(point.totalTokens, 'tokens'),
      requests: formatUsageDeskChartValue(point.requests, 'count'),
      inputTokens: formatUsageDeskChartValue(point.inputTokens, 'tokens'),
      cachedInputTokens: formatUsageDeskChartValue(point.cachedInputTokens, 'tokens'),
      outputTokens: formatUsageDeskChartValue(point.outputTokens, 'tokens'),
      drilldownDayKey: point.dayKey,
    }));

  const activeDetailRows = source === 'observed'
    ? observedDrilldownDayKey
      ? observedSnapshot.minuteRows
      : observedDailyRows
    : projectedDrilldownDayKey
      ? projectedSnapshot.minuteRows
      : projectedDailyRows;

  const activeDetailColumns = useMemo(() => resolveUsageDetailColumns(activeDetailRows), [activeDetailRows]);

  useEffect(() => {
    const firstRow = activeDetailRows[0] ?? null;
    const firstRowKey = firstRow ? buildUsageDetailRowKey(firstRow) : '';
    const firstChartPointKey = resolveUsageDeskChartSelectionKey(firstRow);

    if (activeDetailRows.length === 0) {
      setSelectedDetailRowKey('');
      setSelectedChartPointKey('');
      return;
    }

    setSelectedDetailRowKey((current) => {
      const hasCurrent = activeDetailRows.some((row) => buildUsageDetailRowKey(row) === current);
      return hasCurrent ? current : firstRowKey;
    });
    setSelectedChartPointKey((current) => {
      const hasCurrent = activeDetailRows.some((row) => resolveUsageDeskChartSelectionKey(row) === current);
      return hasCurrent ? current : firstChartPointKey;
    });
  }, [activeDetailRows]);

  useEffect(() => {
    if (!detailTransitionActive) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDetailTransitionActive(false);
    }, 220);
    return () => {
      window.clearTimeout(timer);
    };
  }, [detailTransitionActive]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      setStickyProgress(Math.max(0, Math.min(container.scrollTop / 220, 1)));
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const nextDayKey = resolveUsageDeskRangeDrilldownDayKey(
      range,
      source === 'observed' ? activeObservedDayKey : activeProjectedDayKey,
    );
    if (!nextDayKey) {
      return;
    }
    setSelectedDayKey((current) => (current === nextDayKey ? current : nextDayKey));
  }, [activeObservedDayKey, activeProjectedDayKey, range, source]);

  function handleDetailRowSelect(rowKey: string, chartPointKey: string) {
    setSelectedDetailRowKey(rowKey);
    setSelectedChartPointKey(chartPointKey);
  }

  function handleChartPointSelect(chartSelectionKey: string) {
    setSelectedChartPointKey(chartSelectionKey);
    const nextRowKey = resolveUsageDeskLinkedRowKey(activeDetailRows, chartSelectionKey);
    if (nextRowKey) {
      setSelectedDetailRowKey(nextRowKey);
    }
  }

  function handleViewScaleChange(nextScale: 'daily' | 'minute') {
    if (viewScale === nextScale) return;
    if (nextScale === 'daily' && selectedDayKey) {
      setSelectedChartPointKey(selectedDayKey);
    }
    setViewScale(nextScale);
  }

  function handleRangeSelect(option: UsageDeskRangeOption) {
    if (range === option) {
      return;
    }
    setRange(option);
    setRangeAnimationVersion((current) => current + 1);
    const nextDayKey = resolveUsageDeskRangeDrilldownDayKey(
      option,
      source === 'observed' ? activeObservedDayKey : activeProjectedDayKey,
    );
    if (nextDayKey) {
      setDetailTransitionActive(true);
      setSelectedDayKey(nextDayKey);
      return;
    }
    setSelectedDayKey(null);
  }

  return {
    source,
    setSource,
    range,
    viewScale,
    resolution,
    setResolution,
    selectedDayKey,
    observedUsageData,
    projectedUsageData,
    loading,
    projectedLoading,
    loadError,
    projectedLoadError,
    projectedActionMessage,
    projectedProgress,
    projectedChartMetric,
    setProjectedChartMetric,
    selectedDetailRowKey,
    selectedChartPointKey,
    detailTransitionActive,
    rangeAnimationVersion,
    stickyProgress,
    scrollContainerRef,
    refreshProjectedUsage,
    rebuildProjectedUsage,
    observedSnapshot,
    projectedSnapshot,
    visibleDailyPoints,
    visibleProjectedDailyPoints,
    observedDrilldownDayKey,
    projectedDrilldownDayKey,
    observedSummaryItems,
    projectedSummaryItems,
    projectedChartUnit,
    projectedPrimaryChartPoints,
    activeDetailRows,
    activeDetailColumns,
    handleDetailRowSelect,
    handleChartPointSelect,
    handleViewScaleChange,
    handleRangeSelect,
  };
}
