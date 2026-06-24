import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Tag } from 'antd';
import ModalFrame from '../../../components/ui/ModalFrame';
import AttributionCard, { type AttributionCardBadge } from '../../accounts/components/AttributionCard';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import { buildCodexLiveSessionSummary, groupTimelineByLane } from '../model/selectors';
import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionStatus,
  CodexLiveTimelineEvent,
} from '../model/types';
import {
  formatDuration,
  formatOptionalDuration,
  formatOptionalRate,
  severityDotClass,
  statusLabelKeys,
  type CodexLiveRequestFeedRow,
} from './formatters';
import {
  buildLiveSessionBillingDisplay,
  buildLiveSessionQuotaDisplay,
} from './accountCardAdapters';
import {
  buildFallbackTimelineSummary,
  buildRequestTimelineSummary,
  formatTimelineRequestID,
  sortRequestTimelineRequests,
  type FallbackTimelineSummary,
  type RequestTimelineSummary,
} from './requestTimelineSummary';
import type { Translate } from './types';
import {
  buildCodexLiveRequestTimingTrend,
  resolveCodexLiveTimingMetricSummary,
  type CodexLiveTimingMetricAverages,
  type CodexLiveRequestTimingTrendPoint,
  type CodexLiveTimingTrendMetric,
} from '../model/requestTimingTrend';

const codexLivePanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const codexLiveMutedPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexLiveHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexLiveChipClass =
  'inline-flex h-6 items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)]';
