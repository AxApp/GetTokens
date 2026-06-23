import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GetClaudeLocalUsage,
  GetCodexLocalUsage,
  GetSidecarUsageAttribution,
  GetUsageStatistics,
  RebuildClaudeLocalUsage,
  RebuildClaudeLocalUsageDay,
  RebuildCodexLocalUsage,
  RebuildCodexLocalUsageDay,
  RefreshClaudeLocalUsage,
  RefreshCodexLocalUsage,
} from '../../../../wailsjs/go/main/App';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { useDebug } from '../../../context/useDebug';
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
  buildUsageDeskObservedFacetGroups,
  buildUsageDeskObservedSummaryItems,
  buildUsageDeskProjectedFacetGroups,
  buildUsageDeskProjectedProjectUsageRows,
  buildUsageDeskProjectedSessionBucketKey,
  buildUsageDeskObservedSnapshot,
  buildUsageDeskProjectedSnapshot,
  buildUsageDeskProjectedSummaryItems,
  formatUsageDeskChartValue,
  resolveUsageDeskStatusEvidence,
  resolveUsageDeskChartSelectionKey,
  resolveUsageDeskLinkedRowKey,
  shouldOpenUsageDeskProjectedSessionSurface,
  type UsageDeskDailyPoint,
  type UsageDeskChartUnit,
  type UsageDeskMinuteRow,
  type UsageDeskProjectedDailyPoint,
  type UsageDeskProjectedProjectUsage,
  type UsageDeskProjectedSessionUsage,
  type UsageDeskProjectedSurfaceView,
  type UsageDeskRangeOption,
  type UsageDeskSource,
  type UsageDeskFacetFilters,
  type UsageDeskFacetKind,
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
  provider?: string;
  phase?: string;
  currentFile?: string;
  processedFiles?: number;
  totalFiles?: number;
  source?: string;
};
export type ProjectedChartMetric = 'tokens' | 'requests';

function resolveProjectedUsageRuntime(workspace: UsageDeskWorkspaceID) {
  if (workspace === 'claude') {
    return {
      getName: 'GetClaudeLocalUsage',
      refreshName: 'RefreshClaudeLocalUsage',
      rebuildName: 'RebuildClaudeLocalUsage',
      rebuildDayName: 'RebuildClaudeLocalUsageDay',
      get: () => GetClaudeLocalUsage(),
      refresh: () => RefreshClaudeLocalUsage(),
      rebuild: () => RebuildClaudeLocalUsage(),
      rebuildDay: (dayKey: string) => RebuildClaudeLocalUsageDay(dayKey),
    };
  }

  return {
    getName: 'GetCodexLocalUsage',
    refreshName: 'RefreshCodexLocalUsage',
    rebuildName: 'RebuildCodexLocalUsage',
    rebuildDayName: 'RebuildCodexLocalUsageDay',
    get: () => GetCodexLocalUsage(),
    refresh: () => RefreshCodexLocalUsage(),
    rebuild: () => RebuildCodexLocalUsage(),
    rebuildDay: (dayKey: string) => RebuildCodexLocalUsageDay(dayKey),
  };
}

