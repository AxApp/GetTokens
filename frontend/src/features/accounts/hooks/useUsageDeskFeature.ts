import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GetCodexLocalUsage,
  GetSidecarUsageAttribution,
  GetUsageStatistics,
  RebuildCodexLocalUsage,
  RefreshCodexLocalUsage,
} from '../../../../wailsjs/go/main/App';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { useDebug } from '../../../context/DebugContext';
import type { SidecarStatus, UsageDeskWorkspace as UsageDeskWorkspaceID } from '../../../types';
import { hasPreviewMode, hasWailsAppBindings } from '../../../utils/previewMode';
import {
  persistUsageDeskRange,
  persistUsageDeskSource,
  readStoredUsageDeskRange,
  readStoredUsageDeskSource,
} from '../../../utils/pagePersistence';
import {
  buildUsageDeskChartPointStyle,
  buildUsageDeskObservedSummaryItems,
  buildUsageDeskProjectedSessionBucketKey,
  buildUsageDeskObservedSnapshot,
  buildUsageDeskProjectedSnapshot,
  buildUsageDeskProjectedSummaryItems,
  formatUsageDeskChartValue,
  resolveUsageDeskChartSelectionKey,
  resolveUsageDeskLinkedRowKey,
  shouldOpenUsageDeskProjectedSessionSurface,
  type UsageDeskDailyPoint,
  type UsageDeskChartUnit,
  type UsageDeskMinuteRow,
  type UsageDeskProjectedDailyPoint,
  type UsageDeskProjectedSessionUsage,
  type UsageDeskProjectedSurfaceView,
  type UsageDeskRangeOption,
  type UsageDeskSource,
  resolveUsageDeskRangeDrilldownDayKey,
} from '../model/usageDesk';
import {
  getUsageDeskPreviewObservedUsage,
  getUsageDeskPreviewProjectedUsage,
} from '../previewData';
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

function resolveObservedAttributionWindow(range: UsageDeskRangeOption): string {
  switch (range) {
    case '7D':
      return '7d';
    case '14D':
      return '14d';
    case '30D':
      return '30d';
    case '全部':
      return 'all';
    case 'TODAY':
    default:
      return '24h';
  }
}

function resolveObservedAttributionBucket(resolution: UsageDeskResolution): string {
  switch (resolution) {
    case '1M':
      return '1m';
    case '5M':
      return '5m';
    case '15M':
      return '15m';
    case '30M':
      return '30m';
    case '60M':
    default:
      return '1h';
  }
}

