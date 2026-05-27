import { useEffect, useRef, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import AttributionCard, { type AttributionCardBadge } from '../../accounts/components/AttributionCard';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import { groupTimelineByLane } from '../model/selectors';
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
  buildCodexLiveRequestTimingMetricAverages,
  buildCodexLiveRequestTimingTrend,
  type CodexLiveTimingMetricAverages,
  type CodexLiveRequestTimingTrendPoint,
  type CodexLiveTimingTrendMetric,
} from '../model/requestTimingTrend';

export function SessionDetail({
  session,
  request,
  loading = false,
  errorMessage,
  t,
}: {
  session?: CodexLiveSession;
  request?: CodexLiveRequest;
  loading?: boolean;
  errorMessage?: string;
  t: Translate;
}) {
  const [selectedTimingMetric, setSelectedTimingMetric] = useState<CodexLiveTimingTrendMetric>('totalDurationMs');

  if (!session) {
    return (
      <div className="grid w-full place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-6 shadow-[6px_6px_0_var(--shadow-color)]">
        <div className="max-w-sm text-center text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
          {t('codex_live_sessions.no_running_sessions')}
        </div>
      </div>
    );
  }

  const timeline = request?.timeline ?? session.recentEvents;

  return (
    <div className="grid min-w-0 w-full gap-5">
      <div className="grid min-w-0 gap-5">
        {loading || errorMessage ? (
          <div className="flex min-h-10 items-center justify-between gap-3 border border-dashed border-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase">
            <span className="text-[var(--text-muted)]">
              {loading ? t('codex_live_sessions.detail_loading') : t('codex_live_sessions.detail_stale')}
            </span>
            {errorMessage ? (
              <span className="min-w-0 truncate text-right text-[var(--color-status-warning)]">{errorMessage}</span>
            ) : null}
          </div>
        ) : null}
        <RequestTimingTrend session={session} request={request} selectedMetric={selectedTimingMetric} t={t} />
        <TimingMetrics
          session={session}
          request={request}
          selectedMetric={selectedTimingMetric}
          onSelectMetric={setSelectedTimingMetric}
          t={t}
        />
        <Timeline requests={session.requests} fallbackEvents={timeline} t={t} />
      </div>

      <div className="grid min-w-0 gap-5">
        <AccountCard session={session} request={request} t={t} />
        <SessionCard session={session} request={request} t={t} />
        <TransportLane events={timeline} t={t} />
      </div>
    </div>
  );
}