function isProjectedUsagePayloadForWorkspace(payload: unknown, workspace: UsageDeskWorkspaceID): boolean {
  if (!payload || typeof payload !== 'object') {
    return true;
  }
  const provider = (payload as { provider?: unknown }).provider;
  return typeof provider !== 'string' || provider === workspace;
}

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
  const supportsProjectedUsage = workspace === 'codex' || workspace === 'claude';

  const [source, setSource] = useState<UsageDeskSource>(() =>
    workspace === 'codex' || workspace === 'claude'
      ? readStoredUsageDeskSource(typeof window === 'undefined' ? null : window.localStorage)
      : 'observed',
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
  const [projectedSurfaceView, setProjectedSurfaceView] = useState<'chart' | 'projects' | 'sessions'>('chart');
  const [facetFilters, setFacetFilters] = useState<Required<UsageDeskFacetFilters>>({
    provider: '',
    account: '',
    model: '',
  });
  const [selectedDetailRowKey, setSelectedDetailRowKey] = useState('');
  const [selectedChartPointKey, setSelectedChartPointKey] = useState('');
  const [detailTransitionActive, setDetailTransitionActive] = useState(false);
  const [rangeAnimationVersion, setRangeAnimationVersion] = useState(0);
  const [stickyProgress, setStickyProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!supportsProjectedUsage && source === 'projected') {
      setSource('observed');
    }
  }, [source, supportsProjectedUsage]);

  useEffect(() => {
    persistUsageDeskSource(typeof window === 'undefined' ? null : window.localStorage, source);
  }, [source]);

  useEffect(() => {
    setFacetFilters({ provider: '', account: '', model: '' });
    setSelectedDetailRowKey('');
    setSelectedChartPointKey('');
  }, [source, workspace]);

  useEffect(() => {
    persistUsageDeskRange(typeof window === 'undefined' ? null : window.localStorage, range);
  }, [range]);

  useEffect(() => {
    if (!hasWailsAppBindings()) {
      return;
    }

    const offProgress = EventsOn('usage-local:progress', (payload: LocalUsageProgressEvent) => {
      if (!isProjectedUsagePayloadForWorkspace(payload, workspace)) {
        return;
      }
      setProjectedProgress(payload ?? null);
    });
    const offUpdated = EventsOn('usage-local:updated', (payload: unknown) => {
      if (!isProjectedUsagePayloadForWorkspace(payload, workspace)) {
        return;
      }
      setProjectedUsageData(payload ?? null);
      setProjectedProgress(null);
      setProjectedActionMessage('');
      setProjectedLoading(false);
    });

    return () => {
      offProgress?.();
      offUpdated?.();
    };
  }, [workspace]);

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
      if (!supportsProjectedUsage) {
        if (!mounted) return;
        setProjectedUsageData(null);
        setProjectedLoading(false);
        setProjectedLoadError('');
        setProjectedProgress(null);
        setProjectedActionMessage('');
        return;
      }

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
        const runtime = resolveProjectedUsageRuntime(workspace);
        const response = await trackRequest<any>(runtime.getName, { args: [] }, runtime.get);
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
  }, [browserMode, supportsProjectedUsage, trackRequest, workspace]);

  const refreshProjectedUsage = async () => {
    if (!supportsProjectedUsage) {
      setProjectedActionMessage('');
      return;
    }

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
      const runtime = resolveProjectedUsageRuntime(workspace);
      const response = await trackRequest<any>(runtime.refreshName, { args: [] }, runtime.refresh);
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
    if (!supportsProjectedUsage) {
      setProjectedActionMessage('');
      return;
    }

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
      const runtime = resolveProjectedUsageRuntime(workspace);
      const response = await trackRequest<any>(runtime.rebuildName, { args: [] }, runtime.rebuild);
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

  const rebuildProjectedUsageDay = async (dayKey?: string | null) => {
    if (!supportsProjectedUsage) {
      setProjectedActionMessage('');
      return;
    }

    const targetDayKey = dayKey?.trim();
    if (!targetDayKey) {
      return rebuildProjectedUsage();
    }
    if (browserMode) {
      setProjectedUsageData(getUsageDeskPreviewProjectedUsage(workspace));
      setProjectedLoading(false);
      setProjectedLoadError('');
      setProjectedProgress(null);
      setProjectedActionMessage(`预览索引已重建 ${targetDayKey}`);
      return;
    }

    setProjectedLoading(true);
    setProjectedLoadError('');
    setProjectedProgress(null);
    setProjectedActionMessage(`正在重建 ${targetDayKey}…`);
    try {
      const runtime = resolveProjectedUsageRuntime(workspace);
      const response = await trackRequest<any>(runtime.rebuildDayName, { args: [targetDayKey] }, () =>
        runtime.rebuildDay(targetDayKey),
      );
      setProjectedUsageData(response ?? null);
      setProjectedProgress(null);
      setProjectedActionMessage(`${targetDayKey} 已重建`);
    } catch (error) {
      console.error(error);
      setProjectedLoadError('本地投影用量单日重建失败');
      setProjectedProgress(null);
      setProjectedActionMessage('');
    } finally {
      setProjectedLoading(false);
    }
  };

  const observedSnapshot = useMemo(
    () => buildUsageDeskObservedSnapshot(observedUsageData, selectedDayKey, resolution, workspace, facetFilters),
    [observedUsageData, selectedDayKey, resolution, workspace, facetFilters],
  );
  const projectedSnapshot = useMemo(
    () => buildUsageDeskProjectedSnapshot(projectedUsageData, selectedDayKey, resolution, facetFilters),
    [projectedUsageData, selectedDayKey, resolution, facetFilters],
  );
  const usageFacetGroups = useMemo(
    () =>
      source === 'observed'
        ? buildUsageDeskObservedFacetGroups(observedUsageData, facetFilters, workspace)
        : buildUsageDeskProjectedFacetGroups(projectedUsageData, facetFilters),
    [facetFilters, observedUsageData, projectedUsageData, source, workspace],
  );
  const activeFacetSummary = useMemo(
    () =>
      usageFacetGroups
        .flatMap((group) => group.options.filter((option) => option.active).map((option) => `${group.label}: ${option.label}`))
        .join(' / '),
    [usageFacetGroups],
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

  const observedStatusEvidence = useMemo(
    () => resolveUsageDeskStatusEvidence(observedUsageData, workspace),
    [observedUsageData, workspace],
  );
  const projectedStatusEvidence = useMemo(
    () => resolveUsageDeskStatusEvidence(projectedUsageData, workspace),
    [projectedUsageData, workspace],
  );

  const projectedChartUnit: UsageDeskChartUnit = projectedChartMetric === 'requests' ? 'count' : 'tokens';
  const projectedPrimaryChartPoints = projectedDrilldownDayKey
    ? projectedSnapshot.minutePoints.map((point) => ({
        label: point.label,
        value: projectedChartMetric === 'requests' ? point.requests : point.totalTokens,
        color: 'var(--color-chart-blue)',
      }))
    : visibleProjectedDailyPoints.map((point) => ({
        label: point.label,
        value: projectedChartMetric === 'requests' ? point.requests : point.totalTokens,
        color: 'var(--color-chart-blue)',
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
      provider: workspace,
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
    if (source !== 'projected') {
      return [];
    }

    // When viewing projects/sessions without a specific row selection, aggregate all visible days
    if (projectedSurfaceView === 'projects' || projectedSurfaceView === 'sessions') {
      if (!selectedDetailRowKey) {
        const allSessions: UsageDeskProjectedSessionUsage[] = [];
        for (const point of visibleProjectedDailyPoints) {
          const sessions = projectedSnapshot.sessionUsageByDayKey[point.dayKey];
          if (sessions) {
            allSessions.push(...sessions);
          }
        }
        return allSessions;
      }
    }

    if (!selectedDetailRowKey) {
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
  }, [activeDetailRows, projectedDrilldownDayKey, projectedSurfaceView, projectedSnapshot.sessionUsageByBucket, projectedSnapshot.sessionUsageByDayKey, selectedDetailRowKey, source, visibleProjectedDailyPoints]);

  const selectedProjectedProjectUsages = useMemo<UsageDeskProjectedProjectUsage[]>(
    () => buildUsageDeskProjectedProjectUsageRows(selectedProjectedSessionUsages),
    [selectedProjectedSessionUsages],
  );

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
    if (activeDetailRows.length === 0) {
      setSelectedDetailRowKey('');
      setSelectedChartPointKey('');
      return;
    }

    setSelectedDetailRowKey((current) => {
      if (!current) {
        return '';
      }
      const hasCurrent = activeDetailRows.some((row) => buildUsageDetailRowKey(row) === current);
      return hasCurrent ? current : '';
    });
    setSelectedChartPointKey((current) => {
      if (!current) {
        return '';
      }
      const hasCurrent = activeDetailRows.some((row) => resolveUsageDeskChartSelectionKey(row) === current);
      return hasCurrent ? current : '';
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
    if (selectedDetailRowKey === rowKey) {
      setSelectedDetailRowKey('');
      setSelectedChartPointKey('');
      if (source === 'projected') {
        setProjectedSurfaceView('chart');
      }
      return;
    }
    setSelectedDetailRowKey(rowKey);
    setSelectedChartPointKey(chartPointKey);
    if (shouldOpenUsageDeskProjectedSessionSurface(source, rowKey)) {
      setProjectedSurfaceView('sessions');
    }
  }

  function handleChartPointSelect(chartSelectionKey: string) {
    if (selectedChartPointKey === chartSelectionKey) {
      setSelectedChartPointKey('');
      setSelectedDetailRowKey('');
      if (source === 'projected') {
        setProjectedSurfaceView('chart');
      }
      return;
    }
    setSelectedChartPointKey(chartSelectionKey);
    const nextRowKey = resolveUsageDeskLinkedRowKey(activeDetailRows, chartSelectionKey);
    if (nextRowKey) {
      setSelectedDetailRowKey(nextRowKey);
    }
  }

  function handleViewScaleChange(nextScale: 'daily' | 'minute') {
    if (viewScale === nextScale) return;
    setViewScale(nextScale);
  }

  function handleProjectedSurfaceViewChange(nextView: UsageDeskProjectedSurfaceView) {
    if (nextView === 'projects') {
      setProjectedSurfaceView('projects');
      return;
    }
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
    setSelectedDetailRowKey('');
    setSelectedChartPointKey('');
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

  function handleUsageFacetSelect(kind: UsageDeskFacetKind, value: string) {
    setFacetFilters((current) => ({
      ...current,
      [kind]: current[kind] === value ? '' : value,
    }));
    setSelectedDetailRowKey('');
    setSelectedChartPointKey('');
    setRangeAnimationVersion((current) => current + 1);
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
    facetFilters,
    usageFacetGroups,
    activeFacetSummary,
    selectedDetailRowKey,
    selectedChartPointKey,
    detailTransitionActive,
    rangeAnimationVersion,
    stickyProgress,
    scrollContainerRef,
    refreshProjectedUsage,
    rebuildProjectedUsage,
    rebuildProjectedUsageDay,
    observedSnapshot,
    projectedSnapshot,
    visibleDailyPoints,
    visibleProjectedDailyPoints,
    observedDrilldownDayKey,
    projectedDrilldownDayKey,
    observedSummaryItems,
    projectedSummaryItems,
    observedStatusEvidence,
    projectedStatusEvidence,
    projectedChartUnit,
    projectedPrimaryChartPoints,
    selectedProjectedProjectUsages,
    selectedProjectedSessionUsages,
    selectedProjectedSessionUsageLabel,
    activeDetailRows,
    activeDetailColumns,
    handleDetailRowSelect,
    handleChartPointSelect,
    handleViewScaleChange,
    handleProjectedSurfaceViewChange,
    handleRangeSelect,
    handleUsageFacetSelect,
  };
}
