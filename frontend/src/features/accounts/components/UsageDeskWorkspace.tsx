import { useEffect, useMemo, useRef, useState } from 'react';
import { GetCodexLocalUsage, GetUsageStatistics, RebuildCodexLocalUsage } from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/DebugContext';
import type { SidecarStatus, UsageDeskWorkspace as UsageDeskWorkspaceID } from '../../../types';
import {
  persistUsageDeskRange,
  persistUsageDeskSource,
  readStoredUsageDeskRange,
  readStoredUsageDeskSource,
} from '../../../utils/pagePersistence';
import {
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

const rangeOptions: UsageDeskRangeOption[] = ['TODAY', '7D', '14D', '30D', '全部'];

type UsageDetailTableRow = UsageDeskMinuteRow & {
  drilldownDayKey?: string;
};

type UsageDetailColumnKey = 'timeLabel' | 'value' | 'note' | 'requests' | 'inputTokens' | 'cachedInputTokens' | 'outputTokens';
type UsageDetailColumn = { key: UsageDetailColumnKey; header: string };

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
  const [range, setRange] = useState<UsageDeskRangeOption>(() =>
    readStoredUsageDeskRange(typeof window === 'undefined' ? null : window.localStorage),
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [observedUsageData, setObservedUsageData] = useState<unknown>(null);
  const [projectedUsageData, setProjectedUsageData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [projectedLoading, setProjectedLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [projectedLoadError, setProjectedLoadError] = useState('');
  const [projectedActionMessage, setProjectedActionMessage] = useState('');
  const [selectedDetailRowKey, setSelectedDetailRowKey] = useState('');
  const [selectedChartPointKey, setSelectedChartPointKey] = useState('');
  const [detailTransitionActive, setDetailTransitionActive] = useState(false);
  const [stickyProgress, setStickyProgress] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    persistUsageDeskSource(typeof window === 'undefined' ? null : window.localStorage, source);
  }, [source]);

  useEffect(() => {
    persistUsageDeskRange(typeof window === 'undefined' ? null : window.localStorage, range);
  }, [range]);

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
      if (mode !== 'initial') {
        setProjectedActionMessage(mode === 'refresh' ? '正在刷新索引…' : '');
      }
      try {
        const response = await trackRequest<any>('GetCodexLocalUsage', { args: [] }, () => GetCodexLocalUsage());
        if (!mounted) return;
        setProjectedUsageData(response ?? null);
        if (mode === 'refresh') {
          setProjectedActionMessage('索引已刷新');
        }
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setProjectedUsageData(null);
        setProjectedLoadError('本地投影用量暂时不可用');
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
    setProjectedActionMessage('正在刷新索引…');
    try {
      const response = await trackRequest<any>('GetCodexLocalUsage', { args: [] }, () => GetCodexLocalUsage());
      setProjectedUsageData(response ?? null);
      setProjectedActionMessage('索引已刷新');
    } catch (error) {
      console.error(error);
      setProjectedLoadError('本地投影用量暂时不可用');
      setProjectedActionMessage('');
    } finally {
      setProjectedLoading(false);
    }
  }

  async function rebuildProjectedUsage() {
    setProjectedLoading(true);
    setProjectedLoadError('');
    setProjectedActionMessage('正在重建索引…');
    try {
      const response = await trackRequest<any>('RebuildCodexLocalUsage', { args: [] }, () => RebuildCodexLocalUsage());
      setProjectedUsageData(response ?? null);
      setProjectedActionMessage('索引已重建');
    } catch (error) {
      console.error(error);
      setProjectedLoadError('本地投影用量重建失败');
      setProjectedActionMessage('');
    } finally {
      setProjectedLoading(false);
    }
  }

  const observedSnapshot = useMemo(
    () => buildUsageDeskObservedSnapshot(observedUsageData, selectedDayKey),
    [observedUsageData, selectedDayKey],
  );
  const projectedSnapshot = useMemo(
    () => buildUsageDeskProjectedSnapshot(projectedUsageData, selectedDayKey),
    [projectedUsageData, selectedDayKey],
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
  const observedDrilldownDayKey =
    selectedDayKey && visibleDailyPoints.some((point) => point.dayKey === selectedDayKey) ? selectedDayKey : null;
  const activeProjectedDayKey = visibleProjectedDailyPoints[visibleProjectedDailyPoints.length - 1]?.dayKey ?? projectedSnapshot.selectedDayKey;
  const projectedDrilldownDayKey =
    selectedDayKey && visibleProjectedDailyPoints.some((point) => point.dayKey === selectedDayKey) ? selectedDayKey : null;
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

  function handleDetailRowSelect(rowKey: string, chartPointKey: string, drilldownDayKey?: string) {
    setSelectedDetailRowKey(rowKey);
    setSelectedChartPointKey(chartPointKey);
    if (drilldownDayKey) {
      setDetailTransitionActive(true);
      setSelectedDayKey(drilldownDayKey);
    }
  }

  function handleChartPointSelect(chartSelectionKey: string, drilldownDayKey?: string) {
    setSelectedChartPointKey(chartSelectionKey);
    const nextRowKey = resolveUsageDeskLinkedRowKey(activeDetailRows, chartSelectionKey);
    if (nextRowKey) {
      setSelectedDetailRowKey(nextRowKey);
    }
    if (drilldownDayKey) {
      setDetailTransitionActive(true);
      setSelectedDayKey(drilldownDayKey);
    }
  }

  function handleRangeSelect(option: UsageDeskRangeOption) {
    setRange(option);
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
        <header className="flex items-end justify-between gap-6 border-b-4 border-[var(--border-color)] pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {pageTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {pageDescription}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
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
          </div>
        </header>

        <div className="space-y-6">
          {workspace === 'gemini' ? (
              <section className="card-swiss !p-5">
                <div className="flex flex-col gap-4 border-b-2 border-dashed border-[var(--border-color)] pb-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">模块 01</div>
                    <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tight text-[var(--text-primary)]">gemini 用量分析</h3>
                  </div>
                  <p className="max-w-2xl text-[11px] leading-6 text-[var(--text-muted)]">
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
                      <div className="sticky top-0 z-20 -mx-12 space-y-3 bg-[var(--bg-surface)] px-12 pb-3 pt-3">
                      <div data-usage-sticky-controls className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {rangeOptions.map((option) => (
                            <button
                              key={option}
                              onClick={() => handleRangeSelect(option)}
                              className={`btn-swiss ${shouldHighlightRangeSelection && range === option ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
                            >
                              {option === 'TODAY' ? '今日' : option === '7D' ? '7天' : option === '14D' ? '14天' : option === '30D' ? '30天' : option}
                            </button>
                          ))}
                        </div>
                      </div>

                      {loading ? (
                        <StatePanel title="加载中" body="正在拉取 sidecar /usage 真实请求样本。" />
                      ) : loadError ? (
                        <StatePanel title="加载失败" body={loadError} tone="error" />
                      ) : !observedSnapshot.hasData ? (
                        <EmptyChartPlaceholder
                          compactProgress={stickyProgress}
                          title="暂无真实请求量"
                          body="当前 sidecar /usage 还没有可用于图表的真实请求明细。"
                        />
                      ) : (
                        <div className={`transition-all duration-300 ease-out ${detailTransitionActive ? 'scale-[0.995] opacity-85' : 'scale-100 opacity-100'}`}>
                          <UsageChartCard
                            compactProgress={stickyProgress}
                            unit="count"
                            summaryItems={observedSummaryItems}
                            selectedPointKey={selectedChartPointKey}
                            onSelectPoint={handleChartPointSelect}
                            primary={
                              observedDrilldownDayKey
                                ? observedSnapshot.minutePoints.map((point) => ({
                                    label: point.label,
                                    value: point.success + point.failure,
                                    color: '#0d9f4f',
                                  }))
                                : visibleDailyPoints.map((point) => ({
                                    label: point.label,
                                    value: point.success,
                                    color: '#0d9f4f',
                                    drilldownDayKey: point.dayKey,
                                  }))
                            }
                            secondary={
                              observedDrilldownDayKey
                                ? undefined
                                : visibleDailyPoints.map((point) => ({ label: point.label, value: point.failure, color: '#ff0000' }))
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
                      {projectedActionMessage ? <StatePanel title="索引动作" body={projectedActionMessage} /> : null}
                      <div className="sticky top-0 z-20 -mx-12 space-y-3 bg-[var(--bg-surface)] px-12 pb-3 pt-3">
                      <div data-usage-sticky-controls className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {rangeOptions.map((option) => (
                            <button
                              key={option}
                              onClick={() => handleRangeSelect(option)}
                              className={`btn-swiss ${shouldHighlightRangeSelection && range === option ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
                            >
                              {option === 'TODAY' ? '今日' : option === '7D' ? '7天' : option === '14D' ? '14天' : option === '30D' ? '30天' : option}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button onClick={() => void refreshProjectedUsage()} className="btn-swiss" disabled={projectedLoading}>
                            刷新索引
                          </button>
                          <button onClick={() => void rebuildProjectedUsage()} className="btn-swiss" disabled={projectedLoading}>
                            重建索引
                          </button>
                        </div>
                      </div>

                      {projectedLoading ? (
                        <StatePanel title="加载中" body="正在扫描 ~/.codex/sessions 本地 rollout 样本。" />
                      ) : projectedLoadError ? (
                        <StatePanel title="加载失败" body={projectedLoadError} tone="error" />
                      ) : !projectedSnapshot.hasData ? (
                        <EmptyChartPlaceholder
                          compactProgress={stickyProgress}
                          title="暂无本地投影用量"
                          body="当前本机还没有可用于图表的 Codex 本地投影样本。"
                        />
                      ) : (
                        <div className={`transition-all duration-300 ease-out ${detailTransitionActive ? 'scale-[0.995] opacity-85' : 'scale-100 opacity-100'}`}>
                          <UsageChartCard
                            compactProgress={stickyProgress}
                            unit="tokens"
                            summaryItems={projectedSummaryItems}
                            selectedPointKey={selectedChartPointKey}
                            onSelectPoint={handleChartPointSelect}
                            primary={
                              projectedDrilldownDayKey
                                ? projectedSnapshot.minutePoints.map((point) => ({
                                    label: point.label,
                                    value: point.totalTokens,
                                    color: '#1f6feb',
                                  }))
                                : visibleProjectedDailyPoints.map((point) => ({
                                    label: point.label,
                                    value: point.totalTokens,
                                    color: '#1f6feb',
                                    drilldownDayKey: point.dayKey,
                                  }))
                            }
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
  const limit = range === 'TODAY' ? 1 : range === '7D' ? 7 : range === '14D' ? 14 : 30;
  return points.slice(-limit);
}

function StatePanel({ title, body, tone = 'default' }: { title: string; body: string; tone?: 'default' | 'error' }) {
  return (
    <div
      className={`border-2 px-4 py-4 ${
        tone === 'error'
          ? 'border-red-500 bg-red-500/10 text-red-500'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
      }`}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.18em]">{title}</div>
      <p className={`mt-2 text-[11px] leading-6 ${tone === 'error' ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>{body}</p>
    </div>
  );
}

function UsageChartCard({
  compactProgress = 0,
  unit,
  summaryItems,
  primary,
  secondary,
  selectedPointKey,
  onSelectPoint,
}: {
  compactProgress?: number;
  unit: UsageDeskChartUnit;
  summaryItems: string[];
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
}) {
  return (
    <ChartSurface
      primary={primary}
      secondary={secondary}
      unit={unit}
      summaryItems={summaryItems}
      compactProgress={compactProgress}
      selectedPointKey={selectedPointKey}
      onSelectPoint={onSelectPoint}
    />
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
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">{title}</div>
        <p className="max-w-md text-[11px] font-bold leading-6 text-[var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}

function ChartSurface({
  primary,
  secondary,
  unit,
  summaryItems,
  compactProgress = 0,
  selectedPointKey,
  onSelectPoint,
}: {
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  unit: UsageDeskChartUnit;
  summaryItems: string[];
  compactProgress?: number;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
}) {
  const progress = Math.max(0, Math.min(compactProgress, 1));
  const chartHeight = 232;
  const chartTopInset = 24;
  const chartBottomInset = 34;
  const chartInnerHeight = chartHeight - chartTopInset - chartBottomInset;
  const chartBaseY = chartTopInset + chartInnerHeight;
  const labelBaseY = chartHeight - 10;
  const pointCount = Math.max(primary.length, secondary?.length ?? 0, 1);
  const chartWidth = Math.max(760, pointCount * 78);
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
    <div ref={chartScrollRef} className="overflow-x-auto overflow-y-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
        <div
          className="relative min-w-full transition-all duration-300 ease-out"
          style={{
            height: `${chartHeight}px`,
            width: `${chartWidth}px`,
            backgroundImage:
              'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgba(0,0,0,0.2) calc(25% - 1px), rgba(0,0,0,0.2) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), rgba(0,0,0,0.2) calc(50% - 1px), rgba(0,0,0,0.2) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), rgba(0,0,0,0.2) calc(75% - 1px), rgba(0,0,0,0.2) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, rgba(0,0,0,0.12) 55px, rgba(0,0,0,0.12) 56px)',
          }}
        >
          {summaryItems.length > 0 ? (
            <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-x-4 gap-y-1 bg-[rgba(255,255,255,0.78)] px-3 py-2 text-[10px] font-black tracking-[0.08em] text-[var(--text-primary)] backdrop-blur-[2px]">
              {summaryItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
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
        <path d={buildSmoothAreaPath(primaryCoords)} fill="url(#usage-primary-area-live)" />
        {secondary?.length ? <path d={buildSmoothAreaPath(secondaryCoords)} fill="url(#usage-secondary-area-live)" /> : null}
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
        <path d={buildSmoothLinePath(primaryCoords)} fill="none" stroke={primaryTone} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {secondary?.length ? (
          <path
            d={buildSmoothLinePath(secondaryCoords)}
            fill="none"
            stroke={secondaryTone}
            strokeWidth="3"
            strokeDasharray="10 8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {primary.map((point, index) => {
          const x = primary.length <= 1 ? 0 : (index / (primary.length - 1)) * chartWidth;
          const y = chartBaseY - (point.value / maxValue) * chartInnerHeight;
          return (
            <ChartPoint
              key={`primary-${point.label}`}
              x={x}
              y={y}
              label={formatUsageDeskChartValue(point.value, unit)}
              color={primaryTone}
              helper={point.label}
              helperY={labelBaseY}
              selected={selectedPointKey === point.label}
              onSelect={() => onSelectPoint(point.label, point.drilldownDayKey)}
            />
          );
        })}
        {secondary?.map((point, index) => {
          const x = secondary.length <= 1 ? 0 : (index / (secondary.length - 1)) * chartWidth;
          const y = chartBaseY - (point.value / maxValue) * chartInnerHeight;
          return (
            <ChartPoint
              key={`secondary-${point.label}`}
              x={x}
              y={y}
              label={formatUsageDeskChartValue(point.value, unit)}
              color={secondaryTone}
              helper={point.label}
              helperY={labelBaseY}
              labelPosition="bottom"
              small
              selected={selectedPointKey === point.label}
            />
          );
        })}
          </svg>
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
}) {
  return (
    <g
      className={onSelect ? 'cursor-pointer' : undefined}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {selected ? <circle cx={x} cy={y} r={small ? 9 : 10} fill="rgba(17,17,17,0.12)" /> : null}
      <circle cx={x} cy={y} r={selected ? (small ? 5.5 : 6.5) : small ? 4.5 : 5} fill={color} stroke="white" strokeWidth={selected ? '3' : '2'} />
      <text
        x={x}
        y={labelPosition === 'top' ? y - 14 : y + 20}
        textAnchor="middle"
        fill={color}
        style={{ fontSize: selected ? 12 : 11, fontWeight: selected ? 900 : 800, letterSpacing: '0.02em' }}
      >
        {label}
      </text>
      <text x={x} y={helperY} textAnchor="middle" fill={selected ? '#111111' : '#666666'} style={{ fontSize: 10, fontWeight: selected ? 900 : 800 }}>
        {helper}
      </text>
    </g>
  );
}

function buildUsageDetailRowKey(row: UsageDetailTableRow) {
  return [
    row.timeLabel,
    row.value,
    row.note ?? '',
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
                className="border-b-2 border-[var(--border-color)] px-3 py-3 text-left text-[10px] font-black tracking-[0.12em] text-[var(--text-primary)]"
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
          className={`px-3 py-3 text-[11px] font-bold leading-6 ${selected ? 'text-[var(--bg-main)]' : 'text-[var(--text-primary)]'}`}
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
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-3 text-[22px] font-black uppercase italic tracking-tight text-[var(--text-primary)]">{highlight}</div>
      <p className="mt-3 text-[11px] leading-6 text-[var(--text-muted)]">{body}</p>
    </div>
  );
}