const timingTrendSeries: Array<{ id: CodexLiveTimingTrendMetric; labelKey: string; color: string }> = [
  { id: 'totalDurationMs', labelKey: 'codex_live_sessions.timing_total', color: 'var(--color-chart-primary)' },
  { id: 'firstEventMs', labelKey: 'codex_live_sessions.timing_ttft', color: 'var(--color-chart-blue)' },
  { id: 'firstTokenMs', labelKey: 'codex_live_sessions.timing_first_token', color: 'var(--color-chart-peak)' },
  { id: 'streamDurationMs', labelKey: 'codex_live_sessions.timing_stream', color: 'var(--color-status-success)' },
  { id: 'queueWaitMs', labelKey: 'codex_live_sessions.timing_queue', color: 'var(--color-status-warning)' },
  { id: 'authSelectMs', labelKey: 'codex_live_sessions.timing_auth', color: 'var(--color-chart-attribution)' },
  { id: 'upstreamConnectMs', labelKey: 'codex_live_sessions.timing_connect', color: 'var(--color-chart-secondary)' },
  { id: 'averageEventGapMs', labelKey: 'codex_live_sessions.timing_avg_gap', color: 'var(--color-status-warning-soft)' },
  { id: 'longestEventGapMs', labelKey: 'codex_live_sessions.timing_max_gap', color: 'var(--color-status-danger)' },
];
const requestTimelineVisibleLimit = 15;
const timingTrendAudioBarStepPx = 12;
const timingTrendAudioMinVisibleBars = 12;
const timingTrendAudioAxisLabelEvery = 5;
const timingTrendYAxisLabelSafeWidthPx = 48;
const timingTrendLiveRingMaxRadiusPx = 28;
const timingTrendLiveRingSafeInsetPx = timingTrendLiveRingMaxRadiusPx + 10;
const timingTrendAxisLabelMinGapPx = 36;

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

  return (
    <section className="min-w-0" aria-label={t('codex_live_sessions.request_timing_trend')}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={session.status} t={t} />
        {session.fallbackInferred ? <span className="badge-swiss">{t('codex_live_sessions.inferred')}</span> : null}
        <span className="min-w-0 max-w-full truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          {currentRequestID}
        </span>
      </div>

      <div className="mt-3 grid min-h-[166px] gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-mono text-[length:var(--font-size-ui-lg)] font-black uppercase tracking-normal text-[var(--text-primary)]">
            {t('codex_live_sessions.request_timing_trend')}
          </h3>
          <span className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
            {session.model} · {session.downstreamTransport} → {session.upstreamTransport}
          </span>
        </div>

        <TimingTrendChart
          trend={trend}
          selectedMetric={selectedMetric}
          selectedRequestID={request?.requestID || session.lastRequestID || ''}
          t={t}
        />

        <div className="grid gap-2 border-t border-[color:color-mix(in_srgb,var(--border-color)_30%,transparent)] pt-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
            <TimingTrendFooterItem label={t('codex_live_sessions.duration')} value={formatDuration(session.durationMs)} />
            <TimingTrendFooterItem label={t('codex_live_sessions.requests')} value={`${session.requestCount}`} />
            <TimingTrendFooterItem label={t('codex_live_sessions.latest_sample')} value={latestPoint?.label || t('codex_live_sessions.timing_trend_empty')} />
          </div>

          <div className="flex min-w-0 flex-wrap justify-start gap-x-4 gap-y-2 md:justify-end">
            <div className="grid grid-cols-[0.75rem_auto_auto] items-center gap-2 font-mono text-[length:var(--font-size-ui-xs)] uppercase">
              <span className="h-2 w-2" style={{ backgroundColor: selectedSeries.color }} />
              <span className="font-black text-[var(--text-muted)]">{t(selectedSeries.labelKey)}</span>
              <span className="font-black text-[var(--text-primary)]">
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
    <div className="min-w-0 font-mono text-[length:var(--font-size-ui-xs)] uppercase">
      <span className="mr-2 font-black text-[var(--text-muted)]">{label}</span>
      <span className="font-black text-[var(--text-primary)]">{value}</span>
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
  const chartHeight = 224;
  const chartTopInset = 38;
  const chartBottomInset = 54;
  const height = chartHeight;
  const padding = resolveTimingTrendChartPadding(chartTopInset, chartBottomInset);
  const gridY = [0, 0.5, 1];
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const selectedSeries = getTimingTrendSeries(selectedMetric);
  const width = Math.max(320, chartWidth || 0);
  const visibleRequestCount = resolveTimingTrendVisibleRequestCount(width, padding);
  const visiblePoints = trend.points.slice(-visibleRequestCount);
  const selectedMetricMaxMs = getTimingTrendMetricMax(visiblePoints, selectedMetric);
  const waveformBars = buildTimingTrendWaveformBars(visiblePoints, selectedMetric, selectedMetricMaxMs, width, height, padding);
  const waveformMarkers = waveformBars.filter((bar, index) => shouldShowTimingTrendMarker(bar.point, index, waveformBars.length, selectedRequestID));
  const axisLabelIndexes = resolveTimingTrendAxisLabelIndexes(waveformBars, selectedRequestID);

  useEffect(() => {
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
      <div className="mt-3 grid h-[224px] place-items-center border-2 border-dashed border-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)] bg-[var(--bg-main)] font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-muted)]">
        {t('codex_live_sessions.timing_trend_empty')}
      </div>
    );
  }

  return (
    <div
      className="mt-3 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[inset_0_12px_16px_-12px_var(--shadow-inset-color),inset_0_-12px_16px_-12px_var(--shadow-inset-color)]"
      role="img"
      aria-label={t('codex_live_sessions.request_timing_trend')}
    >
      <div
        ref={chartShellRef}
        className="relative h-full w-full"
        style={{
          height: `${chartHeight}px`,
          width: '100%',
          backgroundImage:
            'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), var(--color-chart-grid) calc(25% - 1px), var(--color-chart-grid) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), var(--color-chart-grid) calc(50% - 1px), var(--color-chart-grid) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), var(--color-chart-grid) calc(75% - 1px), var(--color-chart-grid) 75%, transparent 75%), linear-gradient(to right, transparent 0, transparent 19px, var(--color-chart-grid-subtle) 19px, var(--color-chart-grid-subtle) 20px), repeating-linear-gradient(to right, transparent 0, transparent 79px, var(--color-chart-grid-subtle) 79px, var(--color-chart-grid-subtle) 80px)',
        }}
      >
        <style>{`
          @keyframes codex-live-strip-enter {
            0% { opacity: 0.56; }
            100% { opacity: 1; }
          }
          @keyframes codex-live-point-pop {
            0% { transform: translate(-50%, -50%) scale(0.86); opacity: 0.42; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }
          @keyframes codex-live-ring-breathe {
            0%, 100% { opacity: 0.28; stroke-width: 1.25; }
            50% { opacity: 0.82; stroke-width: 2.25; }
          }
        `}</style>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {gridY.map((ratio) => {
            const y = trendChartY(ratio * selectedMetricMaxMs, selectedMetricMaxMs, height, padding);
            return (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--color-chart-grid-strong)" strokeWidth="1" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" className="fill-[var(--text-muted)] font-mono text-[10px] font-black">
                  {formatDuration(ratio * selectedMetricMaxMs)}
                </text>
              </g>
            );
          })}

          {waveformBars.map(({ point, x }, index) => {
            const showAxisLabel = axisLabelIndexes.has(index);
            return (
              <g key={`${point.requestID}-axis`}>
                {showAxisLabel ? (
                  <>
                    <line
                      x1={x}
                      x2={x}
                      y1={padding.top}
                      y2={height - padding.bottom + 7}
                      stroke="var(--color-chart-grid-strong)"
                      strokeWidth={point.isLive ? 1.5 : 1}
                      strokeDasharray={point.isLive ? '4 3' : undefined}
                    />
                    <text
                      x={x}
                      y={height - 18}
                      textAnchor="middle"
                      className="fill-[var(--text-muted)] font-mono text-[10px] font-black"
                    >
                      #{point.sequence}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}

          <g key={`${selectedMetric}-audio-waveform-layer`} style={{ animation: 'codex-live-strip-enter 240ms ease-out' }}>
            {waveformBars.map(({ point, x, centerY, topY, bottomY, amplitude, value }) => (
              <g key={`${point.requestID}-waveform-bar`}>
                <line
                  x1={x}
                  x2={x}
                  y1={topY}
                  y2={bottomY}
                  stroke={selectedSeries.color}
                  strokeLinecap="round"
                  strokeWidth={point.requestID === selectedRequestID ? 10 : 7}
                  opacity={point.requestID === selectedRequestID ? 0.8 : 0.5}
                />
                <line
                  x1={x}
                  x2={x}
                  y1={centerY - Math.max(3, amplitude * 0.22)}
                  y2={centerY + Math.max(3, amplitude * 0.22)}
                  stroke={selectedSeries.color}
                  strokeLinecap="round"
                  strokeWidth={point.requestID === selectedRequestID ? 3 : 2}
                  opacity="0.9"
                />
                <circle
                  cx={x}
                  cy={centerY}
                  r={point.requestID === selectedRequestID ? 3.6 : 2.8}
                  fill="var(--bg-main)"
                  stroke={selectedSeries.color}
                  strokeWidth={point.requestID === selectedRequestID ? 2.5 : 2}
                >
                  <title>{`${point.label} · ${t(selectedSeries.labelKey)} ${formatDuration(value)}`}</title>
                </circle>
                {point.isLive ? (
                  <circle
                    cx={x}
                    cy={centerY}
                    r={Math.max(12, Math.min(28, amplitude + 6))}
                    fill="none"
                    stroke={selectedSeries.color}
                    strokeDasharray="2 3"
                    strokeWidth="1.75"
                    opacity="0.68"
                    style={{ animation: 'codex-live-ring-breathe 1.8s ease-in-out infinite' }}
                  />
                ) : null}
              </g>
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0">
          {waveformMarkers.map(({ point, x, topY, value }) => (
              <TimingTrendPoint
                key={point.requestID}
                x={x}
                y={topY}
                label={formatDuration(value)}
                helper={`#${point.sequence}`}
                color={selectedSeries.color}
                selected={point.requestID === selectedRequestID}
                live={point.isLive}
              />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimingTrendPoint({
  x,
  y,
  label,
  helper,
  color,
  selected,
  live,
}: {
  x: number;
  y: number;
  label: string;
  helper: string;
  color: string;
  selected: boolean;
  live: boolean;
}) {
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        ...buildTimingTrendPointStyle(x, y),
        animation: selected || live ? 'codex-live-point-pop 220ms cubic-bezier(0.22,1,0.36,1)' : undefined,
      }}
    >
      <div
        className="absolute bottom-full mb-3 whitespace-nowrap text-center font-mono font-black transition-colors"
        style={{
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: selected ? 'var(--font-size-ui-md)' : 'var(--font-size-ui-md-compact)',
        }}
      >
        {label}
      </div>
      {selected ? <div className="absolute h-8 w-8 rounded-full bg-[var(--text-primary)] opacity-10" /> : null}
      <div
        className={`relative rounded-full border-2 border-[var(--bg-main)] bg-[var(--color-chart-primary)] shadow-sm ${
          selected ? 'h-3.5 w-3.5' : live ? 'h-3 w-3' : 'h-2.5 w-2.5'
        }`}
        style={{ backgroundColor: color }}
      />
      <div
        className="absolute top-7 whitespace-nowrap font-mono font-black uppercase text-[length:var(--font-size-ui-sm)]"
        style={{ color: selected ? 'var(--text-primary)' : 'var(--text-muted)', opacity: selected ? 1 : 0.65 }}
      >
        {helper}
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
    right: timingTrendLiveRingSafeInsetPx,
    bottom,
    left: timingTrendYAxisLabelSafeWidthPx + 8,
  };
}

interface TimingTrendWaveformBar {
  point: CodexLiveRequestTimingTrendPoint;
  x: number;
  centerY: number;
  topY: number;
  bottomY: number;
  amplitude: number;
  value: number;
}

function buildTimingTrendWaveformBars(
  points: readonly CodexLiveRequestTimingTrendPoint[],
  metric: CodexLiveTimingTrendMetric,
  maxMs: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): TimingTrendWaveformBar[] {
  const chartHeight = height - padding.top - padding.bottom;
  const centerY = padding.top + chartHeight / 2;
  const maxAmplitude = Math.max(6, chartHeight / 2 - 8);
  return points.flatMap((point, index) => {
    const value = point.values[metric];
    if (value === null) {
      return [];
    }
    const ratio = maxMs > 0 ? Math.min(1, Math.max(0, value / maxMs)) : 0;
    const amplitude = Math.max(4, maxAmplitude * ratio);
    const x = resolveTimingTrendBarX(index, points.length, width, padding);
    return {
      point,
      value,
      x,
      centerY,
      amplitude,
      topY: centerY - amplitude,
      bottomY: centerY + amplitude,
    };
  });
}

function resolveTimingTrendVisibleRequestCount(
  width: number,
  padding: { right: number; left: number },
): number {
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  return Math.max(timingTrendAudioMinVisibleBars, Math.floor(plotWidth / timingTrendAudioBarStepPx));
}

function resolveTimingTrendBarX(
  index: number,
  visibleCount: number,
  width: number,
  padding: { right: number; left: number },
): number {
  const plotRight = width - padding.right;
  const visibleWidth = Math.max(0, (visibleCount - 1) * timingTrendAudioBarStepPx);
  return plotRight - visibleWidth + index * timingTrendAudioBarStepPx;
}

function shouldShowTimingTrendMarker(
  point: CodexLiveRequestTimingTrendPoint,
  index: number,
  visibleCount: number,
  selectedRequestID: string,
): boolean {
  return visibleCount <= 8 || point.requestID === selectedRequestID || point.isLive || index === visibleCount - 1;
}

function resolveTimingTrendAxisLabelIndexes(
  bars: readonly TimingTrendWaveformBar[],
  selectedRequestID: string,
): Set<number> {
  const labelIndexes = new Set<number>();
  if (bars.length <= 8) {
    bars.forEach((_, index) => labelIndexes.add(index));
    return labelIndexes;
  }

  const canAddBar = (bar: TimingTrendWaveformBar) => {
    const existingXs = Array.from(labelIndexes, (existingIndex) => bars[existingIndex]?.x ?? Number.NEGATIVE_INFINITY);
    return existingXs.every((existingX) => Math.abs(bar.x - existingX) >= timingTrendAxisLabelMinGapPx);
  };
  const addLabelIndex = (index: number, force = false) => {
    const bar = bars[index];
    if (!bar) {
      return;
    }
    if (force || canAddBar(bar)) {
      labelIndexes.add(index);
    }
  };

  addLabelIndex(bars.length - 1, true);
  bars.forEach((bar, index) => {
    if (bar.point.isLive || bar.point.requestID === selectedRequestID) {
      addLabelIndex(index, index === bars.length - 1);
    }
  });
  for (let index = bars.length - 1; index >= 0; index -= 1) {
    const bar = bars[index];
    if (bar && shouldShowTimingTrendAxisLabel(bar.point)) {
      addLabelIndex(index);
    }
  }
  return labelIndexes;
}

function shouldShowTimingTrendAxisLabel(
  point: CodexLiveRequestTimingTrendPoint,
): boolean {
  return point.sequence % timingTrendAudioAxisLabelEvery === 0;
}

function buildTimingTrendPointStyle(x: number, y: number) {
  return {
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
  };
}

function trendChartY(
  value: number,
  maxMs: number,
  height: number,
  padding: { top: number; bottom: number },
): number {
  const chartHeight = height - padding.top - padding.bottom;
  const ratio = maxMs > 0 ? Math.min(1, Math.max(0, value / maxMs)) : 0;
  return padding.top + chartHeight - chartHeight * ratio;
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
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.transport_lane')}
      </div>
      <div className="grid gap-2 xl:grid-cols-4">
        {laneItems.map(([lane, label]) => (
          <div key={lane} className="min-h-[86px] border border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[var(--bg-surface)] p-3">
            <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-primary)]">
              {label}
            </div>
            <div className="mt-2 grid gap-1">
              {lanes[lane].length === 0 ? (
                <span className="text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">{t('codex_live_sessions.no_event')}</span>
              ) : (
                lanes[lane].slice(0, 2).map((event) => (
                  <div key={event.id} className="grid grid-cols-[8px_1fr] gap-2">
                    <span className={`mt-1 h-2 w-2 ${severityDotClass(event.severity)}`} />
                    <span className="min-w-0 truncate text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
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

  const averages = buildCodexLiveRequestTimingMetricAverages(session.requests, request, { nowMs });
  const metrics = buildTimingMetricRows(averages, t);

  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.timing')}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const selected = metric.trendMetric === selectedMetric;
          const rowClassName = `flex min-w-0 justify-between gap-3 border-b py-1 font-mono text-[length:var(--font-size-ui-sm)] uppercase transition-colors ${
            selected
              ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
              : 'border-[color:color-mix(in_srgb,var(--border-color)_30%,transparent)] text-[var(--text-muted)]'
          }`;

          const trendMetric = metric.trendMetric;
          if (!trendMetric) {
            return (
              <div key={metric.key} className={rowClassName}>
                <span className="font-black">{metric.label}</span>
                <span className="truncate font-black text-[var(--text-primary)]">{metric.value}</span>
              </div>
            );
          }

          return (
            <button
              key={metric.key}
              type="button"
              className={`${rowClassName} text-left active:scale-95`}
              aria-pressed={selected}
              onClick={() => onSelectMetric(trendMetric)}
            >
              <span className="font-black">{metric.label}</span>
              <span className="truncate font-black text-[var(--text-primary)]">{metric.value}</span>
            </button>
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
    { key: 'totalDurationMs', label: t('codex_live_sessions.timing_total'), value: formatOptionalDuration(timing.totalDurationMs), trendMetric: 'totalDurationMs' },
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
    { key: 'totalTokensPerSecond', label: t('codex_live_sessions.timing_total_rate'), value: formatOptionalRate(timing.totalTokensPerSecond) },
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
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.local_session')}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-color)_30%,transparent)] py-1 text-[length:var(--font-size-ui-sm)]">
            <span className="shrink-0 font-mono font-black uppercase text-[var(--text-muted)]">{label}</span>
            <span className="truncate font-mono font-bold text-[var(--text-primary)]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({
  requests,
  fallbackEvents,
  t,
}: {
  requests: readonly CodexLiveRequest[];
  fallbackEvents: readonly CodexLiveTimelineEvent[];
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
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {t('codex_live_sessions.request_timeline')}
        </div>
        <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          {visibleRowCount} {t('codex_live_sessions.rows')}
        </div>
      </div>

      <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
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
    </div>
  );
}

function TimelineRequestRow({
  summary,
  t,
  onOpen,
}: {
  summary: RequestTimelineSummary;
  t: Translate;
  onOpen: () => void;
}) {
  return <TimelineSummaryRow summary={summary} t={t} onOpen={onOpen} />;
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
  return <TimelineSummaryRow summary={summary} t={t} onOpen={onOpen} dashed />;
}

function TimelineSummaryRow({
  summary,
  t,
  onOpen,
  dashed = false,
}: {
  summary: RequestTimelineSummary | FallbackTimelineSummary;
  t: Translate;
  onOpen: () => void;
  dashed?: boolean;
}) {
  const timeRangeLabel = buildTimelineTimeRange(summary);
  const metricItems = buildTimelineMetricItems(summary);
  const requestIDLabel = formatTimelineRequestID(summary.requestID);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid min-h-10 w-full grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-2 overflow-hidden border-b border-[color:color-mix(in_srgb,var(--border-color)_35%,transparent)] px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] transition-colors hover:bg-[var(--bg-main)] active:scale-[0.995] last:border-b-0 ${dashed ? 'border-dashed' : ''}`}
      title={t('codex_live_sessions.detail')}
      aria-label={t('codex_live_sessions.detail')}
    >
      <span className="shrink-0 whitespace-nowrap font-mono font-black text-[var(--text-primary)]">
        {summary.sequenceLabel} · {summary.modelLabel}
      </span>
      <span className="shrink-0 whitespace-nowrap font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
        {requestIDLabel}
      </span>
      <span className="min-w-0 truncate whitespace-nowrap font-mono font-black text-[var(--text-primary)]">
        {timeRangeLabel}
      </span>
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 overflow-hidden">
        {metricItems.map((item, index) => (
          <TimelineMetricPill key={item.label} label={item.label} value={item.value} priority={index} />
        ))}
      </div>
    </button>
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
    <span className={`${visibilityClass} h-6 shrink-0 items-center gap-1 border border-[color:color-mix(in_srgb,var(--border-color)_42%,transparent)] bg-[var(--bg-main)] px-1.5 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]`}>
      <span className="text-[var(--text-muted)]">{label}</span>
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
    [t('codex_live_sessions.timing_total'), formatOptionalDuration(timing?.totalDurationMs)],
    [t('codex_live_sessions.timing_ttft'), formatOptionalDuration(timing?.firstEventMs)],
    [t('codex_live_sessions.timing_first_token'), formatOptionalDuration(timing?.firstTokenMs)],
    [t('codex_live_sessions.timing_output_rate'), formatOptionalRate(timing?.outputTokensPerSecond)],
    [t('codex_live_sessions.tokens_total'), usage ? usage.totalTokens.toLocaleString() : 'n/a'],
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
              <span className="border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-0.5 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]">
                {t(statusLabelKeys[request.status])}
              </span>
              <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
                #{request.sequence} · {request.model}
              </span>
            </div>
            <div className="mt-2 truncate font-mono text-[length:var(--font-size-ui-xl)] font-black text-[var(--text-primary)]">
              {request.requestID}
            </div>
          </div>
          <div className="shrink-0 text-left font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] sm:text-right">
            <div>{request.startedAt}</div>
            <div>{request.completedAt || t('codex_live_sessions.status_streaming')}</div>
          </div>
        </div>
      }
      footer={
        <div className="ml-auto">
          <button type="button" onClick={onClose} className="btn-swiss active:scale-95">
            {t('common.close')}
          </button>
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
          <div className="border-2 border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--bg-main))] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--color-danger)]">
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
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('codex_live_sessions.request_timeline')}
          </div>
          <div className="mt-2 font-mono text-[length:var(--font-size-ui-xl)] font-black text-[var(--text-primary)]">
            {t('codex_live_sessions.unknown_request')}
          </div>
        </div>
      }
      footer={
        <div className="ml-auto">
          <button type="button" onClick={onClose} className="btn-swiss active:scale-95">
            {t('common.close')}
          </button>
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
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.request_timeline')}
      </div>
      <div className="mt-3 grid gap-2">
        {events.length === 0 ? (
          <span className="text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
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
    <div className="grid min-w-0 gap-2 border-b border-[color:color-mix(in_srgb,var(--border-color)_28%,transparent)] py-1 font-mono text-[length:var(--font-size-ui-sm)] md:grid-cols-[9.5rem_1fr]">
      <span className="font-black uppercase text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 truncate font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)] bg-[var(--bg-main)] p-2">
      <div className="truncate font-mono text-[length:var(--font-size-ui-lg)] font-black text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

function EventDetailLine({ event }: { event: CodexLiveTimelineEvent }) {
  return (
    <div className="grid min-w-0 grid-cols-[5.8rem_8px_minmax(8rem,10rem)_1fr] gap-2 border-b border-[color:color-mix(in_srgb,var(--border-color)_28%,transparent)] pb-2 text-[length:var(--font-size-ui-sm)] last:border-b-0 last:pb-0">
      <span className="font-mono font-black text-[var(--text-muted)]">{event.at}</span>
      <span className={`mt-1.5 h-2 w-2 ${severityDotClass(event.severity)}`} />
      <span className="truncate font-mono font-black uppercase text-[var(--text-primary)]">
        {event.lane}.{event.kind}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-[var(--text-muted)]">{event.label}</span>
        {event.detail ? (
          <span className="mt-1 block truncate font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
            {event.detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function StatusBadge({ status, t }: { status: CodexLiveSessionStatus; t: Translate }) {
  const tone =
    status === 'failed' || status === 'cancelled'
      ? 'bg-[color-mix(in_srgb,var(--color-danger)_14%,var(--bg-main))]'
      : status === 'degraded_http' || status === 'reconnecting' || status === 'upstream_disconnected'
        ? 'bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--bg-main))]'
        : status === 'active' || status === 'streaming'
          ? 'bg-[color-mix(in_srgb,var(--color-success)_12%,var(--bg-main))]'
          : 'bg-[var(--bg-surface)]';
  return (
    <span className={`shrink-0 border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase ${tone}`}>
      {t(statusLabelKeys[status])}
    </span>
  );
}