export function useUsageDeskFeature(sidecarStatus: SidecarStatus, workspace: UsageDeskWorkspaceID) {
  const { trackRequest } = useDebug();
  const browserMode = hasPreviewMode('usage-codex') || !hasWailsAppBindings();
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
  const [projectedSurfaceView, setProjectedSurfaceView] = useState<'chart' | 'sessions'>('chart');
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
      if (browserMode) {
        if (!mounted) return;
        setObservedUsageData(getUsageDeskPreviewObservedUsage(workspace));
        setLoadError('');
        setLoading(false);
        return;
      }

      if (!ready) {
        setObservedUsageData(null);
        setLoadError('');
        return;
      }

      setLoading(true);
      setLoadError('');
      try {
        const attributionInput = {
          window: resolveObservedAttributionWindow(range),
          bucket: resolveObservedAttributionBucket(resolution),
          includeUnresolved: true,
        };
        const attribution = await trackRequest<any>(
          'GetSidecarUsageAttribution',
          { args: [attributionInput] },
          () => GetSidecarUsageAttribution(attributionInput),
        );
        const hasAttributionData =
          (Array.isArray(attribution?.items) && attribution.items.length > 0) ||
          (Array.isArray(attribution?.unresolved) && attribution.unresolved.length > 0);
        if (!mounted) return;
        if (hasAttributionData) {
          setObservedUsageData(attribution);
          return;
        }

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
  }, [browserMode, ready, range, resolution, trackRequest, workspace]);

  useEffect(() => {
    let mounted = true;

    async function loadProjectedUsage() {
      if (browserMode) {
        if (!mounted) return;
        setProjectedUsageData(getUsageDeskPreviewProjectedUsage(workspace));
        setProjectedLoading(false);
        setProjectedLoadError('');
        setProjectedProgress(null);
        setProjectedActionMessage('');
        return;
      }

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
  }, [browserMode, trackRequest, workspace]);

  const refreshProjectedUsage = async () => {
    if (browserMode) {
      setProjectedUsageData(getUsageDeskPreviewProjectedUsage(workspace));
      setProjectedLoading(false);
      setProjectedLoadError('');
      setProjectedProgress(null);
      setProjectedActionMessage('预览数据已刷新');
      return;
    }

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
    if (browserMode) {
      setProjectedUsageData(getUsageDeskPreviewProjectedUsage(workspace));
      setProjectedLoading(false);
      setProjectedLoadError('');
      setProjectedProgress(null);
      setProjectedActionMessage('预览索引已重建');
      return;
    }

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
    return buildUsageDeskObservedSummaryItems({
      drilldownDayKey: observedDrilldownDayKey,
      dailyPoints: observedSnapshot.dailyPoints,
      visibleDailyPoints,
    });
  }, [observedDrilldownDayKey, observedSnapshot.dailyPoints, visibleDailyPoints]);

  const projectedSummaryItems = useMemo(() => {
    return buildUsageDeskProjectedSummaryItems({
      drilldownDayKey: projectedDrilldownDayKey,
      dailyPoints: projectedSnapshot.dailyPoints,
      visibleDailyPoints: visibleProjectedDailyPoints,
    });
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
      model: '--',
      metric: '总请求',
      value: formatUsageDeskChartValue(point.requests, 'count'),
      note: point.failure > 0 ? `失败 ${formatUsageDeskChartValue(point.failure, 'count')}` : undefined,
      requests: formatUsageDeskChartValue(point.requests, 'count'),
      inputTokens: formatUsageDeskChartValue(point.inputTokens, 'tokens'),
      cachedInputTokens: formatUsageDeskChartValue(point.cachedInputTokens, 'tokens'),
      outputTokens: formatUsageDeskChartValue(point.outputTokens, 'tokens'),
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

  const selectedProjectedSessionUsages = useMemo<UsageDeskProjectedSessionUsage[]>(() => {
    if (source !== 'projected' || !selectedDetailRowKey) {
      return [];
    }
    const selectedRow = activeDetailRows.find((row) => buildUsageDetailRowKey(row) === selectedDetailRowKey);
    if (!selectedRow) {
      return [];
    }

    if (projectedDrilldownDayKey) {
      const bucketKey = buildUsageDeskProjectedSessionBucketKey(projectedDrilldownDayKey, selectedRow.timeLabel);
      return projectedSnapshot.sessionUsageByBucket[bucketKey] ?? [];
    }

    const dayKey = 'drilldownDayKey' in selectedRow ? selectedRow.drilldownDayKey : undefined;
    return dayKey ? (projectedSnapshot.sessionUsageByDayKey[dayKey] ?? []) : [];
  }, [activeDetailRows, projectedDrilldownDayKey, projectedSnapshot.sessionUsageByBucket, projectedSnapshot.sessionUsageByDayKey, selectedDetailRowKey, source]);

  const selectedProjectedSessionUsageLabel = useMemo(() => {
    if (source !== 'projected') {
      return '';
    }
    const selectedRow = activeDetailRows.find((row) => buildUsageDetailRowKey(row) === selectedDetailRowKey);
    if (!selectedRow) {
      return projectedDrilldownDayKey ? `本地会话 / ${projectedDrilldownDayKey}` : '本地会话';
    }
    if (projectedDrilldownDayKey) {
      return `本地会话 / ${projectedDrilldownDayKey} ${selectedRow.timeLabel}`;
    }
    return `本地会话 / ${selectedRow.timeLabel}`;
  }, [activeDetailRows, projectedDrilldownDayKey, selectedDetailRowKey, source]);

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
    if (shouldOpenUsageDeskProjectedSessionSurface(source, rowKey)) {
      setProjectedSurfaceView('sessions');
    }
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

  function handleProjectedSurfaceViewChange(nextView: UsageDeskProjectedSurfaceView) {
    if (nextView === 'sessions') {
      setProjectedSurfaceView('sessions');
      return;
    }
    setProjectedSurfaceView('chart');
    handleViewScaleChange(nextView);
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
    projectedSurfaceView,
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
    selectedProjectedSessionUsages,
    selectedProjectedSessionUsageLabel,
    activeDetailRows,
    activeDetailColumns,
    handleDetailRowSelect,
    handleChartPointSelect,
    handleViewScaleChange,
    handleProjectedSurfaceViewChange,
    handleRangeSelect,
  };
}