const codexLiveMetaTextClass = 'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const codexLiveKickerTextClass = 'text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexLiveSectionLabelClass = 'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexLiveTitleTextClass = 'text-[length:var(--gt-font-size-xl)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const codexLiveMetaPanelClass = `${codexLiveMutedPanelClass} flex min-h-10 items-center justify-between gap-3 px-3 py-2 ${codexLiveMetaTextClass}`;
const codexLiveInlineMetaClass = 'min-w-0 max-w-full truncate text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[color:color-mix(in_srgb,var(--gt-ink-muted)_72%,var(--gt-ink-primary))]';

export function SessionDetail({
  session,
  request,
  overviewSessions = [],
  overviewRequestCount = 0,
  overviewRequestRows = [],
  overviewHistoryLabel,
  overviewCanLoadMore = false,
  onLoadMoreOverview,
  detailHistoryLabel,
  detailCanLoadMore = false,
  onLoadMoreDetail,
  overviewLoading = false,
  overviewError,
  loading = false,
  errorMessage,
  t,
}: {
  session?: CodexLiveSession;
  request?: CodexLiveRequest;
  overviewSessions?: readonly CodexLiveSession[];
  overviewRequestCount?: number;
  overviewRequestRows?: readonly CodexLiveRequestFeedRow[];
  overviewHistoryLabel?: string;
  overviewCanLoadMore?: boolean;
  onLoadMoreOverview?: () => void;
  detailHistoryLabel?: string;
  detailCanLoadMore?: boolean;
  onLoadMoreDetail?: () => void;
  overviewLoading?: boolean;
  overviewError?: string;
  loading?: boolean;
  errorMessage?: string;
  t: Translate;
}) {
  const [selectedTimingMetric, setSelectedTimingMetric] = useState<CodexLiveTimingTrendMetric>('firstEventMs');

  if (!session) {
    return (
      <SessionOverview
        sessions={overviewSessions}
        requestCount={overviewRequestCount}
        requestRows={overviewRequestRows}
        historyLabel={overviewHistoryLabel}
        canLoadMore={overviewCanLoadMore}
        onLoadMore={onLoadMoreOverview}
        selectedMetric={selectedTimingMetric}
        onSelectMetric={setSelectedTimingMetric}
        loading={overviewLoading}
        errorMessage={overviewError}
        t={t}
      />
    );
  }

  const timeline = request?.timeline ?? session.recentEvents;

  return (
    <div className="grid max-h-[calc(100vh-13rem)] min-w-0 w-full gap-5 overflow-y-auto overscroll-contain pr-1 scrollbar-stable" data-codex-session-detail-root="true" data-codex-live-detail-shell="true" data-codex-live-detail-typography="quiet">
      <div className="grid min-w-0 gap-3" data-codex-detail-section="analysis">
        {loading || errorMessage ? (
          <div className="overflow-hidden" data-codex-detail-slot="status">
            <div className={codexLiveMetaPanelClass}>
              <span className="text-[var(--gt-ink-muted)]">
                {loading ? t('codex_live_sessions.detail_loading') : t('codex_live_sessions.detail_stale')}
              </span>
              {errorMessage ? (
                <span className="min-w-0 truncate text-right text-[var(--gt-status-warning)]">{errorMessage}</span>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="min-w-0 overflow-hidden" data-codex-detail-slot="trend">
          <RequestTimingTrend session={session} request={request} selectedMetric={selectedTimingMetric} t={t} />
        </div>
        <div className="min-w-0" data-codex-detail-slot="metrics">
          <TimingMetrics
            session={session}
            request={request}
            selectedMetric={selectedTimingMetric}
            onSelectMetric={setSelectedTimingMetric}
            t={t}
          />
        </div>
        <div className="min-w-0" data-codex-detail-slot="timeline">
          <Timeline requests={session.requests} fallbackEvents={timeline} t={t} />
          {detailHistoryLabel || detailCanLoadMore ? (
            <HistoryWindowControl
              label={detailHistoryLabel}
              canLoadMore={detailCanLoadMore}
              onLoadMore={onLoadMoreDetail}
              loading={loading}
              t={t}
            />
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-5 2xl:grid-cols-2" data-codex-detail-section="metadata">
        <div className="min-w-0" data-codex-detail-slot="account">
          <AccountCard session={session} request={request} t={t} />
        </div>
        <div className="min-w-0" data-codex-detail-slot="session">
          <SessionCard session={session} request={request} t={t} />
        </div>
        <div className="min-w-0 2xl:col-span-2" data-codex-detail-slot="transport">
          <TransportLane events={timeline} t={t} />
        </div>
      </div>
    </div>
  );
}

function SessionOverview({
  sessions,
  requestCount,
  requestRows,
  historyLabel,
  canLoadMore,
  onLoadMore,
  selectedMetric,
  onSelectMetric,
  loading,
  errorMessage,
  t,
}: {
  sessions: readonly CodexLiveSession[];
  requestCount: number;
  requestRows: readonly CodexLiveRequestFeedRow[];
  historyLabel?: string;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
  selectedMetric: CodexLiveTimingTrendMetric;
  onSelectMetric: (metric: CodexLiveTimingTrendMetric) => void;
  loading?: boolean;
  errorMessage?: string;
  t: Translate;
}) {
  const summary = buildCodexLiveSessionSummary(sessions);
  const overviewRequests = requestRows.flatMap((row) => (row.request ? [row.request] : []));

  return (
    <section className="grid min-w-0 gap-5" data-codex-live-overview="true" data-codex-live-overview-shell="true">
      <div
        className="relative grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(9rem,0.65fr)_minmax(9rem,0.65fr)_minmax(9rem,0.65fr)]"
        data-codex-overview-summary-cards="true"
      >
        <section className={`${codexLivePanelClass} grid min-h-[5.75rem] min-w-0 content-between p-2.5`} data-codex-overview-card="identity" data-codex-live-overview-identity="quiet">
          <div className="min-w-0">
            <p className={codexLiveKickerTextClass}>
              {t('codex_live_sessions.overview_kicker')}
            </p>
            <h3 className={`mt-1.5 ${codexLiveTitleTextClass}`}>
              {t('codex_live_sessions.overview_title')}
            </h3>
          </div>
          <span className="mt-2 h-1 w-8 bg-[color:color-mix(in_srgb,var(--gt-ink-primary)_18%,transparent)]" aria-hidden="true" />
        </section>
        <OverviewSummaryCard
          label={t('codex_live_sessions.requests')}
          primaryValue={`${requestCount}`}
          primaryLabel={t('codex_live_sessions.request_rows')}
          secondaryValue={`${sessions.length} ${t('codex_live_sessions.session_rows')}`}
        />
        <OverviewSummaryCard
          label={t('codex_live_sessions.summary_active')}
          primaryValue={`${summary.activeSessions}`}
          primaryLabel={t('codex_live_sessions.session_rows')}
          secondaryValue={`${summary.activeRequests} ${t('codex_live_sessions.summary_requests')}`}
          accent="success"
        />
        <OverviewSummaryCard
          label={t('codex_live_sessions.overview_risk')}
          primaryValue={`${summary.degradedSessions}`}
          primaryLabel={t('codex_live_sessions.summary_degraded')}
          secondaryValue={`${summary.errorSessions} ${t('codex_live_sessions.summary_failed')}`}
          accent={summary.errorSessions > 0 ? 'danger' : summary.degradedSessions > 0 ? 'warning' : 'neutral'}
        />
        <OverviewStatusNotice loading={loading} errorMessage={errorMessage} t={t} />
      </div>

      <OverviewTimingTrend
        requests={overviewRequests}
        selectedMetric={selectedMetric}
        onSelectMetric={onSelectMetric}
        t={t}
      />

      <Timeline
        requests={overviewRequests}
        fallbackEvents={[]}
        title={t('codex_live_sessions.overview_request_list')}
        countLabel={`${requestRows.length} ${t('codex_live_sessions.request_rows')}`}
        t={t}
      />
      <HistoryWindowControl label={historyLabel} canLoadMore={canLoadMore} onLoadMore={onLoadMore} loading={loading} t={t} />
    </section>
  );
}

function HistoryWindowControl({
  label,
  canLoadMore,
  onLoadMore,
  loading,
  t,
}: {
  label?: string;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  t: Translate;
}) {
  if (!label && !canLoadMore) {
    return null;
  }

  return (
    <div className={`${codexLiveMetaPanelClass} flex-wrap`} data-codex-history-window-control="true">
      <span className="text-[var(--gt-ink-muted)]">{label || t('codex_live_sessions.history_recent_window')}</span>
      {canLoadMore ? (
        <Button size="small" onClick={onLoadMore} disabled={loading}>
          {loading ? t('common.loading') : t('codex_live_sessions.history_load_more')}
        </Button>
      ) : null}
    </div>
  );
}

function OverviewStatusNotice({ loading, errorMessage, t }: { loading?: boolean; errorMessage?: string; t: Translate }) {
  if (!loading && !errorMessage) {
    return null;
  }

  return (
    <div
      className={`${codexLiveMutedPanelClass} pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-10 flex max-w-[min(32rem,100%)] items-center gap-3 px-2.5 py-1 text-[length:var(--gt-font-size-2xs)] font-normal`}
      data-codex-overview-status-overlay="true"
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0 text-[var(--gt-ink-muted)]">
        {loading ? t('codex_live_sessions.detail_loading') : t('codex_live_sessions.detail_stale')}
      </span>
      {errorMessage ? <span className="min-w-0 truncate text-right text-[var(--gt-status-warning)]">{errorMessage}</span> : null}
    </div>
  );
}

function OverviewSummaryCard({
  label,
  primaryValue,
  primaryLabel,
  secondaryValue,
  accent = 'neutral',
}: {
  label: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  accent?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const accentClass = {
    neutral: 'bg-[color:color-mix(in_srgb,var(--gt-ink-muted)_18%,transparent)]',
    success: 'bg-[var(--gt-status-success)]',
    warning: 'bg-[var(--gt-status-warning)]',
    danger: 'bg-[var(--gt-status-danger)]',
  }[accent];

  return (
    <section className={`${codexLivePanelClass} grid min-h-[5.75rem] min-w-0 content-between p-2.5`} data-codex-overview-card="metric">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className={codexLiveKickerTextClass}>
          {label}
        </p>
        <span className={`h-2.5 w-2.5 shrink-0 ${accentClass}`} />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-mono text-[length:var(--gt-font-size-2xl)] font-semibold leading-none text-[var(--gt-ink-primary)]">
            {primaryValue}
          </span>
          <span className="min-w-0 truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            {primaryLabel}
          </span>
        </div>
        <p className="mt-2 truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[color:color-mix(in_srgb,var(--gt-ink-muted)_72%,var(--gt-ink-primary))]">
          {secondaryValue}
        </p>
      </div>
    </section>
  );
}

function OverviewTimingTrend({
  requests,
  selectedMetric,
  onSelectMetric,
  t,
}: {
  requests: readonly CodexLiveRequest[];
  selectedMetric: CodexLiveTimingTrendMetric;
  onSelectMetric: (metric: CodexLiveTimingTrendMetric) => void;
  t: Translate;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const refreshID = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(refreshID);
  }, []);

  const activeRequest = requests.find((request) => !request.completedAt && ['active', 'streaming', 'reconnecting'].includes(request.status));
  const trend = buildCodexLiveRequestTimingTrend(requests, activeRequest, { nowMs });
  const latestPoint = trend.points[trend.points.length - 1];
  const selectedSeries = getTimingTrendSeries(selectedMetric);
  const seriesPaint = selectedSeries.color;
  const selectedRequestID = activeRequest?.requestID || latestPoint?.requestID || '';

  return (
    <section
      className={`${codexLivePanelClass} min-w-0 overflow-hidden`}
      aria-label={t('codex_live_sessions.request_timing_trend')}
      data-codex-overview-trend-shell="session-style"
    >
      <div className={`${codexLiveHeaderClass} grid w-full gap-1 px-4 py-3 text-left md:grid-cols-[minmax(0,1fr)_auto] md:items-end`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={codexLiveChipClass}>{t('codex_live_sessions.overview_kicker')}</span>
            <span className={codexLiveInlineMetaClass}>
              {latestPoint?.requestID || t('codex_live_sessions.timing_trend_empty')}
            </span>
          </div>
          <h3 className={`mt-1 ${codexLiveTitleTextClass}`} data-codex-live-timing-title="quiet">
            {t('codex_live_sessions.request_timing_trend')}
          </h3>
        </div>
        <TimingMetricSelector selectedMetric={selectedMetric} onSelectMetric={onSelectMetric} t={t} />
      </div>

      <div className="grid gap-3 p-3">
        <TimingTrendChart
          trend={trend}
          selectedMetric={selectedMetric}
          selectedRequestID={selectedRequestID}
          t={t}
        />

        <div className="grid gap-2 border-t border-[color:color-mix(in_srgb,var(--gt-border-subtle)_22%,transparent)] pt-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
            <TimingTrendFooterItem label={t('codex_live_sessions.requests')} value={`${requests.length}`} />
            <TimingTrendFooterItem label={t('codex_live_sessions.latest_sample')} value={latestPoint?.label || t('codex_live_sessions.timing_trend_empty')} />
          </div>

          <div className="flex min-w-0 flex-wrap justify-start gap-x-4 gap-y-2 md:justify-end">
            <div className="grid grid-cols-[0.75rem_auto_auto] items-center gap-2 font-mono text-[length:var(--gt-font-size-xs)]">
              <span className="h-2 w-2" style={{ background: seriesPaint }} />
              <span className="font-semibold text-[var(--gt-ink-muted)]">{t(selectedSeries.labelKey)}</span>
              <span className="font-semibold text-[var(--gt-ink-primary)]">
                {formatOptionalDuration(latestPoint?.values[selectedMetric] ?? undefined)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimingMetricSelector({
  selectedMetric,
  onSelectMetric,
  t,
}: {
  selectedMetric: CodexLiveTimingTrendMetric;
  onSelectMetric: (metric: CodexLiveTimingTrendMetric) => void;
  t: Translate;
}) {
  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-1">
      {timingTrendSeries.slice(0, 4).map((series) => {
        const active = selectedMetric === series.id;
        return (
          <Button
            key={series.id}
            size="small"
            className={`h-7 border px-2 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold transition-colors ${
              active
                ? 'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
                : 'border-[color:color-mix(in_srgb,var(--gt-border-subtle)_42%,transparent)] text-[var(--gt-ink-muted)] hover:border-[var(--gt-ink-primary)] hover:text-[var(--gt-ink-primary)]'
            }`}
            onClick={() => onSelectMetric(series.id)}
          >
            {t(series.labelKey)}
          </Button>
        );
      })}
    </div>
  );
}

const timingTrendSeries: Array<{ id: CodexLiveTimingTrendMetric; labelKey: string; color: string }> = [
  { id: 'firstEventMs', labelKey: 'codex_live_sessions.timing_ttft', color: 'var(--color-chart-blue)' },
  { id: 'firstTokenMs', labelKey: 'codex_live_sessions.timing_first_token', color: 'var(--color-chart-peak)' },
  { id: 'streamDurationMs', labelKey: 'codex_live_sessions.timing_stream', color: 'var(--gt-status-success)' },
  { id: 'queueWaitMs', labelKey: 'codex_live_sessions.timing_queue', color: 'var(--gt-status-warning)' },
  { id: 'authSelectMs', labelKey: 'codex_live_sessions.timing_auth', color: 'var(--color-chart-attribution)' },
  { id: 'upstreamConnectMs', labelKey: 'codex_live_sessions.timing_connect', color: 'var(--color-chart-secondary)' },
  { id: 'averageEventGapMs', labelKey: 'codex_live_sessions.timing_avg_gap', color: 'var(--gt-status-warning)' },
  { id: 'longestEventGapMs', labelKey: 'codex_live_sessions.timing_max_gap', color: 'var(--gt-status-danger)' },
];
const requestTimelineVisibleLimit = 15;
const timingTrendPointStepPx = 16;
const timingTrendMinVisiblePoints = 18;
const timingTrendSequenceTickEvery = 10;
const timingTrendSequenceTickMinGapPx = 40;
const timingTrendChartFallbackWidthPx = 560;

function RequestTimingTrend({
  session,
  request,
  selectedMetric,
  t,
}: {
  session: CodexLiveSession;
  request?: CodexLiveRequest;
  selectedMetric: CodexLiveTimingTrendMetric;
  t: Translate;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const refreshID = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(refreshID);
  }, []);

  const trend = buildCodexLiveRequestTimingTrend(session.requests, request, { nowMs });
  const currentRequestID = request?.requestID || session.lastRequestID || session.sessionID;
  const latestPoint = trend.points[trend.points.length - 1];
  const selectedSeries = getTimingTrendSeries(selectedMetric);
  const seriesPaint = selectedSeries.color;

  return (
    <section
      className={`${codexLivePanelClass} min-w-0 overflow-hidden`}
      aria-label={t('codex_live_sessions.request_timing_trend')}
      data-codex-request-timing-trend-shell="session-style"
    >
      <div className={`${codexLiveHeaderClass} grid w-full gap-1 px-4 py-3 text-left md:grid-cols-[minmax(0,1fr)_auto] md:items-end`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} t={t} />
            {session.fallbackInferred ? <span className={codexLiveChipClass}>{t('codex_live_sessions.inferred')}</span> : null}
            <span className={codexLiveInlineMetaClass}>
              {currentRequestID}
            </span>
          </div>
          <h3 className={`mt-1 ${codexLiveTitleTextClass}`} data-codex-live-timing-title="quiet">
            {t('codex_live_sessions.request_timing_trend')}
          </h3>
        </div>
        <div className="flex min-w-0 max-w-full flex-nowrap items-center justify-start gap-2 overflow-hidden whitespace-nowrap font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[color:color-mix(in_srgb,var(--gt-ink-muted)_68%,var(--gt-ink-primary))] md:justify-end md:text-right">
          <span className="shrink-0 text-[var(--gt-ink-primary)]">{session.model}</span>
          <span className="shrink-0 text-[color:color-mix(in_srgb,var(--gt-ink-muted)_54%,var(--gt-ink-primary))]">·</span>
          <span className="min-w-0 truncate">{session.downstreamTransport} → {session.upstreamTransport}</span>
        </div>
      </div>

      <div className="grid gap-3 p-3">
        <TimingTrendChart
          trend={trend}
          selectedMetric={selectedMetric}
          selectedRequestID={request?.requestID || session.lastRequestID || ''}
          t={t}
        />

        <div className="grid gap-2 border-t border-[color:color-mix(in_srgb,var(--gt-border-subtle)_22%,transparent)] pt-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
            <TimingTrendFooterItem label={t('codex_live_sessions.duration')} value={formatDuration(session.durationMs)} />
            <TimingTrendFooterItem label={t('codex_live_sessions.requests')} value={`${session.requestCount}`} />
            <TimingTrendFooterItem label={t('codex_live_sessions.latest_sample')} value={latestPoint?.label || t('codex_live_sessions.timing_trend_empty')} />
          </div>

          <div className="flex min-w-0 flex-wrap justify-start gap-x-4 gap-y-2 md:justify-end">
            <div className="grid grid-cols-[0.75rem_auto_auto] items-center gap-2 font-mono text-[length:var(--gt-font-size-xs)]">
              <span className="h-2 w-2" style={{ background: seriesPaint }} />
              <span className="font-semibold text-[var(--gt-ink-muted)]">{t(selectedSeries.labelKey)}</span>
              <span className="font-semibold text-[var(--gt-ink-primary)]">
                {formatOptionalDuration(latestPoint?.values[selectedMetric] ?? undefined)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimingTrendFooterItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 font-mono text-[length:var(--gt-font-size-xs)]">
      <span className="mr-2 font-semibold text-[var(--gt-ink-muted)]">{label}</span>
      <span className="font-semibold text-[var(--gt-ink-primary)]">{value}</span>
    </div>
  );
}

function TimingTrendChart({
  trend,
  selectedMetric,
  selectedRequestID,
  t,
}: {
  trend: ReturnType<typeof buildCodexLiveRequestTimingTrend>;
  selectedMetric: CodexLiveTimingTrendMetric;
  selectedRequestID: string;
  t: Translate;
}) {
  const chartHeight = 230;
  const chartTopInset = 22;
  const chartBottomInset = 34;
  const height = chartHeight;
  const padding = resolveTimingTrendChartPadding(chartTopInset, chartBottomInset);
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const selectedSeries = getTimingTrendSeries(selectedMetric);
  const width = chartWidth > 0 ? chartWidth : timingTrendChartFallbackWidthPx;
  const svgWidthStyle = chartWidth > 0 ? '100%' : `${timingTrendChartFallbackWidthPx}px`;
  const visibleRequestCount = resolveTimingTrendVisibleRequestCount(width, padding);
  const visiblePoints = trend.points.slice(-visibleRequestCount);
  const selectedMetricMaxMs = getTimingTrendMetricMax(visiblePoints, selectedMetric);
  const chartPoints = buildTimingTrendLinePoints(visiblePoints, selectedMetric, selectedMetricMaxMs, width, height, padding);
  const sequenceTickIndexes = resolveTimingTrendSequenceTickIndexes(chartPoints, selectedRequestID);
  const linePath = buildTimingTrendLinePath(chartPoints);
  const areaPath = buildTimingTrendAreaPath(chartPoints, height - padding.bottom);
  const selectedPoint = chartPoints.find((point) => point.point.requestID === selectedRequestID) ?? chartPoints[chartPoints.length - 1];
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  useLayoutEffect(() => {
    const element = chartShellRef.current;
    if (!element) {
      return;
    }
    const updateWidth = () => setChartWidth(Math.round(element.clientWidth));
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!trend.hasData || selectedMetricMaxMs <= 0) {
    return (
      <div className={`${codexLiveMutedPanelClass} grid h-[230px] place-items-center text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]`}>
        {t('codex_live_sessions.timing_trend_empty')}
      </div>
    );
  }

  return (
    <div
      className={`${codexLiveMutedPanelClass} overflow-hidden`}
      data-codex-timing-latency-chart="true"
      role="img"
      aria-label={t('codex_live_sessions.request_timing_trend')}
    >
      <div
        ref={chartShellRef}
        className="relative h-full w-full"
        style={{
          height: `${chartHeight}px`,
          width: '100%',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMinYMin meet"
          className="absolute inset-y-0 left-0 h-full"
          style={{ width: svgWidthStyle }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="codexTimingTrendArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={selectedSeries.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={selectedSeries.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((ratio) => {
            const y = padding.top + (height - padding.top - padding.bottom) * ratio;
            return (
              <g key={`grid-${ratio}`} data-codex-timing-grid-line="true">
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="color-mix(in srgb, var(--gt-ink-muted) 13%, transparent)"
                  strokeWidth="1"
                />
                {ratio === 0 || ratio === 0.5 || ratio === 1 ? (
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[var(--gt-ink-muted)] font-mono text-xs font-semibold"
                    opacity="0.52"
                  >
                    {formatDuration(selectedMetricMaxMs * (1 - ratio))}
                  </text>
                ) : null}
              </g>
            );
          })}

          {chartPoints.map(({ point, x }, index) => {
            const showSequenceTick = sequenceTickIndexes.has(index);
            return (
              <g key={`${point.requestID}-sequence`} data-codex-timing-sequence-tick={showSequenceTick ? 'true' : undefined}>
                {showSequenceTick ? (
                  <>
                    <line
                      x1={x}
                      x2={x}
                      y1={height - padding.bottom + 10}
                      y2={height - padding.bottom + 15}
                      stroke="color-mix(in srgb, var(--gt-ink-muted) 30%, transparent)"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-[var(--gt-ink-muted)] font-mono text-xs font-semibold"
                      opacity={point.requestID === selectedRequestID || point.isLive ? 0.92 : 0.48}
                    >
                      #{point.sequence}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}

          <g key={`${selectedMetric}-latency-trend-layer`} data-codex-timing-line-layer="true">
            {areaPath ? <path d={areaPath} fill="url(#codexTimingTrendArea)" data-codex-timing-area-path="true" /> : null}
            {linePath ? (
              <path
                d={linePath}
                fill="none"
                stroke={selectedSeries.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                data-codex-timing-line-path="true"
              />
            ) : null}
            {chartPoints.map(({ point, x, y, value }) => {
              const emphasized = point.requestID === selectedRequestID || point.isLive;
              return (
                <circle
                  key={`${point.requestID}-point`}
                  cx={x}
                  cy={y}
                  r={emphasized ? 4.5 : 2.5}
                  fill={emphasized ? selectedSeries.color : 'var(--gt-surface-canvas)'}
                  stroke={selectedSeries.color}
                  strokeWidth={emphasized ? 2 : 1.25}
                  opacity={emphasized ? 0.95 : 0.58}
                  data-codex-timing-point="true"
                >
                  <title>{`${point.label} · ${t(selectedSeries.labelKey)} ${formatDuration(value)}`}</title>
                </circle>
              );
            })}
            {selectedPoint ? (
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="9"
                fill="none"
                stroke={selectedSeries.color}
                strokeWidth="1.25"
                opacity="0.36"
                data-codex-timing-selected-ring="true"
              />
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}

function getTimingTrendSeries(metric: CodexLiveTimingTrendMetric) {
  return timingTrendSeries.find((series) => series.id === metric) ?? timingTrendSeries[0];
}

function getTimingTrendMetricMax(points: readonly CodexLiveRequestTimingTrendPoint[], metric: CodexLiveTimingTrendMetric): number {
  return points.reduce((max, point) => Math.max(max, point.values[metric] ?? 0), 0);
}

function resolveTimingTrendChartPadding(top: number, bottom: number) {
  return {
    top,
    right: 18,
    bottom,
    left: 52,
  };
}

interface TimingTrendLinePoint {
  point: CodexLiveRequestTimingTrendPoint;
  x: number;
  y: number;
  value: number;
}

function buildTimingTrendLinePoints(
  points: readonly CodexLiveRequestTimingTrendPoint[],
  metric: CodexLiveTimingTrendMetric,
  maxMs: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): TimingTrendLinePoint[] {
  const chartHeight = height - padding.top - padding.bottom;
  return points.flatMap((point, index) => {
    const value = point.values[metric];
    if (value === null) {
      return [];
    }
    const ratio = maxMs > 0 ? Math.min(1, Math.max(0, value / maxMs)) : 0;
    const x = resolveTimingTrendBarX(index, points.length, width, padding);
    return {
      point,
      value,
      x,
      y: padding.top + chartHeight * (1 - ratio),
    };
  });
}

function buildTimingTrendLinePath(points: readonly TimingTrendLinePoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildTimingTrendAreaPath(points: readonly TimingTrendLinePoint[], baselineY: number): string {
  if (points.length === 0) {
    return '';
  }
  const linePath = buildTimingTrendLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `M ${first.x} ${baselineY} ${linePath.replace(/^M /, 'L ')} L ${last.x} ${baselineY} Z`;
}

function resolveTimingTrendVisibleRequestCount(
  width: number,
  padding: { right: number; left: number },
): number {
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  return Math.max(timingTrendMinVisiblePoints, Math.floor(plotWidth / timingTrendPointStepPx));
}

function resolveTimingTrendBarX(
  index: number,
  visibleCount: number,
  width: number,
  padding: { right: number; left: number },
): number {
  const plotRight = width - padding.right;
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const fixedWidth = Math.max(0, (visibleCount - 1) * timingTrendPointStepPx);
  const visibleWidth = Math.min(plotWidth, Math.max(fixedWidth, plotWidth));
  const barStep = visibleCount > 1 ? visibleWidth / (visibleCount - 1) : 0;
  return plotRight - visibleWidth + index * barStep;
}

function resolveTimingTrendSequenceTickIndexes(
  points: readonly TimingTrendLinePoint[],
  selectedRequestID: string,
): Set<number> {
  const labelIndexes = new Set<number>();
  if (points.length <= 6) {
    points.forEach((_, index) => labelIndexes.add(index));
    return labelIndexes;
  }

  const canAddPoint = (point: TimingTrendLinePoint) => {
    const existingXs = Array.from(labelIndexes, (existingIndex) => points[existingIndex]?.x ?? Number.NEGATIVE_INFINITY);
    return existingXs.every((existingX) => Math.abs(point.x - existingX) >= timingTrendSequenceTickMinGapPx);
  };
  const addLabelIndex = (index: number, force = false) => {
    const point = points[index];
    if (!point) {
      return;
    }
    if (force || canAddPoint(point)) {
      labelIndexes.add(index);
    }
  };

  addLabelIndex(points.length - 1, true);
  points.forEach((chartPoint, index) => {
    if (chartPoint.point.isLive || chartPoint.point.requestID === selectedRequestID) {
      addLabelIndex(index, index === points.length - 1);
    }
  });
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point && point.point.sequence % timingTrendSequenceTickEvery === 0) {
      addLabelIndex(index);
    }
  }
  return labelIndexes;
}

function TransportLane({ events, t }: { events: readonly CodexLiveTimelineEvent[]; t: Translate }) {
  const lanes = groupTimelineByLane(events);
  const laneItems: Array<[keyof ReturnType<typeof groupTimelineByLane>, string]> = [
    ['downstream', t('codex_live_sessions.lane_downstream')],
    ['sidecar', t('codex_live_sessions.lane_sidecar')],
    ['upstream', t('codex_live_sessions.lane_upstream')],
    ['fallback', t('codex_live_sessions.lane_fallback')],
  ];

  return (
    <div className="grid gap-3">
      <div className={codexLiveSectionLabelClass}>
        {t('codex_live_sessions.transport_lane')}
      </div>
      <div className="grid gap-2 xl:grid-cols-4">
        {laneItems.map(([lane, label]) => (
          <div key={lane} className="min-h-[86px] border border-[color:color-mix(in_srgb,var(--gt-border-subtle)_55%,transparent)] bg-[var(--gt-surface-muted)] p-3">
            <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
              {label}
            </div>
            <div className="mt-2 grid gap-1">
              {lanes[lane].length === 0 ? (
                <span className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">{t('codex_live_sessions.no_event')}</span>
              ) : (
                lanes[lane].slice(0, 2).map((event) => (
                  <div key={event.id} className="grid grid-cols-[8px_1fr] gap-2">
                    <span className={`mt-1 h-2 w-2 ${severityDotClass(event.severity)}`} />
                    <span className="min-w-0 truncate text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                      {event.kind}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimingMetrics({
  session,
  request,
  selectedMetric,
  onSelectMetric,
  t,
}: {
  session: CodexLiveSession;
  request?: CodexLiveRequest;
  selectedMetric: CodexLiveTimingTrendMetric;
  onSelectMetric: (metric: CodexLiveTimingTrendMetric) => void;
  t: Translate;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const refreshID = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(refreshID);
  }, []);

  const averages = resolveCodexLiveTimingMetricSummary(session, request, { nowMs });
  const metrics = buildTimingMetricRows(averages, t);

  return (
    <div className={`${codexLiveMutedPanelClass} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className={codexLiveSectionLabelClass}>
          {t('codex_live_sessions.timing_average')}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => {
          const selected = metric.trendMetric === selectedMetric;
          const rowClassName = `grid min-h-12 min-w-0 grid-cols-[1fr_auto] items-end gap-2 border px-2.5 py-2 font-mono text-[length:var(--gt-font-size-xs)] transition-colors ${
            selected
              ? 'border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)] shadow-sm'
              : 'border-[color:color-mix(in_srgb,var(--gt-border-subtle)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--gt-surface-canvas)_58%,transparent)] text-[var(--gt-ink-muted)] hover:border-[color:color-mix(in_srgb,var(--gt-border-subtle)_46%,transparent)] hover:bg-[var(--gt-surface-muted)]'
          }`;

          const trendMetric = metric.trendMetric;
          if (!trendMetric) {
            return (
              <div key={metric.key} className={rowClassName}>
                <span className="min-w-0 truncate font-semibold">{metric.label}</span>
                <span className="font-semibold tabular-nums text-[var(--gt-ink-primary)]">{metric.value}</span>
              </div>
            );
          }

          return (
            <Button
              key={metric.key}
              size="small"
              className={`${rowClassName} text-left`}
              aria-pressed={selected}
              onClick={() => onSelectMetric(trendMetric)}
            >
              <span className="min-w-0 truncate font-semibold">{metric.label}</span>
              <span className="font-semibold tabular-nums text-[var(--gt-ink-primary)]">{metric.value}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

interface TimingMetricRow {
  key: string;
  label: string;
  value: string;
  trendMetric?: CodexLiveTimingTrendMetric;
}

function buildTimingMetricRows(averages: CodexLiveTimingMetricAverages, t: Translate): TimingMetricRow[] {
  const timing = averages.values;
  if (averages.sampleCount <= 0) {
    return [{ key: 'empty', label: t('codex_live_sessions.no_timing_data'), value: 'n/a' }];
  }

  const metricEntries: TimingMetricRow[] = [
    { key: 'firstEventMs', label: t('codex_live_sessions.timing_ttft'), value: formatOptionalDuration(timing.firstEventMs), trendMetric: 'firstEventMs' },
    { key: 'firstTokenMs', label: t('codex_live_sessions.timing_first_token'), value: formatOptionalDuration(timing.firstTokenMs), trendMetric: 'firstTokenMs' },
    { key: 'streamDurationMs', label: t('codex_live_sessions.timing_stream'), value: formatOptionalDuration(timing.streamDurationMs), trendMetric: 'streamDurationMs' },
    { key: 'queueWaitMs', label: t('codex_live_sessions.timing_queue'), value: formatOptionalDuration(timing.queueWaitMs), trendMetric: 'queueWaitMs' },
    { key: 'authSelectMs', label: t('codex_live_sessions.timing_auth'), value: formatOptionalDuration(timing.authSelectMs), trendMetric: 'authSelectMs' },
    { key: 'upstreamConnectMs', label: t('codex_live_sessions.timing_connect'), value: formatOptionalDuration(timing.upstreamConnectMs), trendMetric: 'upstreamConnectMs' },
    { key: 'averageEventGapMs', label: t('codex_live_sessions.timing_avg_gap'), value: formatOptionalDuration(timing.averageEventGapMs), trendMetric: 'averageEventGapMs' },
    { key: 'longestEventGapMs', label: t('codex_live_sessions.timing_max_gap'), value: formatOptionalDuration(timing.longestEventGapMs), trendMetric: 'longestEventGapMs' },
    { key: 'reconnectCount', label: t('codex_live_sessions.timing_reconnect'), value: formatOptionalCount(timing.reconnectCount) },
    { key: 'outputTokensPerSecond', label: t('codex_live_sessions.timing_output_rate'), value: formatOptionalRate(timing.outputTokensPerSecond) },
  ];
  const metrics = metricEntries.reduce<TimingMetricRow[]>((acc, entry) => {
    if (entry.value !== 'n/a') {
      acc.push(entry);
    }
    return acc;
  }, []);

  return metrics.length > 0 ? metrics : [{ key: 'empty', label: t('codex_live_sessions.no_timing_data'), value: 'n/a' }];
}

function formatOptionalCount(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }
  return `${Math.round(value)}`;
}

function AccountCard({ session, request, t }: { session: CodexLiveSession; request?: CodexLiveRequest; t: Translate }) {
  const authLabel = request?.authLabel || session.authLabel;
  const authID = request?.authID || session.authID;
  const provider = request?.provider || session.provider || 'codex';
  const proxyRoute = request?.proxyRoute;
  const usage = request?.usage;
  const quotaDisplay = buildLiveSessionQuotaDisplay(request?.quota);
  const billingDisplay = buildLiveSessionBillingDisplay(request?.billing);
  const title = authLabel || stripLiveAuthPrefix(authID) || t('codex_live_sessions.unknown_auth');
  const subtitle = authID || '';
  const transportLabel = `${session.downstreamTransport} → ${session.upstreamTransport}`;
  const badges: AttributionCardBadge[] = [
    { label: provider.toUpperCase(), tone: 'neutral' },
    { label: transportLabel, tone: session.fallbackInferred ? 'warning' : 'neutral' },
  ];
  if (proxyRoute) {
    badges.push({ label: proxyRoute, tone: 'neutral' });
  }

  const tone = request?.error
    ? 'critical'
    : session.fallbackInferred
      ? 'warning'
      : 'positive';
  const statusLabel = request?.error
    ? t('accounts.status_error_display')
    : session.fallbackInferred
      ? t('codex_live_sessions.inferred')
      : t('accounts.status_available');

  return (
    <AttributionCard
      t={t}
      title={title}
      subtitle={subtitle}
      eyebrow={statusLabel}
      failureReason={request?.error?.message || ''}
      badges={badges}
      usageSummary={buildLiveAccountUsageSummary(session, request)}
      quotaDisplay={quotaDisplay}
      billing={billingDisplay}
      tone={tone}
      density="full"
      interactive={false}
      onOpen={() => undefined}
    />
  );
}

function stripLiveAuthPrefix(authID?: string): string {
  return String(authID || '').replace(/^(auth-file|codex-api-key|openai-compatible):/i, '').trim();
}

function buildLiveAccountUsageSummary(session: CodexLiveSession, request?: CodexLiveRequest): AccountUsageSummary | undefined {
  const usage = request?.usage;
  if (!usage) {
    return undefined;
  }

  const failed = request?.status === 'failed' || Boolean(request?.error);
  const bucketStart = request?.startedAt || session.startedAt;
  return {
    source: 'attribution',
    hasData: true,
    requestCount: 1,
    failedCount: failed ? 1 : 0,
    success: failed ? 0 : 1,
    failure: failed ? 1 : 0,
    successRate: failed ? 0 : 1,
    averageLatencyMs: request?.timing?.totalDurationMs ?? null,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    lastActivityAt: Date.parse(request?.completedAt || session.lastEventAt || bucketStart) || null,
    attributionKey: request?.authID || session.authID || '',
    attributionKind: 'live-session',
    provider: request?.provider || session.provider || 'codex',
    requestedModels: [request?.model || session.model],
    trafficBuckets: [
      {
        start: bucketStart,
        requestCount: 1,
        failedCount: failed ? 1 : 0,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
    ],
    statusBar: {
      blocks: [failed ? 'failure' : 'success'],
      blockDetails: [],
      successRate: failed ? 0 : 1,
      totalSuccess: failed ? 0 : 1,
      totalFailure: failed ? 1 : 0,
    },
  };
}

function SessionCard({ session, request, t }: { session: CodexLiveSession; request?: CodexLiveRequest; t: Translate }) {
  const rows: Array<[string, string]> = [
    [t('codex_live_sessions.meta_session'), session.sessionID],
    [t('codex_live_sessions.meta_execution'), session.executionSessionID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.meta_client_request'), request?.clientRequestID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.meta_upstream_request'), request?.upstreamRequestID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.session_window'), session.codexWindowID || t('codex_live_sessions.unknown')],
  ];

  if (session.downstreamSessionID) {
    rows.push([t('codex_live_sessions.session_downstream'), session.downstreamSessionID]);
  }

  if (session.fallbackInferred) {
    rows.push([t('codex_live_sessions.meta_fallback'), `${session.fallbackConfidence || '?'} / ${session.fallbackReason || t('codex_live_sessions.unknown')}`]);
  }

  if (request?.connectionReused !== undefined) {
    rows.push([t('codex_live_sessions.session_connection'), request.connectionReused ? t('codex_live_sessions.connection_reused') : t('codex_live_sessions.connection_fresh')]);
  }

  rows.push(
    [t('codex_live_sessions.session_started'), session.startedAt],
    [t('codex_live_sessions.session_last_event'), session.lastEventAt],
  );

  return (
    <div className={`${codexLiveMutedPanelClass} p-3`}>
      <div className={codexLiveSectionLabelClass}>
        {t('codex_live_sessions.local_session')}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--gt-border-subtle)_30%,transparent)] py-1 text-[length:var(--gt-font-size-sm)]">
            <span className="shrink-0 font-mono font-semibold text-[var(--gt-ink-muted)]">{label}</span>
            <span className="truncate font-mono font-semibold text-[var(--gt-ink-primary)]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({
  requests,
  fallbackEvents,
  title,
  countLabel,
  t,
}: {
  requests: readonly CodexLiveRequest[];
  fallbackEvents: readonly CodexLiveTimelineEvent[];
  title?: string;
  countLabel?: string;
  t: Translate;
}) {
  const [detailTarget, setDetailTarget] = useState<
    | { type: 'request'; request: CodexLiveRequest }
    | { type: 'fallback'; events: readonly CodexLiveTimelineEvent[] }
    | null
  >(null);
  const fallbackSummary = buildFallbackTimelineSummary(fallbackEvents, t);
  const sortedRequests = sortRequestTimelineRequests(requests);
  const visibleRequests = sortedRequests.slice(0, requestTimelineVisibleLimit);
  const visibleRowCount = requests.length > 0 ? visibleRequests.length : 1;

  return (
    <section
      className={`${codexLivePanelClass} min-w-0 overflow-hidden`}
      data-codex-timeline-shell="session-style"
      data-codex-live-timeline-shell="true"
      aria-label={title ?? t('codex_live_sessions.request_timeline')}
    >
      <div className={`${codexLiveHeaderClass} grid w-full gap-1 px-4 py-3 text-left md:grid-cols-[minmax(0,1fr)_auto] md:items-end`}>
        <div className="min-w-0">
          <h3 className={codexLiveTitleTextClass}>
            {title ?? t('codex_live_sessions.request_timeline')}
          </h3>
          {title ? (
            <p className="mt-1 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
              {t('codex_live_sessions.request_timeline')}
            </p>
          ) : null}
        </div>
        <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
          {countLabel ?? `${visibleRowCount} ${t('codex_live_sessions.rows')}`}
        </div>
      </div>

      <div className="max-h-[clamp(12rem,42vh,34rem)] overflow-y-auto bg-[var(--gt-surface-canvas)] scrollbar-stable">
        {requests.length === 0 ? (
          <TimelineFallbackRow
            summary={fallbackSummary}
            t={t}
            onOpen={() => setDetailTarget({ type: 'fallback', events: fallbackEvents })}
          />
        ) : (
          visibleRequests.map((request) => (
            <TimelineRequestRow
              key={request.requestID}
              request={request}
              summary={buildRequestTimelineSummary(request)}
              t={t}
              onOpen={() => setDetailTarget({ type: 'request', request })}
            />
          ))
        )}
      </div>

      {detailTarget?.type === 'request' ? (
        <RequestTimelineDetailModal request={detailTarget.request} t={t} onClose={() => setDetailTarget(null)} />
      ) : null}

      {detailTarget?.type === 'fallback' ? (
        <FallbackTimelineDetailModal events={detailTarget.events} t={t} onClose={() => setDetailTarget(null)} />
      ) : null}
    </section>
  );
}

function TimelineRequestRow({
  request,
  summary,
  t,
  onOpen,
}: {
  request: CodexLiveRequest;
  summary: RequestTimelineSummary;
  t: Translate;
  onOpen: () => void;
}) {
  return (
    <TimelineSummaryRow
      summary={summary}
      t={t}
      onOpen={onOpen}
      historicalStatusLabel={request.historyState === 'historical_unclosed' ? t('codex_live_sessions.status_historical_unclosed') : ''}
    />
  );
}

function TimelineFallbackRow({
  summary,
  t,
  onOpen,
}: {
  summary: FallbackTimelineSummary;
  t: Translate;
  onOpen: () => void;
}) {
  return <TimelineSummaryRow summary={summary} t={t} onOpen={onOpen} fallback />;
}

function TimelineSummaryRow({
  summary,
  t,
  onOpen,
  historicalStatusLabel = '',
  fallback = false,
}: {
  summary: RequestTimelineSummary | FallbackTimelineSummary;
  t: Translate;
  onOpen: () => void;
  historicalStatusLabel?: string;
  fallback?: boolean;
}) {
  const timeRangeLabel = buildTimelineTimeRange(summary);
  const metricItems = buildTimelineMetricItems(summary);
  const requestIDLabel = formatTimelineRequestID(summary.requestID);

  return (
    <Button
      size="small"
      onClick={onOpen}
      className={`grid min-h-11 w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden border-b border-[color:color-mix(in_srgb,var(--gt-border-subtle)_20%,transparent)] px-3 py-2 text-left text-[length:var(--gt-font-size-sm)] transition-colors hover:bg-[var(--gt-surface-muted)] last:border-b-0 ${fallback ? 'bg-[color:color-mix(in_srgb,var(--gt-surface-muted)_54%,transparent)]' : ''}`}
      title={t('codex_live_sessions.detail')}
      aria-label={t('codex_live_sessions.detail')}
    >
      <span className="shrink-0 whitespace-nowrap font-mono font-semibold text-[var(--gt-ink-primary)]">
        {summary.sequenceLabel} · {summary.modelLabel}
      </span>
      <span className="shrink-0 whitespace-nowrap font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
        {requestIDLabel}
      </span>
      <span className="flex min-w-0 items-center gap-2 truncate whitespace-nowrap font-mono font-semibold text-[var(--gt-ink-primary)]">
        {historicalStatusLabel ? (
          <span className="shrink-0 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-1.5 py-0.5 text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            {historicalStatusLabel}
          </span>
        ) : null}
        {timeRangeLabel}
      </span>
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 overflow-hidden">
        {metricItems.map((item, index) => (
          <TimelineMetricPill key={item.label} label={item.label} value={item.value} priority={index} />
        ))}
      </div>
    </Button>
  );
}

function buildTimelineTimeRange(summary: RequestTimelineSummary | FallbackTimelineSummary): string {
  const started = isTimelineValuePresent(summary.startedAtLabel) ? summary.startedAtLabel : '';
  const completed = isTimelineValuePresent(summary.completedAtLabel) ? summary.completedAtLabel : '';
  if (started && completed && started !== completed) {
    return `${started}-${completed}`;
  }
  return started || completed;
}

function buildTimelineMetricItems(summary: RequestTimelineSummary | FallbackTimelineSummary): Array<{ label: string; value: string }> {
  return [
    { label: '总', value: summary.totalDurationLabel },
    { label: 'TTFT', value: summary.ttftLabel },
    { label: '首', value: summary.firstTokenLabel },
    { label: '流', value: summary.streamDurationLabel },
  ].filter((item) => isTimelineValuePresent(item.value));
}

function isTimelineValuePresent(value: string): boolean {
  return value !== '-' && value.toLowerCase() !== 'n/a';
}

function TimelineMetricPill({ label, value, priority }: { label: string; value: string; priority: number }) {
  const visibilityClass = priority >= 3 ? 'hidden xl:inline-flex' : 'inline-flex';
  return (
    <span className={`${visibilityClass} h-6 shrink-0 items-center gap-1 bg-[color:color-mix(in_srgb,var(--gt-border-subtle)_9%,transparent)] px-1.5 font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]`}>
      <span className="text-[var(--gt-ink-muted)]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function RequestTimelineDetailModal({
  request,
  t,
  onClose,
}: {
  request: CodexLiveRequest;
  t: Translate;
  onClose: () => void;
}) {
  const timing = request.timing;
  const usage = request.usage;
  const requestRows: Array<[string, string]> = [
    [t('codex_live_sessions.meta_client_request'), request.clientRequestID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.meta_upstream_request'), request.upstreamRequestID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.account_label'), request.authLabel || request.authID || t('codex_live_sessions.unknown_auth')],
    [t('codex_live_sessions.account_provider'), request.provider || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.account_transport'), `${request.downstreamTransport} → ${request.upstreamTransport}`],
  ];
  if (request.proxyRoute) {
    requestRows.push([t('codex_live_sessions.account_proxy'), request.proxyRoute]);
  }

  const metricRows: Array<[string, string]> = [
    [t('codex_live_sessions.timing_ttft'), formatOptionalDuration(timing?.firstEventMs)],
    [t('codex_live_sessions.timing_first_token'), formatOptionalDuration(timing?.firstTokenMs)],
    [t('codex_live_sessions.timing_output_rate'), formatOptionalRate(timing?.outputTokensPerSecond)],
    [t('codex_live_sessions.tokens_output'), usage ? usage.outputTokens.toLocaleString() : 'n/a'],
  ];

  return (
    <ModalFrame
      size="detail"
      onClose={onClose}
      ariaLabel={t('codex_live_sessions.request_timeline')}
      header={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-0.5 font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                {request.historyState === 'historical_unclosed'
                  ? t('codex_live_sessions.status_historical_unclosed')
                  : t(statusLabelKeys[request.status])}
              </span>
              <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                #{request.sequence} · {request.model}
              </span>
            </div>
            <div className="mt-2 truncate font-mono text-[length:var(--gt-font-size-xl)] font-semibold text-[var(--gt-ink-primary)]">
              {request.requestID}
            </div>
          </div>
          <div className="shrink-0 text-left font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)] sm:text-right">
            <div>{request.startedAt}</div>
            <div>{request.completedAt || (request.historyState === 'historical_unclosed' ? t('codex_live_sessions.status_historical_unclosed') : t('codex_live_sessions.status_streaming'))}</div>
          </div>
        </div>
      }
      footer={
        <div className="ml-auto">
          <Button size="small" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="grid gap-1">
            {requestRows.map(([label, value]) => (
              <RequestInfoRow key={label} label={label} value={value} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {metricRows.map(([label, value]) => (
              <MetricCell key={label} label={label} value={value} />
            ))}
          </div>
        </div>

        {request.error ? (
          <div className="border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,var(--gt-surface-canvas))] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-status-danger)]">
            {request.error.statusCode ? `${request.error.statusCode} ` : ''}
            {request.error.code ? `${request.error.code}: ` : ''}
            {request.error.message}
          </div>
        ) : null}

        <TimelineEventsPanel events={request.timeline} t={t} />
      </div>
    </ModalFrame>
  );
}

function FallbackTimelineDetailModal({
  events,
  t,
  onClose,
}: {
  events: readonly CodexLiveTimelineEvent[];
  t: Translate;
  onClose: () => void;
}) {
  return (
    <ModalFrame
      size="lg"
      onClose={onClose}
      ariaLabel={t('codex_live_sessions.unknown_request')}
      header={
        <div>
          <div className={codexLiveKickerTextClass}>
            {t('codex_live_sessions.request_timeline')}
          </div>
          <div className="mt-2 font-mono text-[length:var(--gt-font-size-xl)] font-semibold text-[var(--gt-ink-primary)]">
            {t('codex_live_sessions.unknown_request')}
          </div>
        </div>
      }
      footer={
        <div className="ml-auto">
          <Button size="small" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="p-4">
        <TimelineEventsPanel events={events} t={t} />
      </div>
    </ModalFrame>
  );
}

function TimelineEventsPanel({ events, t }: { events: readonly CodexLiveTimelineEvent[]; t: Translate }) {
  return (
    <div className={`${codexLiveMutedPanelClass} p-3`}>
      <div className={codexLiveSectionLabelClass}>
        {t('codex_live_sessions.request_timeline')}
      </div>
      <div className="mt-3 grid gap-2">
        {events.length === 0 ? (
          <span className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
            {t('codex_live_sessions.no_event')}
          </span>
        ) : (
          events.map((event) => <EventDetailLine key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}

function RequestInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-2 border-b border-[color:color-mix(in_srgb,var(--gt-border-subtle)_28%,transparent)] py-1 font-mono text-[length:var(--gt-font-size-sm)] md:grid-cols-[9.5rem_1fr]">
      <span className="font-semibold text-[var(--gt-ink-muted)]">{label}</span>
      <span className="min-w-0 truncate font-semibold text-[var(--gt-ink-primary)]">{value}</span>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${codexLiveMutedPanelClass} min-w-0 p-2`}>
      <div className="truncate font-mono text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">{value}</div>
      <div className="mt-1 truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">{label}</div>
    </div>
  );
}

function EventDetailLine({ event }: { event: CodexLiveTimelineEvent }) {
  return (
    <div className="grid min-w-0 grid-cols-[5.8rem_8px_minmax(8rem,10rem)_1fr] gap-2 border-b border-[color:color-mix(in_srgb,var(--gt-border-subtle)_28%,transparent)] pb-2 text-[length:var(--gt-font-size-sm)] last:border-b-0 last:pb-0">
      <span className="font-mono font-semibold text-[var(--gt-ink-muted)]">{event.at}</span>
      <span className={`mt-1.5 h-2 w-2 ${severityDotClass(event.severity)}`} />
      <span className="truncate font-mono font-semibold text-[var(--gt-ink-primary)]">
        {event.lane}.{event.kind}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[var(--gt-ink-muted)]">{event.label}</span>
        {event.detail ? (
          <span className="mt-1 block truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            {event.detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function StatusBadge({ status, t }: { status: CodexLiveSessionStatus; t: Translate }) {
  const tagColor =
    status === 'failed' || status === 'cancelled'
      ? 'error'
      : status === 'degraded_http' || status === 'reconnecting' || status === 'upstream_disconnected'
        ? 'warning'
        : status === 'active' || status === 'streaming'
          ? 'success'
          : 'default';
  return (
    <Tag color={tagColor} className="shrink-0 text-[length:var(--gt-font-size-sm)] font-normal">
      {t(statusLabelKeys[status])}
    </Tag>
  );
}
