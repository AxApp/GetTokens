import { useMemo, type ReactNode } from 'react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import type { SidecarStatus, UsageDeskWorkspace as UsageDeskWorkspaceID } from '../../types';
import {
  rangeOptions,
  resolutionOptions,
  useUsageDeskFeature,
} from './hooks/useUsageDeskFeature';
import { usageDeskProjectedSurfaceViewOptions } from './model/usageDesk';
import { UsageChartCard } from './components/usage-desk/UsageDeskChart';
import { UsageDetailTable } from './components/usage-desk/UsageDetailTable';
import { StatePanel, UsageProjectDrilldownPanel, UsageSessionDrilldownPanel } from './components/usage-desk/UsageDeskPanels';

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
    selectedDayKey,
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
    rebuildProjectedUsageDay,
    observedSnapshot,
    projectedSnapshot,
    observedDrilldownDayKey,
    projectedDrilldownDayKey,
    observedSummaryItems,
    projectedSummaryItems,
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
  } = useUsageDeskFeature(sidecarStatus, workspace);

  const supportsProjectedUsage = workspace === 'codex';
  const pageTitle = workspace === 'claude' ? 'Claude Usage Desk' : 'Codex Usage Desk';
  const pageDescription =
    workspace === 'claude'
        ? '当前只展示 relay attribution 中可识别为 Claude / Anthropic 的真实请求量，不读取或估算 Claude 原生 session token。'
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
          subtitleClassName="mt-1 max-w-3xl text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-widest text-[var(--text-muted)]"
          actions={
            <>
              <button
                onClick={() => setSource('observed')}
                className={`btn-swiss ${source === 'observed' ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
              >
                真实请求量
              </button>
              {supportsProjectedUsage ? (
                <button
                  onClick={() => setSource('projected')}
                  className={`btn-swiss ${source === 'projected' ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
                >
                  本地投影用量
                </button>
              ) : null}
            </>
          }
        />

        <div className="space-y-6">
          {workspace === 'codex' || workspace === 'claude' ? (
            <section className="space-y-5">
              {source === 'observed' || workspace === 'claude' ? (
                <section className="space-y-5">
                    <div className="space-y-5">
                      <div className="sticky top-0 z-20 -mx-12 bg-[var(--bg-surface)] px-12 pb-3 pt-3">
                      {loading ? (
                        <StatePanel
                          title="加载中"
                          body={workspace === 'claude' ? '正在拉取 Claude / Anthropic relay 账号归因真实请求样本。' : '正在拉取 sidecar 账号归因真实请求样本。'}
                        />
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
                            curveMotion="realtime"
                            status={
                                <div className="flex items-center gap-3 text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-wider text-[var(--text-primary)]">
                                  <div className="h-3 w-3 bg-[var(--text-primary)]" />
                                <span>{workspace === 'claude' ? '数据源: Claude Attribution' : '数据源: Sidecar Attribution'}</span>
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
                                          className={`px-5 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
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
                                          className={`px-5 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
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
                                      className={`px-4 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
                                        viewScale === 'daily' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      天级趋势
                                    </button>
                                    <button
                                      onClick={() => handleViewScaleChange('minute')}
                                      className={`px-4 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
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
                                    value: point.requests,
                                    color: 'var(--color-chart-primary)',
                                  }))
                                : observedSnapshot.dailyPoints.map((point) => ({
                                    label: point.label,
                                    value: point.requests,
                                    color: 'var(--color-chart-primary)',
                                    drilldownDayKey: point.dayKey,
                                  }))
                            }
                            secondary={
                              observedDrilldownDayKey
                                ? undefined
                                : observedSnapshot.dailyPoints.map((point) => ({ label: point.label, value: point.failure, color: 'var(--color-chart-secondary)' }))
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
                            curveMotion="realtime"
                            surfaceContent={
                              projectedSurfaceView === 'projects' ? (
                                <UsageProjectDrilldownPanel
                                  title={selectedProjectedSessionUsageLabel.replace('本地会话', '项目汇总') || '项目汇总'}
                                  rows={selectedProjectedProjectUsages}
                                  embedded
                                />
                              ) : projectedSurfaceView === 'sessions' ? (
                                <UsageSessionDrilldownPanel
                                  title={selectedProjectedSessionUsageLabel || '本地会话'}
                                  rows={selectedProjectedSessionUsages}
                                  embedded
                                />
                              ) : undefined
                            }
                            status={
                              <>
                                <div className="flex items-center gap-6">
                                  <div className="flex items-center gap-3 text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-wider text-[var(--text-primary)]">
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
                                    <div className="text-[length:var(--font-size-ui-lg-compact)] font-black uppercase text-[var(--text-primary)] px-2 bg-[var(--bg-surface)] border-2 border-[var(--border-color)]">
                                      {projectedActionMessage}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => void refreshProjectedUsage()} className="border-2 border-[var(--border-color)] px-4 py-1.5 text-[length:var(--font-size-ui-lg-compact)] font-black uppercase text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30" disabled={projectedLoading}>
                                    刷新索引
                                  </button>
                                  <button onClick={() => void rebuildProjectedUsageDay(projectedDrilldownDayKey || selectedDayKey)} className="border-2 border-[var(--border-color)] px-4 py-1.5 text-[length:var(--font-size-ui-lg-compact)] font-black uppercase text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30" disabled={projectedLoading || !selectedDayKey}>
                                    重建当日
                                  </button>
                                  <button onClick={() => void rebuildProjectedUsage()} className="border-2 border-[var(--border-color)] px-4 py-1.5 text-[length:var(--font-size-ui-lg-compact)] font-black uppercase text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30" disabled={projectedLoading}>
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
                                          className={`px-5 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
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
                                          className={`px-5 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
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
                                    {usageDeskProjectedSurfaceViewOptions.map((option) => {
                                      const active =
                                        option.id === 'projects' || option.id === 'sessions'
                                          ? projectedSurfaceView === option.id
                                          : projectedSurfaceView === 'chart' && viewScale === option.id;
                                      return (
                                        <button
                                          key={option.id}
                                          onClick={() => handleProjectedSurfaceViewChange(option.id)}
                                          className={`px-4 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
                                            active ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                          }`}
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center border-2 border-[var(--border-color)] p-0.5 bg-[var(--bg-surface)]">
                                    <button
                                      onClick={() => setProjectedChartMetric('tokens')}
                                      className={`px-4 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
                                        projectedChartMetric === 'tokens' ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-primary)] opacity-40 hover:opacity-100'
                                      }`}
                                    >
                                      Tokens
                                    </button>
                                    <button
                                      onClick={() => setProjectedChartMetric('requests')}
                                      className={`px-4 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black uppercase transition-colors ${
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
