import { Info } from 'lucide-react';
import { useState } from 'react';
import SnippetPre from '../../../components/ui/SnippetPre';
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
  type FallbackTimelineSummary,
  type RequestTimelineSummary,
} from './requestTimelineSummary';
import type { Translate } from './types';

export function SessionDetail({
  session,
  request,
  diagnostic,
  t,
}: {
  session?: CodexLiveSession;
  request?: CodexLiveRequest;
  diagnostic: string;
  t: Translate;
}) {
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
    <div className="min-w-0 w-full border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
      <div className="grid gap-3 border-b-2 border-[var(--border-color)] p-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} t={t} />
            {session.fallbackInferred ? <span className="badge-swiss">{t('codex_live_sessions.inferred')}</span> : null}
          </div>
          <h3 className="mt-3 truncate font-mono text-[length:var(--font-size-ui-5xl)] font-black tracking-normal text-[var(--text-primary)]">
            {request?.requestID || session.lastRequestID || session.sessionID}
          </h3>
          <p className="mt-1 truncate text-[length:var(--font-size-ui-lg)] font-bold text-[var(--text-muted)]">
            {session.model} · {session.downstreamTransport} → {session.upstreamTransport}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-muted)]">
          <span>{t('codex_live_sessions.duration')}</span>
          <span className="text-[var(--text-primary)]">{formatDuration(session.durationMs)}</span>
          <span>{t('codex_live_sessions.requests')}</span>
          <span className="text-[var(--text-primary)]">{session.requestCount}</span>
        </div>
      </div>

      <div className="grid gap-5 p-4">
        <AccountCard session={session} request={request} t={t} />
        <SessionCard session={session} request={request} t={t} />
        <TransportLane events={timeline} t={t} />
        <TimingMetrics request={request} t={t} />
        <Timeline requests={session.requests} fallbackEvents={timeline} t={t} />
        <DiagnosticSummary diagnostic={diagnostic} t={t} />
      </div>
    </div>
  );
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

function TimingMetrics({ request, t }: { request?: CodexLiveRequest; t: Translate }) {
  const timing = request?.timing;
  const metrics = [
    [t('codex_live_sessions.timing_queue'), formatOptionalDuration(timing?.queueWaitMs)],
    [t('codex_live_sessions.timing_auth'), formatOptionalDuration(timing?.authSelectMs)],
    [t('codex_live_sessions.timing_connect'), formatOptionalDuration(timing?.upstreamConnectMs)],
    [t('codex_live_sessions.timing_ttft'), formatOptionalDuration(timing?.firstEventMs)],
    [t('codex_live_sessions.timing_first_token'), formatOptionalDuration(timing?.firstTokenMs)],
    [t('codex_live_sessions.timing_stream'), formatOptionalDuration(timing?.streamDurationMs)],
    [t('codex_live_sessions.timing_total'), formatOptionalDuration(timing?.totalDurationMs)],
    [t('codex_live_sessions.timing_output_rate'), formatOptionalRate(timing?.outputTokensPerSecond)],
    [t('codex_live_sessions.timing_total_rate'), formatOptionalRate(timing?.totalTokensPerSecond)],
    [t('codex_live_sessions.timing_avg_gap'), formatOptionalDuration(timing?.averageEventGapMs)],
    [t('codex_live_sessions.timing_max_gap'), formatOptionalDuration(timing?.longestEventGapMs)],
    [t('codex_live_sessions.timing_reconnect'), `${timing?.reconnectCount ?? 0}`],
  ];

  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.timing')}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex min-w-0 justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-color)_30%,transparent)] py-1 font-mono text-[length:var(--font-size-ui-sm)] uppercase">
            <span className="font-black text-[var(--text-muted)]">{label}</span>
            <span className="truncate font-black text-[var(--text-primary)]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
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

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {t('codex_live_sessions.request_timeline')}
        </div>
        <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          {requests.length > 0 ? requests.length : 1} {t('codex_live_sessions.rows')}
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
          requests.map((request) => (
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
  const metricItems = buildTimelineMetricItems(summary, t);

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:color-mix(in_srgb,var(--border-color)_35%,transparent)] px-3 py-2 text-[length:var(--font-size-ui-sm)] last:border-b-0 ${dashed ? 'border-dashed' : ''}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 max-w-[18rem] truncate font-mono font-black text-[var(--text-primary)]">
          {summary.sequenceLabel} · {summary.modelLabel}
        </span>
        <span className="min-w-0 max-w-[16rem] truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          {summary.requestID}
        </span>
        {timeRangeLabel ? (
          <span className="shrink-0 font-mono font-black text-[var(--text-primary)]">
            {timeRangeLabel}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {metricItems.map((item) => (
            <TimelineMetricPill key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="btn-swiss inline-flex h-8 w-8 items-center justify-center justify-self-end !p-0 active:scale-95"
        title={t('codex_live_sessions.detail')}
        aria-label={t('codex_live_sessions.detail')}
      >
        <Info className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function buildTimelineTimeRange(summary: RequestTimelineSummary | FallbackTimelineSummary): string {
  const started = isTimelineValuePresent(summary.startedAtLabel) ? summary.startedAtLabel : '';
  const completed = isTimelineValuePresent(summary.completedAtLabel) ? summary.completedAtLabel : '';
  if (started && completed && started !== completed) {
    return `${started} - ${completed}`;
  }
  return started || completed;
}

function buildTimelineMetricItems(summary: RequestTimelineSummary | FallbackTimelineSummary, t: Translate): Array<{ label: string; value: string }> {
  return [
    { label: t('codex_live_sessions.timing_total'), value: summary.totalDurationLabel },
    { label: t('codex_live_sessions.timing_ttft'), value: summary.ttftLabel },
    { label: t('codex_live_sessions.timing_first_token'), value: summary.firstTokenLabel },
    { label: t('codex_live_sessions.timing_stream'), value: summary.streamDurationLabel },
    { label: t('codex_live_sessions.timing_avg_gap'), value: summary.averageGapLabel },
    { label: t('codex_live_sessions.timing_max_gap'), value: summary.longestGapLabel },
  ].filter((item) => isTimelineValuePresent(item.value));
}

function isTimelineValuePresent(value: string): boolean {
  return value !== '-' && value.toLowerCase() !== 'n/a';
}

function TimelineMetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 border border-[color:color-mix(in_srgb,var(--border-color)_42%,transparent)] bg-[var(--bg-main)] px-1.5 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]">
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

function DiagnosticSummary({ diagnostic, t }: { diagnostic: string; t: Translate }) {
  return (
    <div className="grid gap-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.redacted_diagnostic')}
      </div>
      <SnippetPre className="max-h-[260px] border-2 border-[var(--border-color)] !bg-[var(--bg-surface)] !text-[length:var(--font-size-ui-sm)]">
        {diagnostic}
      </SnippetPre>
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
