import { Copy, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '../../../context/I18nContext';
import SearchInput from '../../../components/ui/SearchInput';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import SnippetPre from '../../../components/ui/SnippetPre';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { SegmentedOption } from '../../../types';
import {
  buildCodexLiveDiagnosticSummary,
  filterCodexLiveSessions,
  groupTimelineByLane,
} from '../model/selectors';
import type {
  CodexLiveRequest,
  CodexLiveSession,
  CodexLiveSessionFilter,
  CodexLiveSessionSnapshot,
  CodexLiveSessionStatus,
  CodexLiveTimelineEvent,
  CodexLiveTransport,
  CodexLiveTransportFilter,
} from '../model/types';

interface CodexLiveSessionsWorkbenchProps {
  snapshot: CodexLiveSessionSnapshot;
  initialSelectedSessionID?: string;
  onRefresh?: () => void;
}

type Translate = (key: string) => string;

const transportOptions: ReadonlyArray<SegmentedOption<CodexLiveTransportFilter>> = [
  { id: 'all', label: 'ALL' },
  { id: 'websocket', label: 'WS' },
  { id: 'http', label: 'HTTP' },
  { id: 'unknown', label: '?' },
];

const statusLabelKeys: Record<CodexLiveSessionStatus, string> = {
  active: 'codex_live_sessions.status_active',
  streaming: 'codex_live_sessions.status_streaming',
  reconnecting: 'codex_live_sessions.status_reconnecting',
  upstream_disconnected: 'codex_live_sessions.status_upstream_disconnected',
  degraded_http: 'codex_live_sessions.status_degraded_http',
  completed: 'codex_live_sessions.status_completed',
  failed: 'codex_live_sessions.status_failed',
  cancelled: 'codex_live_sessions.status_cancelled',
};

const transportLabels: Record<CodexLiveTransport, string> = {
  websocket: 'WS',
  http: 'HTTP',
  unknown: 'UNKNOWN',
};

export default function CodexLiveSessionsWorkbench({
  snapshot,
  initialSelectedSessionID,
  onRefresh,
}: CodexLiveSessionsWorkbenchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CodexLiveSessionFilter>('all');
  const [transportFilter, setTransportFilter] = useState<CodexLiveTransportFilter>('all');
  const [selectedSessionID, setSelectedSessionID] = useState(initialSelectedSessionID);
  const [copied, setCopied] = useState(false);

  const statusOptions = useMemo<ReadonlyArray<SegmentedOption<CodexLiveSessionFilter>>>(
    () => [
      { id: 'all', label: t('codex_live_sessions.filter_all') },
      { id: 'active', label: t('codex_live_sessions.filter_active') },
      { id: 'reconnecting', label: t('codex_live_sessions.filter_reconnecting') },
      { id: 'degraded_http', label: t('codex_live_sessions.filter_degraded_http') },
      { id: 'failed', label: t('codex_live_sessions.filter_failed') },
      { id: 'completed', label: t('codex_live_sessions.filter_completed') },
    ],
    [t],
  );

  const sessions = useMemo(
    () => filterCodexLiveSessions({ sessions: snapshot.sessions, query, statusFilter, transportFilter }),
    [query, snapshot.sessions, statusFilter, transportFilter],
  );
  const selectedSession = selectedSessionID ? sessions.find((session) => session.sessionID === selectedSessionID) : undefined;
  const selectedRequest = selectedSession?.requests.find((request) => request.requestID === selectedSession.activeRequestID) ?? selectedSession?.requests[0];
  const diagnostic = selectedSession ? buildCodexLiveDiagnosticSummary(selectedSession, selectedRequest) : '';

  async function copyDiagnostic() {
    if (!diagnostic || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(diagnostic);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name="CodexLiveSessionsWorkbench"
      className="h-full min-h-0 overflow-auto bg-[var(--bg-surface)] p-5 lg:p-8"
    >
      <div className="mx-auto grid max-w-[1480px] gap-5">
        <WorkspacePageHeader
          title={t('codex_live_sessions.title')}
          subtitle={`${t('codex_live_sessions.source')} ${snapshot.source.toUpperCase()} / ${t('codex_live_sessions.retention')} ${snapshot.retentionLabel} / ${t('codex_live_sessions.generated')} ${snapshot.generatedAt}`}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SourceBadge snapshot={snapshot} />
              <button
                type="button"
                className="btn-swiss flex items-center gap-2 !px-3 !py-2 text-[length:var(--font-size-ui-xs)]"
                onClick={onRefresh}
                title={t('codex_live_sessions.refresh_title')}
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
                {t('common.refresh')}
              </button>
              <button
                type="button"
                className="btn-swiss flex items-center gap-2 !px-3 !py-2 text-[length:var(--font-size-ui-xs)]"
                onClick={copyDiagnostic}
                disabled={!selectedSession}
                title={t('codex_live_sessions.copy_diagnostic')}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                {copied ? t('codex_live_sessions.copied') : t('common.copy')}
              </button>
            </div>
          }
        />

        <SummaryStrip snapshot={snapshot} t={t} />

        {!snapshot.sidecarReady ? (
          <div
            data-debug={undefined}
            className="border-2 border-[var(--border-color)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--bg-main))] p-4 shadow-[4px_4px_0_var(--shadow-color)]"
          >
            <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-primary)]">
              {t('codex_live_sessions.sidecar_not_ready_title')}
            </div>
            <p className="mt-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
              {t('codex_live_sessions.sidecar_not_ready_body')}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[6px_6px_0_var(--shadow-color)] lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('codex_live_sessions.search_placeholder')}
            clearLabel={t('codex_live_sessions.clear_search')}
          />
          <SegmentedControl options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          <SegmentedControl options={transportOptions} value={transportFilter} onChange={setTransportFilter} />
        </div>

        <div className="grid min-h-[620px] gap-5">
          <SessionFeed
            sessions={sessions}
            selectedSessionID={selectedSession?.sessionID}
            onSelectSession={(sessionID) => {
              setSelectedSessionID((currentSessionID) => (currentSessionID === sessionID ? undefined : sessionID));
            }}
            diagnostic={diagnostic}
            t={t}
          />
        </div>
      </div>
    </section>
  );
}

