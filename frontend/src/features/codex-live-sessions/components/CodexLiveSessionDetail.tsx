import SnippetPre from '../../../components/ui/SnippetPre';
import { BillingBalance, QuotaBars } from '../../accounts/components/CardSections';
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
        <Timeline events={timeline} t={t} />
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
  const provider = request?.provider || session.provider;
  const proxyRoute = request?.proxyRoute;
  const usage = request?.usage;
  const quotaDisplay = buildLiveSessionQuotaDisplay(request?.quota);
  const billingDisplay = buildLiveSessionBillingDisplay(request?.billing);

  const accountRows: Array<[string, string]> = [
    [t('codex_live_sessions.account_label'), authLabel || authID || t('codex_live_sessions.unknown_auth')],
    [t('codex_live_sessions.account_id'), authID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.account_provider'), provider || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.account_transport'), `${session.downstreamTransport} → ${session.upstreamTransport}`],
  ];
  if (proxyRoute) {
    accountRows.push([t('codex_live_sessions.account_proxy'), proxyRoute]);
  }

  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.account_routing')}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2">
        {accountRows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-color)_30%,transparent)] py-1 text-[length:var(--font-size-ui-sm)]">
            <span className="shrink-0 font-mono font-black uppercase text-[var(--text-muted)]">{label}</span>
            <span className="truncate font-mono font-bold text-[var(--text-primary)]">{value}</span>
          </div>
        ))}
      </div>

      {quotaDisplay ? (
        <div className="mt-4">
          <QuotaBars quotaDisplay={quotaDisplay} t={t} />
        </div>
      ) : null}

      {billingDisplay ? (
        <div className="mt-4">
          <BillingBalance billing={billingDisplay} />
        </div>
      ) : null}

      {usage != null ? (
        <div className="mt-4">
          <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('codex_live_sessions.token_usage')}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-x-3 gap-y-1">
            <UsageStat label={t('codex_live_sessions.tokens_input')} value={usage.inputTokens} />
            <UsageStat label={t('codex_live_sessions.tokens_cached')} value={usage.cachedInputTokens} />
            <UsageStat label={t('codex_live_sessions.tokens_output')} value={usage.outputTokens} />
            <UsageStat label={t('codex_live_sessions.tokens_total')} value={usage.totalTokens} />
          </div>
        </div>
      ) : null}

    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)]">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
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

function Timeline({ events, t }: { events: readonly CodexLiveTimelineEvent[]; t: Translate }) {
  return (
    <div className="grid gap-3">
      <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.request_timeline')}
      </div>
      <div className="divide-y-2 divide-[var(--border-color)] border-2 border-[var(--border-color)]">
        {events.map((event) => (
          <div key={event.id} className="grid gap-3 p-3 md:grid-cols-[5.2rem_8rem_1fr]">
            <span className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-muted)]">{event.at}</span>
            <span className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-primary)]">
              {event.lane}.{event.kind}
            </span>
            <span className="min-w-0 text-[length:var(--font-size-ui-lg)] font-bold text-[var(--text-muted)]">{event.label}</span>
          </div>
        ))}
      </div>
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
