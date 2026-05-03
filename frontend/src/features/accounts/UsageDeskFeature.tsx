import { useMemo, type ReactNode } from 'react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import type { SidecarStatus, UsageDeskWorkspace as UsageDeskWorkspaceID } from '../../types';
import {
  rangeOptions,
  resolutionOptions,
  useUsageDeskFeature,
} from './hooks/useUsageDeskFeature';
import { UsageChartCard } from './components/usage-desk/UsageDeskChart';
import { UsageDetailTable } from './components/usage-desk/UsageDetailTable';
import { InfoCard, StatePanel } from './components/usage-desk/UsageDeskPanels';

export default function UsageDeskFeature({
  sidecarStatus,
  workspace,
}: {
  sidecarStatus: SidecarStatus;
  workspace: UsageDeskWorkspaceID;
}) {
  const {
    source,
    setSource,
    range,
    viewScale,
    resolution,
    setResolution,
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
  } = useUsageDeskFeature(sidecarStatus, workspace);

  const pageTitle = workspace === 'gemini' ? 'Gemini Usage Desk' : 'Codex Usage Desk';
  const pageDescription =
    workspace === 'gemini'
      ? 'Gemini 子页保留独立页面边界，后续接入自己的 usage 真源、图表和明细表。'
      : '当前已经接入 ObservedRequestUsage 与 LocalProjectedUsage 两条真实数据链路，并在同一页内承接按日与分钟级切换。';

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
                                <div className="relative flex items-center min-w-[300px] h-[36px]">
                                  <div
                                    className={`flex items-center transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${viewScale === 'daily' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8 pointer-events-none absolute'}`}
                                  >
                                    <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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
                                    <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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

                                <div className="flex items-center gap-6 ml-auto">
                                  <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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
                                : observedSnapshot.dailyPoints.map((point) => ({
                                    label: point.label,
                                    value: point.success,
                                    color: '#111111',
                                    drilldownDayKey: point.dayKey,
                                  }))
                            }
                            secondary={
                              observedDrilldownDayKey
                                ? undefined
                                : observedSnapshot.dailyPoints.map((point) => ({ label: point.label, value: point.failure, color: '#7a7a7a' }))
                            }
                          />
                        </div>
                      )}
                      </div>

                      {!loading && !loadError && observedSnapshot.hasData ? (
                        <UsageDetailTable
                          rows={observedDrilldownDayKey ? observedSnapshot.minuteRows : activeDetailRows}
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
                                <div className="relative flex items-center min-w-[300px] h-[36px]">
                                  <div
                                    className={`flex items-center transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${viewScale === 'daily' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8 pointer-events-none absolute'}`}
                                  >
                                    <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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
                                    <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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

                                <div className="flex items-center gap-6 ml-auto">
                                  <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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

                                  <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
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
                          rows={projectedDrilldownDayKey ? projectedSnapshot.minuteRows : activeDetailRows}
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
