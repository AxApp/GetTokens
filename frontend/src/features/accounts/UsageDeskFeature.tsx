import { useMemo, type ReactNode } from 'react';
import { Button, Segmented, Space } from 'antd';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
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
} from './model/usageDesk';
import { UsageChartCard } from './components/usage-desk/UsageDeskChart';
import { UsageDetailTable } from './components/usage-desk/UsageDetailTable';
import { StatePanel, UsageDeskEvidenceStatus, UsageProjectDrilldownPanel, UsageSessionDrilldownPanel } from './components/usage-desk/UsageDeskPanels';

const usageDeskPageShellClass = 'h-full w-full overflow-auto bg-[var(--gt-surface-page)]';
const usageDeskHeaderSubtitleClass =
  'mt-1 max-w-3xl text-[length:var(--gt-font-size-sm)] font-medium leading-5 text-[var(--gt-ink-muted)]';
const usageDeskProjectedProgressClass =
  'text-[length:var(--gt-font-size-md-compact)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const usageDeskStickyChartShellClass = 'sticky top-0 z-20 -mx-12 bg-[var(--gt-surface-page)] px-12 pb-3 pt-3';
const usageDeskSourceToggleClass = (active: boolean) =>
  [
    'h-9 rounded border px-3 text-[length:var(--gt-font-size-sm)] font-semibold transition-colors',
    active
      ? 'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)]',
  ].join(' ');

export default function UsageDeskFeature({
  sidecarStatus,
  workspace,
}: {
  sidecarStatus: SidecarStatus;
  workspace: UsageDeskWorkspaceID;
}) {
  const { t } = useI18n();
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
  } = useUsageDeskFeature(sidecarStatus, workspace);

  const supportsProjectedUsage = workspace === 'codex' || workspace === 'claude';
  const pageTitle = workspace === 'claude' ? t('accounts.usage_desk_claude_title') : t('accounts.usage_desk_codex_title');
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
        <div className={usageDeskProjectedProgressClass}>
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
    <div ref={scrollContainerRef} className={usageDeskPageShellClass} data-collaboration-id="PAGE_USAGE_DESK" data-usage-desk-feature="quiet">
      <div className="mx-auto max-w-7xl space-y-8 px-12 pb-32 pt-12">
        <WorkspacePageHeader
          title={pageTitle}
          subtitle={pageDescription}
          subtitleClassName={usageDeskHeaderSubtitleClass}
          actions={
            <>
              <button
                type="button"
                onClick={() => setSource('observed')}
                className={usageDeskSourceToggleClass(source === 'observed')}
                aria-pressed={source === 'observed'}
                data-usage-desk-source-toggle="observed"
              >
                Sidecar 归因
              </button>
              {supportsProjectedUsage ? (
                <button
                  type="button"
                  onClick={() => setSource('projected')}
                  className={usageDeskSourceToggleClass(source === 'projected')}
                  aria-pressed={source === 'projected'}
                  data-usage-desk-source-toggle="projected"
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
                    <div className={usageDeskStickyChartShellClass}>
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
                            status={observedStatusEvidence ? <UsageDeskEvidenceStatus evidence={observedStatusEvidence} /> : undefined}
                            selectedPointKey={selectedChartPointKey}
                            onSelectPoint={handleChartPointSelect}
                            curveMotion="realtime"
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
                    <div className={usageDeskStickyChartShellClass}>
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
                            status={projectedStatusEvidence ? <UsageDeskEvidenceStatus evidence={projectedStatusEvidence} /> : undefined}
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
                                projectedLoading={projectedLoading}
                                selectedDayKey={selectedDayKey}
                                projectedDrilldownDayKey={projectedDrilldownDayKey}
                                onRefreshProjectedUsage={refreshProjectedUsage}
                                onRebuildProjectedUsage={rebuildProjectedUsage}
                                onRebuildProjectedUsageDay={rebuildProjectedUsageDay}
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <UsageDeskRangeResolutionControl
        range={range}
        resolution={resolution}
        viewScale={viewScale}
        onRangeSelect={onRangeSelect}
        onResolutionSelect={onResolutionSelect}
      />

      <Segmented
        size="small"
        value={viewScale}
        options={[
          { label: '天级趋势', value: 'daily' },
          { label: '分钟明细', value: 'minute' },
        ]}
        onChange={(value) => onViewScaleChange(value as UsageDeskViewScale)}
      />
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
  projectedLoading,
  selectedDayKey,
  projectedDrilldownDayKey,
  onRefreshProjectedUsage,
  onRebuildProjectedUsage,
  onRebuildProjectedUsageDay,
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
  projectedLoading: boolean;
  selectedDayKey: string | null;
  projectedDrilldownDayKey: string | null;
  onRefreshProjectedUsage: () => Promise<void>;
  onRebuildProjectedUsage: () => Promise<void>;
  onRebuildProjectedUsageDay: (dayKey: string | null) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <UsageDeskRangeResolutionControl
        range={range}
        resolution={resolution}
        viewScale={viewScale}
        onRangeSelect={onRangeSelect}
        onResolutionSelect={onResolutionSelect}
      />

      <Space size={8} wrap>
        <Segmented
          size="small"
          value={projectedSurfaceView === 'chart' ? viewScale : projectedSurfaceView}
          options={usageDeskProjectedSurfaceViewOptions.map((option) => ({ label: option.label, value: option.id }))}
          onChange={(value) => onSurfaceViewChange(value as UsageDeskProjectedSurfaceView)}
        />
        <Segmented
          size="small"
          value={projectedChartMetric}
          options={[
            { label: 'Tokens', value: 'tokens' },
            { label: '请求数', value: 'requests' },
          ]}
          onChange={(value) => onMetricChange(value as UsageDeskMetric)}
        />
        {usageDeskProjectedActionImpacts.map((action) => {
          const disabled = projectedLoading || (action.id === 'rebuild-day' && !selectedDayKey);
          const handleClick =
            action.id === 'refresh'
              ? () => void onRefreshProjectedUsage()
              : action.id === 'rebuild-day'
                ? () => void onRebuildProjectedUsageDay(projectedDrilldownDayKey || selectedDayKey)
                : () => void onRebuildProjectedUsage();

          return (
            <Button key={action.id} size="small" onClick={handleClick} disabled={disabled} title={action.description}>
              {action.label}
            </Button>
          );
        })}
      </Space>
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
  if (viewScale === 'daily') {
    return (
      <Segmented
        size="small"
        value={range}
        options={rangeOptions.map((option) => ({ label: formatUsageDeskRangeLabel(option), value: option }))}
        onChange={(value) => onRangeSelect(value as UsageDeskRangeOption)}
      />
    );
  }

  return (
    <Segmented
      size="small"
      value={resolution}
      options={resolutionOptions.map((option) => ({ label: formatUsageDeskResolutionLabel(option), value: option }))}
      onChange={(value) => onResolutionSelect(value as UsageDeskResolution)}
    />
  );
}

function formatUsageDeskRangeLabel(option: UsageDeskRangeOption) {
  return option === 'TODAY' ? '今日' : option === '7D' ? '7天' : option === '14D' ? '14天' : option === '30D' ? '30天' : option;
}

function formatUsageDeskResolutionLabel(option: UsageDeskResolution) {
  return option === '1M' ? '1m' : option === '5M' ? '5m' : option === '15M' ? '15m' : option === '30M' ? '30m' : '60m';
}
