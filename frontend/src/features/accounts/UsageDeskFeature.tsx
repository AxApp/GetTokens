import { useMemo, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import type { SidecarStatus, UsageDeskWorkspace as UsageDeskWorkspaceID } from '../../types';
import {
  rangeOptions,
  resolutionOptions,
  useUsageDeskFeature,
} from './hooks/useUsageDeskFeature';
import {
  usageDeskProjectedActionImpacts,
  usageDeskProjectedSurfaceViewOptions,
  type UsageDeskProjectedSurfaceView,
  type UsageDeskRangeOption,
  type UsageDeskResolution,
  type UsageDeskFacetGroup,
  type UsageDeskFacetKind,
} from './model/usageDesk';
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
    handleUsageFacetSelect,
  } = useUsageDeskFeature(sidecarStatus, workspace);

  const supportsProjectedUsage = workspace === 'codex' || workspace === 'claude';
  const pageTitle = workspace === 'claude' ? 'Claude Usage Desk' : 'Codex Usage Desk';
  const pageDescription =
    workspace === 'claude'
        ? 'Sidecar 归因展示经过 GetTokens 运行态归属的请求，本地文件投影只读扫描 Claude Code session 文件。'
      : 'Sidecar 归因展示经过 GetTokens 运行态归属的请求，本地文件投影只读扫描 Codex session / rollout 文件。';

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
        <div>{workspace === 'claude' ? '正在扫描本地 Claude Code session 样本。' : '正在扫描本地 Codex rollout 样本。'}</div>
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
                Sidecar 归因
              </button>
              {supportsProjectedUsage ? (
                <button
                  onClick={() => setSource('projected')}
                  className={`btn-swiss ${source === 'projected' ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''}`}
                >
                  本地文件投影
                </button>
              ) : null}
            </>
          }
        />

        <div className="space-y-6">
          {workspace === 'codex' || workspace === 'claude' ? (
            <section className="space-y-5">
              {source === 'observed' ? (
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
                              <>
                                <div className="flex items-center gap-3 text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-wider text-[var(--text-primary)]">
                                  <div className="h-3 w-3 bg-[var(--text-primary)]" />
                                  <span>数据源: Sidecar 归因</span>
                                  <span className="opacity-40">/</span>
                                  <span>{observedDrilldownDayKey || '全部'}</span>
                                  {selectedChartPointKey && (
                                    <>
                                      <span className="opacity-40">/</span>
                                      <span>{selectedChartPointKey}</span>
                                    </>
                                  )}
                                </div>
                                <UsageDeskFacetStrip
                                  groups={usageFacetGroups}
                                  activeSummary={activeFacetSummary}
                                  onSelect={handleUsageFacetSelect}
                                />
                              </>
                            }
                            controls={
                              <UsageDeskObservedControls
                                range={range}
                                resolution={resolution}
                                viewScale={viewScale}
                                onRangeSelect={handleRangeSelect}
                                onResolutionSelect={setResolution}
                                onViewScaleChange={handleViewScaleChange}
                              />
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
                                    <span>数据源: 本地文件投影</span>
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
                                <UsageDeskFacetStrip
                                  groups={usageFacetGroups}
                                  activeSummary={activeFacetSummary}
                                  onSelect={handleUsageFacetSelect}
                                />
                                <div className="grid max-w-[620px] grid-cols-3 gap-2">
                                  {usageDeskProjectedActionImpacts.map((action) => {
                                    const disabled = projectedLoading || (action.id === 'rebuild-day' && !selectedDayKey);
                                    const handleClick =
                                      action.id === 'refresh'
                                        ? () => void refreshProjectedUsage()
                                        : action.id === 'rebuild-day'
                                          ? () => void rebuildProjectedUsageDay(projectedDrilldownDayKey || selectedDayKey)
                                          : () => void rebuildProjectedUsage();

                                    return (
                                      <div key={action.id} className="min-w-0">
                                        <button
                                          type="button"
                                          onClick={handleClick}
                                          className="w-full border-2 border-[var(--border-color)] px-3 py-1.5 text-[length:var(--font-size-ui-lg-compact)] font-black uppercase text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30"
                                          disabled={disabled}
                                          title={action.description}
                                        >
                                          {action.label}
                                        </button>
                                        <div className="mt-1 text-[10px] font-bold leading-tight text-[var(--text-muted)]">
                                          {action.description}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            }
                            controls={
                              <UsageDeskProjectedControls
                                range={range}
                                resolution={resolution}
                                viewScale={viewScale}
                                projectedSurfaceView={projectedSurfaceView}
                                projectedChartMetric={projectedChartMetric}
                                onRangeSelect={handleRangeSelect}
                                onResolutionSelect={setResolution}
                                onSurfaceViewChange={handleProjectedSurfaceViewChange}
                                onMetricChange={setProjectedChartMetric}
                              />
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

type UsageDeskViewScale = 'daily' | 'minute';
type UsageDeskMetric = 'tokens' | 'requests';
type ProjectedSurfaceState = 'chart' | 'projects' | 'sessions';

function UsageDeskObservedControls({
  range,
  resolution,
  viewScale,
  onRangeSelect,
  onResolutionSelect,
  onViewScaleChange,
}: {
  range: UsageDeskRangeOption;
  resolution: UsageDeskResolution;
  viewScale: UsageDeskViewScale;
  onRangeSelect: (option: UsageDeskRangeOption) => void;
  onResolutionSelect: (option: UsageDeskResolution) => void;
  onViewScaleChange: (scale: UsageDeskViewScale) => void;
}) {
  return (
    <div className="usage-desk-control-bar">
      <UsageDeskRangeResolutionControl
        range={range}
        resolution={resolution}
        viewScale={viewScale}
        onRangeSelect={onRangeSelect}
        onResolutionSelect={onResolutionSelect}
      />

      <div className="usage-desk-control-cluster">
        <div className="usage-desk-segmented usage-desk-view-scale-group">
          <button type="button" onClick={() => onViewScaleChange('daily')} className={usageDeskSegmentClass(viewScale === 'daily')}>
            天级趋势
          </button>
          <button type="button" onClick={() => onViewScaleChange('minute')} className={usageDeskSegmentClass(viewScale === 'minute')}>
            分钟明细
          </button>
        </div>

        <UsageDeskOverflowMenu className="usage-desk-compact-overflow-menu">
          <UsageDeskRangeResolutionOverflow
            range={range}
            resolution={resolution}
            viewScale={viewScale}
            onRangeSelect={onRangeSelect}
            onResolutionSelect={onResolutionSelect}
          />
        </UsageDeskOverflowMenu>
      </div>
    </div>
  );
}

function UsageDeskProjectedControls({
  range,
  resolution,
  viewScale,
  projectedSurfaceView,
  projectedChartMetric,
  onRangeSelect,
  onResolutionSelect,
  onSurfaceViewChange,
  onMetricChange,
}: {
  range: UsageDeskRangeOption;
  resolution: UsageDeskResolution;
  viewScale: UsageDeskViewScale;
  projectedSurfaceView: ProjectedSurfaceState;
  projectedChartMetric: UsageDeskMetric;
  onRangeSelect: (option: UsageDeskRangeOption) => void;
  onResolutionSelect: (option: UsageDeskResolution) => void;
  onSurfaceViewChange: (view: UsageDeskProjectedSurfaceView) => void;
  onMetricChange: (metric: UsageDeskMetric) => void;
}) {
  return (
    <div className="usage-desk-control-bar">
      <UsageDeskRangeResolutionControl
        range={range}
        resolution={resolution}
        viewScale={viewScale}
        onRangeSelect={onRangeSelect}
        onResolutionSelect={onResolutionSelect}
      />

      <div className="usage-desk-control-cluster">
        <div className="usage-desk-segmented usage-desk-surface-group">
          {usageDeskProjectedSurfaceViewOptions.map((option) => {
            const active =
              option.id === 'projects' || option.id === 'sessions'
                ? projectedSurfaceView === option.id
                : projectedSurfaceView === 'chart' && viewScale === option.id;
            const overflowable = option.id === 'projects' || option.id === 'sessions';
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSurfaceViewChange(option.id)}
                className={usageDeskSegmentClass(active, overflowable ? 'usage-desk-secondary-surface-option' : '')}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="usage-desk-segmented usage-desk-metric-group">
          <button type="button" onClick={() => onMetricChange('tokens')} className={usageDeskSegmentClass(projectedChartMetric === 'tokens')}>
            Tokens
          </button>
          <button type="button" onClick={() => onMetricChange('requests')} className={usageDeskSegmentClass(projectedChartMetric === 'requests')}>
            请求数
          </button>
        </div>

        <UsageDeskOverflowMenu className="usage-desk-projected-overflow-menu">
          <div className="usage-desk-overflow-section usage-desk-surface-overflow-section">
            <div className="usage-desk-overflow-heading">视图</div>
            {usageDeskProjectedSurfaceViewOptions
              .filter((option) => option.id === 'projects' || option.id === 'sessions')
              .map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSurfaceViewChange(option.id)}
                  className={usageDeskOverflowItemClass(projectedSurfaceView === option.id)}
                >
                  {option.label}
                </button>
              ))}
          </div>

          <div className="usage-desk-overflow-section usage-desk-metric-overflow-section">
            <div className="usage-desk-overflow-heading">指标</div>
            <button type="button" onClick={() => onMetricChange('tokens')} className={usageDeskOverflowItemClass(projectedChartMetric === 'tokens')}>
              Tokens
            </button>
            <button type="button" onClick={() => onMetricChange('requests')} className={usageDeskOverflowItemClass(projectedChartMetric === 'requests')}>
              请求数
            </button>
          </div>

          <UsageDeskRangeResolutionOverflow
            range={range}
            resolution={resolution}
            viewScale={viewScale}
            onRangeSelect={onRangeSelect}
            onResolutionSelect={onResolutionSelect}
          />
        </UsageDeskOverflowMenu>
      </div>
    </div>
  );
}

function UsageDeskRangeResolutionControl({
  range,
  resolution,
  viewScale,
  onRangeSelect,
  onResolutionSelect,
}: {
  range: UsageDeskRangeOption;
  resolution: UsageDeskResolution;
  viewScale: UsageDeskViewScale;
  onRangeSelect: (option: UsageDeskRangeOption) => void;
  onResolutionSelect: (option: UsageDeskResolution) => void;
}) {
  return (
    <div className="usage-desk-range-slot">
      <div className={`usage-desk-range-layer ${viewScale === 'daily' ? 'is-visible' : 'is-hidden-left'}`}>
        <div className="usage-desk-segmented">
          {rangeOptions.map((option) => (
            <button key={option} type="button" onClick={() => onRangeSelect(option)} className={usageDeskSegmentClass(range === option)}>
              {formatUsageDeskRangeLabel(option)}
            </button>
          ))}
        </div>
      </div>

      <div className={`usage-desk-range-layer ${viewScale === 'minute' ? 'is-visible' : 'is-hidden-right'}`}>
        <div className="usage-desk-segmented">
          {resolutionOptions.map((option) => (
            <button key={option} type="button" onClick={() => onResolutionSelect(option)} className={usageDeskSegmentClass(resolution === option)}>
              {formatUsageDeskResolutionLabel(option)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageDeskRangeResolutionOverflow({
  range,
  resolution,
  viewScale,
  onRangeSelect,
  onResolutionSelect,
}: {
  range: UsageDeskRangeOption;
  resolution: UsageDeskResolution;
  viewScale: UsageDeskViewScale;
  onRangeSelect: (option: UsageDeskRangeOption) => void;
  onResolutionSelect: (option: UsageDeskResolution) => void;
}) {
  return (
    <div className="usage-desk-overflow-section usage-desk-range-overflow-section">
      <div className="usage-desk-overflow-heading">{viewScale === 'daily' ? '范围' : '粒度'}</div>
      {viewScale === 'daily'
        ? rangeOptions.map((option) => (
            <button key={option} type="button" onClick={() => onRangeSelect(option)} className={usageDeskOverflowItemClass(range === option)}>
              {formatUsageDeskRangeLabel(option)}
            </button>
          ))
        : resolutionOptions.map((option) => (
            <button key={option} type="button" onClick={() => onResolutionSelect(option)} className={usageDeskOverflowItemClass(resolution === option)}>
              {formatUsageDeskResolutionLabel(option)}
            </button>
          ))}
    </div>
  );
}

function UsageDeskOverflowMenu({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <details className={`usage-desk-overflow-menu ${className}`}>
      <summary className="usage-desk-overflow-trigger" aria-label="更多筛选项">
        <MoreHorizontal size={16} strokeWidth={3} aria-hidden="true" />
      </summary>
      <div className="usage-desk-overflow-panel">{children}</div>
    </details>
  );
}

function UsageDeskFacetStrip({
  groups,
  activeSummary,
  onSelect,
}: {
  groups: UsageDeskFacetGroup[];
  activeSummary: string;
  onSelect: (kind: UsageDeskFacetKind, value: string) => void;
}) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      options: group.options.slice(0, 5),
    }))
    .filter((group) => group.options.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        <span>运营分面</span>
        {activeSummary ? (
          <>
            <span className="opacity-40">/</span>
            <span className="text-[var(--text-primary)]">{activeSummary}</span>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleGroups.map((group) => (
          <div key={group.kind} className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {group.label}
            </span>
            {group.options.map((option) => (
              <button
                key={`${group.kind}:${option.value}`}
                type="button"
                onClick={() => onSelect(group.kind, option.value)}
                title={`${group.label}: ${option.label}`}
                className={`border-2 px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase leading-none transition-colors ${
                  option.active
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <span className="inline-block max-w-[180px] truncate align-bottom">{option.label}</span>
                <span className="ml-1 opacity-60">{option.count}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function usageDeskSegmentClass(active: boolean, extraClassName = '') {
  return `usage-desk-segment ${active ? 'is-active' : 'is-muted'} ${extraClassName}`.trim();
}

function usageDeskOverflowItemClass(active: boolean) {
  return `usage-desk-overflow-item ${active ? 'is-active' : ''}`.trim();
}

function formatUsageDeskRangeLabel(option: UsageDeskRangeOption) {
  return option === 'TODAY' ? '今日' : option === '7D' ? '7天' : option === '14D' ? '14天' : option === '30D' ? '30天' : option;
}

function formatUsageDeskResolutionLabel(option: UsageDeskResolution) {
  return option === '1M' ? '1m' : option === '5M' ? '5m' : option === '15M' ? '15m' : option === '30M' ? '30m' : '60m';
}
