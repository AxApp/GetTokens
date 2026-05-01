import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  GetCodexLocalUsage,
  GetUsageStatistics,
  RebuildCodexLocalUsage,
  RefreshCodexLocalUsage,
} from '../../../../wailsjs/go/main/App';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
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

const rangeOptions: UsageDeskRangeOption[] = ['7D', '14D', '30D', '全部'];
const resolutionOptions = ['1M', '5M', '15M', '30M', '60M'] as const;
type UsageDeskResolution = (typeof resolutionOptions)[number];

type UsageDetailTableRow = UsageDeskMinuteRow & {
  drilldownDayKey?: string;
};

type UsageDetailColumnKey =
  | 'timeLabel'
  | 'model'
  | 'value'
  | 'note'
  | 'requests'
  | 'inputTokens'
  | 'cachedInputTokens'
  | 'outputTokens';
type UsageDetailColumn = { key: UsageDetailColumnKey; header: string };
type LocalUsageProgressEvent = {
  phase?: string;
  currentFile?: string;
  processedFiles?: number;
  totalFiles?: number;
  source?: string;
};
type ProjectedChartMetric = 'tokens' | 'requests';

export default function UsageDeskWorkspace({
  sidecarStatus,
  workspace,
}: {
  sidecarStatus: SidecarStatus;
  workspace: UsageDeskWorkspaceID;
}) {
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
      await refreshProjectedUsage('initial');
    }

    async function refreshProjectedUsage(mode: 'initial' | 'refresh') {
      setProjectedLoading(true);
      setProjectedLoadError('');
      setProjectedProgress(null);
      if (mode !== 'initial') {
        setProjectedActionMessage(mode === 'refresh' ? '正在刷新索引…' : '');
      }
      try {
        const response = await trackRequest<any>('GetCodexLocalUsage', { args: [] }, () => GetCodexLocalUsage());
        if (!mounted) return;
        setProjectedUsageData(response ?? null);
        setProjectedProgress(null);
        if (mode === 'refresh') {
          setProjectedActionMessage('索引已刷新');
        }
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

  async function refreshProjectedUsage() {
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
  }

  async function rebuildProjectedUsage() {
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
  }

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

  const activeDayLabel = activeObservedDayKey ? activeObservedDayKey.slice(5) : '--';
  const activeProjectedDayLabel = activeProjectedDayKey ? activeProjectedDayKey.slice(5) : '--';
  const activePageLabel = workspace;
  const pageTitle = workspace === 'gemini' ? 'Gemini Usage Desk' : 'Codex Usage Desk';
  const pageDescription =
    workspace === 'gemini'
      ? 'Gemini 子页保留独立页面边界，后续接入自己的 usage 真源、图表和明细表。'
      : '当前已经接入 ObservedRequestUsage 与 LocalProjectedUsage 两条真实数据链路，并在同一页内承接按日与分钟级切换。';
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
  const shouldHighlightRangeSelection = selectedDayKey === null;
  const projectedLoadingBody = useMemo<ReactNode>(() => {
    const processedFiles = projectedProgress?.processedFiles ?? 0;
    const totalFiles = projectedProgress?.totalFiles ?? 0;
    const currentFile = projectedProgress?.currentFile?.trim();
    const sourceLabel =
      projectedProgress?.source === 'cacheHit'
        ? '缓存命中'
        : projectedProgress?.source === 'deltaAppend'
          ? '增量追加'
          : projectedProgress?.source === 'fullRebuild'
            ? '全量重建'
            : projectedProgress?.source === 'fileMissing'
              ? '文件移除'
              : '';

    return (
      <div className="space-y-2">
        <div>正在扫描本地 Codex rollout 样本。</div>
        <div className="font-black text-[var(--text-primary)]">
          进度 {processedFiles}/{totalFiles || '?'}
        </div>
        {currentFile ? (
          <div className="break-all">
            当前文件 {currentFile}
            {sourceLabel ? ` · ${sourceLabel}` : ''}
          </div>
        ) : null}
      </div>
    );
  }, [projectedProgress]);

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

  return (
    <div ref={scrollContainerRef} className="h-full w-full overflow-auto bg-[var(--bg-surface)]" data-collaboration-id="PAGE_USAGE_DESK">
      <div className="mx-auto max-w-7xl space-y-8 px-12 pb-32 pt-12">
        <WorkspacePageHeader
          title={pageTitle}
          subtitle={pageDescription}
          subtitleClassName="mt-1 max-w-3xl text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]"
          actions={
            <>
              <button
                onClick={() => setSource('observed')}
                className={`btn-swiss ${source === 'observed' ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
              >
                真实请求量
              </button>
              <button
                onClick={() => setSource('projected')}
                className={`btn-swiss ${source === 'projected' ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
              >
                本地投影用量
              </button>
            </>
          }
        />

        <div className="space-y-6">
          {workspace === 'gemini' ? (
              <section className="card-swiss !p-5">
                <div className="flex flex-col gap-4 border-b-2 border-dashed border-[var(--border-color)] pb-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">模块 01</div>
                    <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tight text-[var(--text-primary)]">gemini 用量分析</h3>
                  </div>
                  <p className="max-w-2xl text-[0.6875rem] leading-6 text-[var(--text-muted)]">
                    `gemini` 保留为独立页面，不和 `codex` 混在同一块里。当前这页先只承接页面边界，后续再接入 gemini 自己的 usage 真源。
                  </p>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <InfoCard
                    title="当前子页"
                    highlight="gemini"
                    body="这个子页和 codex 是并列关系，后续会有独立的数据链路、图表和明细表，不再走混合池视图。"
                  />
                  <InfoCard
                    title="页面状态"
                    highlight="独立页面"
                    body="当前先完成信息架构收口：左侧只保留 codex / gemini 两个子选项，主区按子选项切成独立页面。"
                  />
                  <InfoCard
                    title="接入计划"
                    highlight="待接入"
                    body="后续需要为 Gemini 建立自己的 ObservedRequestUsage / LocalProjectedUsage 定义，再把图表模块接进来。"
                  />
                </div>
              </section>
          ) : null}

          {workspace === 'codex' ? (
            <section className="space-y-5">
              {source === 'observed' ? (
                <section className="space-y-5">
                    <div className="space-y-5">
                      <div className="sticky top-0 z-20 -mx-12 bg-[var(--bg-surface)] px-12 pb-3 pt-3">
                      {loading ? (
                        <StatePanel title="加载中" body="正在拉取 sidecar /usage 真实请求样本。" />
                      ) : loadError ? (
                        <StatePanel title="加载失败" body={loadError} tone="error" />
                      ) : (
                        <div className={`transition-all duration-300 ease-out ${detailTransitionActive ? 'scale-[0.995] opacity-85' : 'scale-100 opacity-100'}`}>
                          <UsageChartCard
                            rangeAnimationVersion={rangeAnimationVersion}
                            compactProgress={stickyProgress}
                            unit="count"
                            summaryItems={observedSummaryItems}
                            selectedPointKey={selectedChartPointKey}
                            onSelectPoint={handleChartPointSelect}
                            status={
                              <div className="flex items-center gap-3 text-[0.9375rem] font-black uppercase tracking-wider text-[var(--text-primary)]">
                                <div className="h-3 w-3 bg-[var(--text-primary)]" />
                                <span>数据源: Sidecar Usage</span>
                                <span className="opacity-40">/</span>
                                <span>{observedDrilldownDayKey || '全部'}</span>
                                {selectedChartPointKey && (
                                  <>
                                    <span className="opacity-40">/</span>
                                    <span>{selectedChartPointKey}</span>
                                  </>
                                )}
                              </div>
                            }
                            controls={
                              <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-[var(--shadow-color)] px-6 py-4 bg-[var(--bg-main)]">
                                {/* 左翼：时间维度 (带平滑切换动画) */}
                                <div className="relative flex items-center min-w-[300px] h-[36px]">
                                  <div 
                                    className={`flex items-center transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${viewScale === 'daily' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8 pointer-events-none absolute'}`}
                                  >
                                    <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                      {rangeOptions.map((option) => (
                                        <button
                                          key={option}
                                          onClick={() => handleRangeSelect(option)}
                                          className={`px-5 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                            range === option ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                          }`}
                                        >
                                          {option === 'TODAY' ? '今日' : option === '7D' ? '7天' : option === '14D' ? '14天' : option === '30D' ? '30天' : option}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div 
                                    className={`flex items-center transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${viewScale === 'minute' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none absolute'}`}
                                  >
                                    <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                      {resolutionOptions.map((opt) => (
                                        <button
                                          key={opt}
                                          onClick={() => setResolution(opt)}
                                          className={`px-5 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                            resolution === opt ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                          }`}
                                        >
                                          {opt === '1M' ? '1m' : opt === '5M' ? '5m' : opt === '15M' ? '15m' : opt === '30M' ? '30m' : '60m'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* 右翼：查看选项 */}
                                <div className="flex items-center gap-6 ml-auto">
                                  {/* 3. 查看维度开关 */}
                                  <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                    <button
                                      onClick={() => handleViewScaleChange('daily')}
                                      className={`px-4 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                        viewScale === 'daily' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      天级趋势
                                    </button>
                                    <button
                                      onClick={() => handleViewScaleChange('minute')}
                                      className={`px-4 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                        viewScale === 'minute' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      分钟明细
                                    </button>
                                  </div>
                                </div>
                              </div>
                            }
                            primary={
                              observedDrilldownDayKey
                                ? observedSnapshot.minutePoints.map((point) => ({
                                    label: point.label,
                                    value: point.success + point.failure,
                                    color: '#111111',
                                  }))
                                : visibleDailyPoints.map((point) => ({
                                    label: point.label,
                                    value: point.success,
                                    color: '#111111',
                                    drilldownDayKey: point.dayKey,
                                  }))
                            }
                            secondary={
                              observedDrilldownDayKey
                                ? undefined
                                : visibleDailyPoints.map((point) => ({ label: point.label, value: point.failure, color: '#7a7a7a' }))
                            }
                          />
                        </div>
                      )}
                      </div>

                      {!loading && !loadError && observedSnapshot.hasData ? (
                        <UsageDetailTable
                          rows={observedDrilldownDayKey ? observedSnapshot.minuteRows : observedDailyRows}
                          columns={activeDetailColumns}
                          selectedRowKey={selectedDetailRowKey}
                          onSelectRow={handleDetailRowSelect}
                        />
                      ) : null}

                    </div>
                </section>
              ) : (
                <section className="space-y-5">
                    <div className="space-y-5">
                      <div className="sticky top-0 z-20 -mx-12 bg-[var(--bg-surface)] px-12 pb-3 pt-3">
                      {projectedLoading ? (
                        <StatePanel title="加载中" body={projectedLoadingBody} />
                      ) : projectedLoadError ? (
                        <StatePanel title="加载失败" body={projectedLoadError} tone="error" />
                      ) : (
                        <div className={`transition-all duration-300 ease-out ${detailTransitionActive ? 'scale-[0.995] opacity-85' : 'scale-100 opacity-100'}`}>
                          <UsageChartCard
                            rangeAnimationVersion={rangeAnimationVersion}
                            compactProgress={stickyProgress}
                            unit={projectedChartUnit}
                            summaryItems={projectedSummaryItems}
                            selectedPointKey={selectedChartPointKey}
                            onSelectPoint={handleChartPointSelect}
                            status={
                              <>
                                <div className="flex items-center gap-6">
                                  <div className="flex items-center gap-3 text-[0.9375rem] font-black uppercase tracking-wider text-[var(--text-primary)]">
                                    <div className="h-3 w-3 bg-[var(--text-primary)]" />
                                    <span>本地投影索引</span>
                                    <span className="opacity-40">/</span>
                                    <span>{projectedDrilldownDayKey || '概览'}</span>
                                    {selectedChartPointKey && (
                                      <>
                                        <span className="opacity-40">/</span>
                                        <span>{selectedChartPointKey}</span>
                                      </>
                                    )}
                                  </div>
                                  {projectedActionMessage && (
                                    <div className="text-[0.8125rem] font-black uppercase text-[var(--text-primary)] px-2 bg-[var(--bg-surface)] border-2 border-[var(--border-color)]">
                                      {projectedActionMessage}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => void refreshProjectedUsage()} className="border-2 border-[var(--border-color)] px-4 py-1.5 text-[0.8125rem] font-black uppercase text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30" disabled={projectedLoading}>
                                    刷新索引
                                  </button>
                                  <button onClick={() => void rebuildProjectedUsage()} className="border-2 border-[var(--border-color)] px-4 py-1.5 text-[0.8125rem] font-black uppercase text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30" disabled={projectedLoading}>
                                    重建索引
                                  </button>
                                </div>
                              </>
                            }
                            controls={
                              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-[var(--shadow-color)] px-6 py-4 w-full bg-[var(--bg-main)]">
                                {/* 左翼：时间维度 (带平滑切换动画) */}
                                <div className="relative flex items-center min-w-[300px] h-[36px]">
                                  <div 
                                    className={`flex items-center transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${viewScale === 'daily' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8 pointer-events-none absolute'}`}
                                  >
                                    <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                      {rangeOptions.map((option) => (
                                        <button
                                          key={option}
                                          onClick={() => handleRangeSelect(option)}
                                          className={`px-5 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                            range === option ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                          }`}
                                        >
                                          {option === 'TODAY' ? '今日' : option === '7D' ? '7天' : option === '14D' ? '14天' : option === '30D' ? '30天' : option}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div 
                                    className={`flex items-center transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${viewScale === 'minute' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none absolute'}`}
                                  >
                                    <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                      {resolutionOptions.map((opt) => (
                                        <button
                                          key={opt}
                                          onClick={() => setResolution(opt)}
                                          className={`px-5 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                            resolution === opt ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                          }`}
                                        >
                                          {opt === '1M' ? '1m' : opt === '5M' ? '5m' : opt === '15M' ? '15m' : opt === '30M' ? '30m' : '60m'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* 右翼：查看选项 */}
                                <div className="flex items-center gap-6 ml-auto">
                                  {/* 3. 查看维度开关 */}
                                  <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                    <button
                                      onClick={() => handleViewScaleChange('daily')}
                                      className={`px-4 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                        viewScale === 'daily' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      天级趋势
                                    </button>
                                    <button
                                      onClick={() => handleViewScaleChange('minute')}
                                      className={`px-4 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                        viewScale === 'minute' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      分钟明细
                                    </button>
                                  </div>

                                  {/* 4. 度量指标 */}
                                  <div className="flex items-center border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                    <button
                                      onClick={() => setProjectedChartMetric('tokens')}
                                      className={`px-4 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                        projectedChartMetric === 'tokens' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      Tokens
                                    </button>
                                    <button
                                      onClick={() => setProjectedChartMetric('requests')}
                                      className={`px-4 py-1.5 text-[0.6875rem] font-black uppercase transition-colors ${
                                        projectedChartMetric === 'requests' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      请求数
                                    </button>
                                  </div>
                                </div>
                              </div>
                            }
                            primary={projectedPrimaryChartPoints}
                          />
                        </div>
                      )}
                      </div>

                      {!projectedLoading && !projectedLoadError && projectedSnapshot.hasData ? (
                        <UsageDetailTable
                          rows={projectedDrilldownDayKey ? projectedSnapshot.minuteRows : projectedDailyRows}
                          columns={activeDetailColumns}
                          selectedRowKey={selectedDetailRowKey}
                          onSelectRow={handleDetailRowSelect}
                        />
                      ) : null}

                  </div>
                </section>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function applyRange<T extends UsageDeskDailyPoint | UsageDeskProjectedDailyPoint>(points: T[], range: UsageDeskRangeOption) {
  if (range === '全部') return points;
  const limit = range === '7D' ? 7 : range === '14D' ? 14 : range === '30D' ? 30 : 7;
  return points.slice(-limit);
}

function StatePanel({ title, body, tone = 'default' }: { title: string; body: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div
      className={`border-2 px-4 py-4 ${
        tone === 'error'
          ? 'border-red-500 bg-red-500/10 text-red-500'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
      }`}
    >
      <div className="text-[0.625rem] font-black uppercase tracking-[0.18em]">{title}</div>
      <div className={`mt-2 text-[0.6875rem] leading-6 ${tone === 'error' ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>{body}</div>
    </div>
  );
}

function UsageChartCard({
  rangeAnimationVersion = 0,
  compactProgress = 0,
  unit,
  summaryItems,
  controls,
  primary,
  secondary,
  selectedPointKey,
  onSelectPoint,
  status,
  footerExtra,
}: {
  rangeAnimationVersion?: number;
  compactProgress?: number;
  unit: UsageDeskChartUnit;
  summaryItems: string[];
  controls?: ReactNode;
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
  status?: ReactNode;
  footerExtra?: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
      {status || controls ? (
        <div className="flex flex-col border-b-2 border-[var(--border-color)]">
          {status && (
            <div className="flex items-center justify-between bg-[var(--bg-surface)] px-4 py-2 border-b-2 border-[var(--border-color)]">
               {status}
            </div>
          )}
          {controls && (
             <div className="flex w-full items-center bg-[var(--bg-main)]">
                {controls}
             </div>
          )}
        </div>
      ) : null}

      <div className="relative">
        <ChartSurface
          primary={primary}
          secondary={secondary}
          unit={unit}
          summaryItems={[]} // 不再在 ChartSurface 内部渲染 summaryItems
          compactProgress={compactProgress}
          selectedPointKey={selectedPointKey}
          onSelectPoint={onSelectPoint}
          rangeAnimationVersion={rangeAnimationVersion}
        />
        {/* 凹陷感内阴影叠加层 */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_12px_16px_-8px_rgba(0,0,0,0.1),inset_0_-12px_16px_-8px_rgba(0,0,0,0.1)]" />
      </div>

      {(summaryItems.length > 0 || footerExtra) && (
        <footer className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
          {summaryItems.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-1">
               <span className="text-[0.6875rem] font-black uppercase tracking-tight text-[var(--text-primary)]">{item}</span>
            </div>
          ))}
          {footerExtra && <div className="ml-auto">{footerExtra}</div>}
        </footer>
      )}
    </div>
  );
}

function EmptyChartPlaceholder({
  compactProgress = 0,
  title,
  body,
}: {
  compactProgress?: number;
  title: string;
  body: string;
}) {
  const progress = Math.max(0, Math.min(compactProgress, 1));
  const chartHeight = 268 - 44 * progress;

  return (
    <div
      className="relative overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
      style={{
        height: `${chartHeight}px`,
        backgroundImage:
          'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgba(0,0,0,0.2) calc(25% - 1px), rgba(0,0,0,0.2) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), rgba(0,0,0,0.2) calc(50% - 1px), rgba(0,0,0,0.2) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), rgba(0,0,0,0.2) calc(75% - 1px), rgba(0,0,0,0.2) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, rgba(0,0,0,0.12) 55px, rgba(0,0,0,0.12) 56px)',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.88))] px-6 text-center">
        <div className="text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">{title}</div>
        <p className="max-w-md text-[0.6875rem] font-bold leading-6 text-[var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}

function ChartSurface({
  primary,
  secondary,
  unit,
  summaryItems,
  controls,
  compactProgress = 0,
  selectedPointKey,
  onSelectPoint,
  rangeAnimationVersion = 0,
}: {
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  unit: UsageDeskChartUnit;
  summaryItems: string[];
  controls?: ReactNode;
  compactProgress?: number;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
  rangeAnimationVersion?: number;
}) {
  const progress = Math.max(0, Math.min(compactProgress, 1));
  const chartHeight = 280;
  const chartTopInset = 42;
  const chartBottomInset = 48;
  const chartInnerHeight = chartHeight - chartTopInset - chartBottomInset;
  const chartBaseY = chartTopInset + chartInnerHeight;
  const labelBaseY = chartHeight - 12;
  const pointCount = Math.max(primary.length, secondary?.length ?? 0, 1);
  const chartWidth = Math.max(420, pointCount * (pointCount <= 14 ? 72 : 78));
  const allValues = [...primary, ...(secondary ?? [])].map((point) => point.value);
  const maxValue = Math.max(...allValues, 1);
  const primaryTone = '#111111';
  const primaryAreaTone = '#2f2f2f';
  const secondaryTone = '#7a7a7a';
  const secondaryAreaTone = '#9a9a9a';

  const buildChartCoords = (points: Array<{ value: number }>) =>
    points.map((point, index) => ({
      x: points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth,
      y: chartBaseY - (point.value / maxValue) * chartInnerHeight,
    }));

  const buildSmoothLinePath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M${points[0].x},${points[0].y}`;
    }
    const commands = [`M${points[0].x},${points[0].y}`];
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const previous = points[index - 1] ?? current;
      const afterNext = points[index + 2] ?? next;
      const control1X = current.x + (next.x - previous.x) / 6;
      const control1Y = current.y + (next.y - previous.y) / 6;
      const control2X = next.x - (afterNext.x - current.x) / 6;
      const control2Y = next.y - (afterNext.y - current.y) / 6;
      commands.push(`C${control1X},${control1Y} ${control2X},${control2Y} ${next.x},${next.y}`);
    }
    return commands.join(' ');
  };

  const buildSmoothAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M${points[0].x},${chartBaseY} L${points[0].x},${points[0].y} L${points[0].x},${chartBaseY} Z`;
    }
    return `${buildSmoothLinePath(points)} L${points[points.length - 1].x},${chartBaseY} L${points[0].x},${chartBaseY} Z`;
  };

  const primaryCoords = buildChartCoords(primary);
  const secondaryCoords = buildChartCoords(secondary ?? []);
  const requestSummaryItems = summaryItems.filter(
    (item) => !/^Token\b/.test(item) && !/^(输入|缓存|输出)\b/.test(item),
  );
  const tokenSummaryItems = summaryItems.filter(
    (item) => /^Token\b/.test(item) || /^(输入|缓存|输出)\b/.test(item),
  );
  const selectedPrimaryIndex = primary.findIndex((point) => point.label === selectedPointKey);
  const selectedPrimaryX =
    selectedPrimaryIndex >= 0 && primaryCoords[selectedPrimaryIndex] ? primaryCoords[selectedPrimaryIndex].x : null;
  const chartScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chartScrollRef.current;
    if (!container || selectedPrimaryX === null) {
      return;
    }

    const viewportStart = container.scrollLeft;
    const viewportWidth = container.clientWidth;
    const viewportEnd = viewportStart + viewportWidth;
    const safeMargin = Math.min(120, viewportWidth * 0.2);
    const pointStart = selectedPrimaryX - safeMargin;
    const pointEnd = selectedPrimaryX + safeMargin;

    if (pointStart >= viewportStart && pointEnd <= viewportEnd) {
      return;
    }

    const targetScrollLeft = Math.max(
      0,
      Math.min(selectedPrimaryX - viewportWidth / 2, container.scrollWidth - viewportWidth),
    );
    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  }, [selectedPrimaryX]);

  return (
    <div ref={chartScrollRef} className="overflow-x-auto overflow-y-hidden bg-[var(--bg-main)]">
        <div
          className="relative mx-auto transition-all duration-300 ease-out"
          style={{
            height: `${chartHeight}px`,
            width: `${chartWidth}px`,
            backgroundImage:
              'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgba(0,0,0,0.12) calc(25% - 1px), rgba(0,0,0,0.12) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), rgba(0,0,0,0.12) calc(50% - 1px), rgba(0,0,0,0.12) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), rgba(0,0,0,0.12) calc(75% - 1px), rgba(0,0,0,0.12) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, rgba(0,0,0,0.08) 55px, rgba(0,0,0,0.08) 56px)',
          }}
        >
          <style>{`
            @keyframes usage-desk-curve-sweep {
              0% { stroke-dashoffset: 1; opacity: 0.32; }
              100% { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes usage-desk-area-fade {
              0% { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes usage-desk-point-rise {
              0% { opacity: 0; transform: translate(-50%, calc(-50% + 8px)) scale(0.86); }
              100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
          `}</style>
          {/* 背景与曲线层 */}
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="usage-primary-area-live" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryAreaTone} stopOpacity="0.24" />
                <stop offset="100%" stopColor={primaryAreaTone} stopOpacity="0.03" />
              </linearGradient>
              {secondary?.length ? (
                <linearGradient id="usage-secondary-area-live" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={secondaryAreaTone} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={secondaryAreaTone} stopOpacity="0.02" />
                </linearGradient>
              ) : null}
            </defs>
            <path
              key={`primary-area-${rangeAnimationVersion}-${primary.length}`}
              d={buildSmoothAreaPath(primaryCoords)}
              fill="url(#usage-primary-area-live)"
              style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', animation: 'usage-desk-area-fade 320ms cubic-bezier(0.22,1,0.36,1)' }}
            />
            {secondary?.length ? (
              <path
                key={`secondary-area-${rangeAnimationVersion}-${secondary.length}`}
                d={buildSmoothAreaPath(secondaryCoords)}
                fill="url(#usage-secondary-area-live)"
                style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', animation: 'usage-desk-area-fade 320ms cubic-bezier(0.22,1,0.36,1)' }}
              />
            ) : null}
            {selectedPrimaryX !== null ? (
              <line
                x1={selectedPrimaryX}
                y1={12}
                x2={selectedPrimaryX}
                y2={chartHeight - 8}
                stroke="#111111"
                strokeOpacity="0.35"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
            ) : null}
            <path
              key={`primary-line-${rangeAnimationVersion}-${primary.length}`}
              d={buildSmoothLinePath(primaryCoords)}
              fill="none"
              stroke={primaryTone}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={0}
              style={{ animation: 'usage-desk-curve-sweep 420ms cubic-bezier(0.22,1,0.36,1)' }}
            />
            {secondary?.length ? (
              <path
                key={`secondary-line-${rangeAnimationVersion}-${secondary.length}`}
                d={buildSmoothLinePath(secondaryCoords)}
                fill="none"
                stroke={secondaryTone}
                strokeWidth="3"
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDashoffset={0}
                style={{ animation: 'usage-desk-curve-sweep 420ms cubic-bezier(0.22,1,0.36,1)' }}
              />
            ) : null}
          </svg>

          {/* HTML 点位与标签层 (防止缩放变形) */}
          <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
            <div className="relative h-full w-full pointer-events-auto">
              {primary.map((point, index) => {
                const x = primary.length <= 1 ? 0 : (index / (primary.length - 1)) * chartWidth;
                const y = chartBaseY - (point.value / maxValue) * chartInnerHeight;
                return (
                  <ChartPoint
                    key={`primary-${rangeAnimationVersion}-${point.label}`}
                    x={x}
                    y={y}
                    label={formatUsageDeskChartValue(point.value, unit)}
                    color={primaryTone}
                    helper={point.label}
                    helperY={labelBaseY}
                    selected={selectedPointKey === point.label}
                    onSelect={() => onSelectPoint(point.label, point.drilldownDayKey)}
                    animate
                  />
                );
              })}
              {secondary?.map((point, index) => {
                const x = secondary.length <= 1 ? 0 : (index / (secondary.length - 1)) * chartWidth;
                const y = chartBaseY - (point.value / maxValue) * chartInnerHeight;
                return (
                  <ChartPoint
                    key={`secondary-${rangeAnimationVersion}-${point.label}`}
                    x={x}
                    y={y}
                    label={formatUsageDeskChartValue(point.value, unit)}
                    color={secondaryTone}
                    helper={point.label}
                    helperY={labelBaseY}
                    labelPosition="bottom"
                    small
                    selected={selectedPointKey === point.label}
                    animate
                  />
                );
              })}
            </div>
          </div>
        </div>
    </div>
  );
}

function ChartPoint({
  x,
  y,
  label,
  color,
  helper,
  helperY = 258,
  labelPosition = 'top',
  small = false,
  selected = false,
  onSelect,
  animate = false,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  helper: string;
  helperY?: number;
  labelPosition?: 'top' | 'bottom';
  small?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  animate?: boolean;
}) {
  return (
    <div
      style={
        animate
          ? {
              ...buildUsageDeskChartPointStyle(x, y),
              animation: 'usage-desk-point-rise 360ms cubic-bezier(0.22,1,0.36,1)',
            }
          : buildUsageDeskChartPointStyle(x, y)
      }
      className={`absolute flex items-center justify-center ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      {/* 1. 数值标签 (不占用空间) */}
      <div 
        className={`absolute whitespace-nowrap text-center transition-all pointer-events-none ${labelPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'}`}
        style={{ color, fontSize: selected ? '12px' : '11px', fontWeight: selected ? 900 : 800 }}
      >
        {label}
      </div>

      {/* 2. 中心圆点 */}
      <div className="relative flex items-center justify-center">
        {selected && (
          <div className="absolute h-8 w-8 rounded-full bg-[var(--text-primary)] opacity-10 animate-pulse" />
        )}
        <div 
          className={`rounded-full border-2 border-white shadow-sm transition-transform ${selected ? (small ? 'h-3 w-3' : 'h-3.5 w-3.5 scale-110') : (small ? 'h-2 w-2' : 'h-2.5 w-2.5')}`}
          style={{ backgroundColor: color }}
        />
      </div>

      {/* 3. 辅助轴向标签 (日期/时间) - 绝对定位到 chart 底部 */}
      <div 
        className="absolute whitespace-nowrap font-black transition-all -translate-x-1/2 pointer-events-none"
        style={{ 
          top: `${helperY - y}px`, 
          fontSize: '10px', 
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          opacity: selected ? 1 : 0.6
        }}
      >
        {helper}
      </div>
    </div>
  );
}

function buildUsageDetailRowKey(row: UsageDetailTableRow) {
  return [
    row.timeLabel,
    row.value,
    row.note ?? '',
    row.model ?? '',
    row.requests ?? '',
    row.inputTokens ?? '',
    row.cachedInputTokens ?? '',
    row.outputTokens ?? '',
  ].join('|');
}

function resolveUsageDetailColumns(rows: UsageDetailTableRow[]): UsageDetailColumn[] {
  const hasProjectedBreakdown = rows.some(
    (row) =>
      row.requests !== undefined ||
      row.inputTokens !== undefined ||
      row.cachedInputTokens !== undefined ||
      row.outputTokens !== undefined,
  );

  return hasProjectedBreakdown
    ? [
        { key: 'timeLabel', header: '时间' },
        { key: 'model', header: '模型' },
        { key: 'requests', header: '请求数' },
        { key: 'value', header: 'Token' },
        { key: 'inputTokens', header: '输入' },
        { key: 'cachedInputTokens', header: '缓存' },
        { key: 'outputTokens', header: '输出' },
      ]
    : [
        { key: 'timeLabel', header: '时间' },
        { key: 'value', header: '数值' },
        { key: 'note', header: '备注' },
      ];
}

function UsageDetailTable({
  rows,
  columns,
  selectedRowKey,
  onSelectRow,
}: {
  rows: UsageDetailTableRow[];
  columns: UsageDetailColumn[];
  selectedRowKey: string;
  onSelectRow: (rowKey: string, chartPointKey: string, drilldownDayKey?: string) => void;
}) {
  return (
    <div className="overflow-x-auto overflow-y-visible border-2 border-[var(--border-color)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[var(--bg-surface)]">
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b-2 border-[var(--border-color)] px-3 py-3 text-left text-[0.625rem] font-black tracking-[0.12em] text-[var(--text-primary)]"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <UsageDetailRow
              key={`${row.timeLabel}-${row.provider}-${index}`}
              row={row}
              columns={columns}
              selected={buildUsageDetailRowKey(row) === selectedRowKey}
              onSelect={() =>
                onSelectRow(
                  buildUsageDetailRowKey(row),
                  resolveUsageDeskChartSelectionKey(row),
                  'drilldownDayKey' in row ? row.drilldownDayKey : undefined,
                )
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsageDetailRow({
  row,
  columns,
  selected,
  onSelect,
}: {
  row: UsageDetailTableRow;
  columns: UsageDetailColumn[];
  selected: boolean;
  onSelect: () => void;
}) {
  const cells = columns.map((column) => row[column.key] ?? '--');

  return (
    <tr
      onClick={onSelect}
      className={`border-t border-dashed border-[var(--border-color)] first:border-t-0 cursor-pointer transition-colors ${
        selected ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'hover:bg-[var(--bg-main)]/60'
      }`}
    >
      {cells.map((cell, index) => (
        <td
          key={`${row.timeLabel}-${index}`}
          className={`px-3 py-3 text-[0.6875rem] font-bold leading-6 ${selected ? 'text-[var(--bg-main)]' : 'text-[var(--text-primary)]'}`}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}

function InfoCard({ title, highlight, body }: { title: string; highlight: string; body: string }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-4 shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-3 text-[1.375rem] font-black uppercase italic tracking-tight text-[var(--text-primary)]">{highlight}</div>
      <p className="mt-3 text-[0.6875rem] leading-6 text-[var(--text-muted)]">{body}</p>
    </div>
  );
}