function SourceBadge({ snapshot }: { snapshot: CodexLiveSessionSnapshot }) {
  const label = snapshot.source === 'unavailable' ? 'UNAVAILABLE' : snapshot.sidecarReady ? snapshot.source.toUpperCase() : 'CACHE';
  return (
    <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase shadow-[3px_3px_0_var(--shadow-color)]">
      {label}
    </span>
  );
}

function SummaryStrip({ snapshot, t }: { snapshot: CodexLiveSessionSnapshot; t: Translate }) {
  const items = [
    [t('codex_live_sessions.summary_active'), snapshot.summary.activeSessions],
    [t('codex_live_sessions.summary_requests'), snapshot.summary.activeRequests],
    [t('codex_live_sessions.summary_ws'), snapshot.summary.websocketSessions],
    [t('codex_live_sessions.summary_http'), snapshot.summary.httpSessions],
    [t('codex_live_sessions.summary_degraded'), snapshot.summary.degradedSessions],
    [t('codex_live_sessions.summary_failed'), snapshot.summary.errorSessions],
  ];

  return (
    <div data-debug={undefined} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="min-h-[86px] border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[4px_4px_0_var(--shadow-color)]"
        >
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {label}
          </div>
          <div className="mt-2 font-mono text-[length:var(--font-size-ui-6xl)] font-black tracking-normal text-[var(--text-primary)]">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionFeed({
  sessions,
  selectedSessionID,
  onSelectSession,
  diagnostic,
  t,
}: {
  sessions: readonly CodexLiveSession[];
  selectedSessionID?: string;
  onSelectSession: (sessionID: string) => void;
  diagnostic: string;
  t: Translate;
}) {
  return (
    <div className="min-h-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
      <div
        data-debug={undefined}
        className="grid gap-1 border-b-2 border-[var(--border-color)] px-4 py-3 md:grid-cols-[1fr_auto] md:items-end"
      >
        <div>
          <h3 className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em]">
            {t('codex_live_sessions.session_feed')}
          </h3>
          <p className="mt-1 text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
            {t('codex_live_sessions.session_feed_hint')}
          </p>
        </div>
        <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          {sessions.length} {t('codex_live_sessions.rows')}
        </span>
      </div>

      <div className="hidden grid-cols-[9rem_minmax(15rem,1.1fr)_minmax(14rem,0.85fr)_minmax(13rem,0.8fr)_5rem] gap-4 border-b border-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)] px-4 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)] lg:grid">
        <span>{t('codex_live_sessions.col_status')}</span>
        <span>{t('codex_live_sessions.col_model_account')}</span>
        <span>{t('codex_live_sessions.col_connection')}</span>
        <span>{t('codex_live_sessions.col_speed')}</span>
        <span>{t('codex_live_sessions.col_open')}</span>
      </div>

      <div>
        {sessions.length === 0 ? (
          <div className="p-6">
            <div className="border-2 border-dashed border-[var(--border-color)] p-5 text-center font-bold text-[var(--text-muted)]">
              {t('codex_live_sessions.empty')}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)]">
            {sessions.map((session) => {
              const request = getPrimarySessionRequest(session);
              const selected = session.sessionID === selectedSessionID;
              return (
                <div key={session.sessionID}>
                  <SessionRow
                    session={session}
                    request={request}
                    selected={selected}
                    onSelect={() => onSelectSession(session.sessionID)}
                    t={t}
                  />
                  {selected ? (
                    <div className="border-t border-[color:color-mix(in_srgb,var(--border-color)_45%,transparent)] bg-[var(--bg-surface)] p-4">
                      <SessionDetail session={session} request={request} diagnostic={diagnostic} embedded t={t} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  request,
  selected,
  onSelect,
  t,
}: {
  session: CodexLiveSession;
  request?: CodexLiveRequest;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  const timing = request?.timing;
  const connectionLabel = getConnectionLabel(session, t);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={`grid w-full gap-4 px-4 py-4 text-left transition-colors active:scale-[0.99] lg:grid-cols-[9rem_minmax(15rem,1.1fr)_minmax(14rem,0.85fr)_minmax(13rem,0.8fr)_5rem] lg:items-center ${
        selected
          ? 'bg-[color-mix(in_srgb,var(--border-color)_10%,var(--bg-main))]'
          : 'hover:bg-[color-mix(in_srgb,var(--border-color)_5%,var(--bg-main))]'
      }`}
    >
      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_status')}
        </span>
        <RowStatus status={session.status} fallbackInferred={session.fallbackInferred} t={t} />
      </div>

      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_model_account')}
        </span>
        <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
          {request?.model || session.model}
        </div>
        <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
          {request?.authLabel || session.authLabel || request?.authID || session.authID || t('codex_live_sessions.unknown_auth')}
        </div>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_connection')}
        </span>
        <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
          {connectionLabel}
        </div>
        <div className="mt-1 truncate text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
          {session.fallbackInferred ? t('codex_live_sessions.connection_degraded_hint') : t('codex_live_sessions.connection_normal_hint')}
        </div>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)] lg:hidden">
          {t('codex_live_sessions.col_speed')}
        </span>
        <div className="grid gap-1 font-mono text-[length:var(--font-size-ui-xs)] uppercase">
          <MetricText label={t('codex_live_sessions.metric_output_rate')} value={formatOptionalRate(timing?.outputTokensPerSecond)} />
          <MetricText label={t('codex_live_sessions.metric_first_token')} value={formatOptionalDuration(timing?.firstTokenMs)} />
          <MetricText label={t('codex_live_sessions.metric_running_for')} value={formatDuration(session.durationMs)} />
        </div>
      </div>

      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
        {selected ? t('codex_live_sessions.collapse') : t('codex_live_sessions.expand')}
      </div>
    </button>
  );
}

function RowStatus({
  status,
  fallbackInferred,
  t,
}: {
  status: CodexLiveSessionStatus;
  fallbackInferred?: boolean;
  t: Translate;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 ${statusDotClass(status)}`} />
      <div className="min-w-0">
        <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]">
          {t(statusLabelKeys[status])}
        </div>
        {fallbackInferred ? (
          <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-warning)]">
            {t('codex_live_sessions.http_inferred')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 truncate text-[var(--text-muted)]">
      {label} <b className="text-[var(--text-primary)]">{value}</b>
    </span>
  );
}

function SessionDetail({
  session,
  request,
  diagnostic,
  t,
  embedded = false,
}: {
  session?: CodexLiveSession;
  request?: CodexLiveRequest;
  diagnostic: string;
  t: Translate;
  embedded?: boolean;
}) {
  if (!session) {
    return (
      <div className="grid place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-6 shadow-[6px_6px_0_var(--shadow-color)]">
        <div className="max-w-sm text-center font-bold text-[var(--text-muted)]">
          {t('codex_live_sessions.no_running_sessions')}
        </div>
      </div>
    );
  }

  const timeline = request?.timeline ?? session.recentEvents;

  return (
    <div className={`min-w-0 bg-[var(--bg-main)] ${embedded ? 'border-0 shadow-none' : 'border-2 border-[var(--border-color)] shadow-[6px_6px_0_var(--shadow-color)]'}`}>
      <div className="grid gap-3 border-b-2 border-[var(--border-color)] p-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} t={t} />
            {session.fallbackInferred ? <span className="badge-swiss">{t('codex_live_sessions.inferred')}</span> : null}
          </div>
          <h3 className="mt-3 truncate font-mono text-[length:var(--font-size-ui-4xl)] font-black tracking-normal text-[var(--text-primary)]">
            {request?.requestID || session.lastRequestID || session.sessionID}
          </h3>
          <p className="mt-1 truncate text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
            {session.model} / {session.authLabel || session.authID || t('codex_live_sessions.unknown_auth')} / {session.codexWindowID || t('codex_live_sessions.unknown_window')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
          <span>{t('codex_live_sessions.duration')}</span>
          <span className="text-[var(--text-primary)]">{formatDuration(session.durationMs)}</span>
          <span>{t('codex_live_sessions.requests')}</span>
          <span className="text-[var(--text-primary)]">{session.requestCount}</span>
        </div>
      </div>

      <div className="grid gap-5 p-4">
        <TransportLane events={timeline} t={t} />
        <TimingMetrics request={request} t={t} />
        <RequestMeta session={session} request={request} t={t} />
        <Timeline events={timeline} t={t} />
        <DiagnosticSummary diagnostic={diagnostic} t={t} />
      </div>
    </div>
  );
}

function getPrimarySessionRequest(session: CodexLiveSession): CodexLiveRequest | undefined {
  return session.requests.find((request) => request.requestID === session.activeRequestID) ?? session.requests[0];
}

function getConnectionLabel(session: CodexLiveSession, t: Translate): string {
  if (session.fallbackInferred || (session.downstreamTransport === 'websocket' && session.upstreamTransport === 'http')) {
    return t('codex_live_sessions.connection_ws_to_http');
  }
  if (session.downstreamTransport === 'websocket' || session.upstreamTransport === 'websocket') {
    return t('codex_live_sessions.connection_websocket');
  }
  if (session.downstreamTransport === 'http' || session.upstreamTransport === 'http') {
    return t('codex_live_sessions.connection_http');
  }
  return t('codex_live_sessions.connection_unknown');
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
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.transport_lane')}
      </div>
      <div className="grid gap-2 xl:grid-cols-4">
        {laneItems.map(([lane, label]) => (
          <div key={lane} className="min-h-[86px] border border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[var(--bg-surface)] p-3">
            <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]">
              {label}
            </div>
            <div className="mt-2 grid gap-1">
              {lanes[lane].length === 0 ? (
                <span className="text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">{t('codex_live_sessions.no_event')}</span>
              ) : (
                lanes[lane].slice(0, 2).map((event) => (
                  <div key={event.id} className="grid grid-cols-[8px_1fr] gap-2">
                    <span className={`mt-1 h-2 w-2 ${severityDotClass(event.severity)}`} />
                    <span className="min-w-0 truncate text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
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
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.timing')}
      </div>
      <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex min-w-0 justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--border-color)_30%,transparent)] py-1 font-mono text-[length:var(--font-size-ui-xs)] uppercase">
            <span className="font-black text-[var(--text-muted)]">{label}</span>
            <span className="truncate font-black text-[var(--text-primary)]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestMeta({ session, request, t }: { session: CodexLiveSession; request?: CodexLiveRequest; t: Translate }) {
  const rows = [
    [t('codex_live_sessions.meta_session'), session.sessionID],
    [t('codex_live_sessions.meta_execution'), session.executionSessionID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.meta_client_request'), request?.clientRequestID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.meta_upstream_request'), request?.upstreamRequestID || t('codex_live_sessions.unknown')],
    [t('codex_live_sessions.meta_transport'), `${session.downstreamTransport} -> ${session.upstreamTransport}`],
    [t('codex_live_sessions.meta_fallback'), session.fallbackInferred ? `${session.fallbackConfidence || t('codex_live_sessions.unknown')} / ${session.fallbackReason || t('codex_live_sessions.unknown')}` : t('codex_live_sessions.none')],
  ];

  return (
    <div className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-2 text-[length:var(--font-size-ui-xs)] md:grid-cols-[8rem_1fr]">
          <span className="font-mono font-black uppercase text-[var(--text-muted)]">{label}</span>
          <span className="min-w-0 truncate font-mono font-bold text-[var(--text-primary)]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Timeline({ events, t }: { events: readonly CodexLiveTimelineEvent[]; t: Translate }) {
  return (
    <div className="grid gap-3">
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.request_timeline')}
      </div>
      <div className="divide-y-2 divide-[var(--border-color)] border-2 border-[var(--border-color)]">
        {events.map((event) => (
          <div key={event.id} className="grid gap-3 p-3 md:grid-cols-[5.2rem_8rem_1fr]">
            <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">{event.at}</span>
            <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)]">
              {event.lane}.{event.kind}
            </span>
            <span className="min-w-0 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">{event.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosticSummary({ diagnostic, t }: { diagnostic: string; t: Translate }) {
  return (
    <div className="grid gap-3">
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {t('codex_live_sessions.redacted_diagnostic')}
      </div>
      <SnippetPre className="max-h-[260px] border-2 border-[var(--border-color)] !bg-[var(--bg-surface)]">
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
    <span className={`shrink-0 border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase ${tone}`}>
      {t(statusLabelKeys[status])}
    </span>
  );
}

function TransportPill({ transport }: { transport: CodexLiveTransport }) {
  return (
    <span className="truncate border border-[color:color-mix(in_srgb,var(--border-color)_50%,transparent)] px-2 py-1 text-center">
      {transportLabels[transport]}
    </span>
  );
}

function statusDotClass(status: CodexLiveSessionStatus): string {
  if (status === 'failed' || status === 'cancelled') {
    return 'bg-[var(--color-danger)]';
  }
  if (status === 'degraded_http' || status === 'reconnecting' || status === 'upstream_disconnected') {
    return 'bg-[var(--color-warning)]';
  }
  if (status === 'active' || status === 'streaming') {
    return 'bg-[var(--color-success)]';
  }
  return 'bg-[var(--text-muted)]';
}

function severityDotClass(severity: CodexLiveTimelineEvent['severity']): string {
  if (severity === 'error') {
    return 'bg-[var(--color-danger)]';
  }
  if (severity === 'warning') {
    return 'bg-[var(--color-warning)]';
  }
  if (severity === 'success') {
    return 'bg-[var(--color-success)]';
  }
  return 'bg-[var(--text-muted)]';
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const preciseSeconds = ms / 1000;
  if (preciseSeconds < 10) {
    return `${preciseSeconds.toFixed(1)}s`;
  }
  const seconds = Math.round(preciseSeconds);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatOptionalDuration(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return 'n/a';
  }
  return formatDuration(ms);
}

function formatOptionalRate(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  return `${Math.round(value)}/s`;
}
