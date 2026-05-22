import { Copy, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import SearchInput from '../../../components/ui/SearchInput';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../../context/I18nContext';
import type { SegmentedOption } from '../../../types';
import {
  buildCodexLiveDiagnosticSummary,
  filterCodexLiveSessions,
  getSelectedCodexLiveSession,
} from '../model/selectors';
import type {
  CodexLiveSessionFilter,
  CodexLiveSessionSnapshot,
  CodexLiveTransportFilter,
} from '../model/types';
import { SessionDetail } from './CodexLiveSessionDetail';
import { getPrimarySessionRequest, SessionFeed } from './CodexLiveSessionFeed';
import { SourceBadge, SummaryStrip } from './CodexLiveSessionSummary';

interface CodexLiveSessionsWorkbenchProps {
  snapshot: CodexLiveSessionSnapshot;
  initialSelectedSessionID?: string;
  onRefresh?: () => void;
}

const transportOptions: ReadonlyArray<SegmentedOption<CodexLiveTransportFilter>> = [
  { id: 'all', label: 'ALL' },
  { id: 'websocket', label: 'WS' },
  { id: 'http', label: 'HTTP' },
  { id: 'unknown', label: '?' },
];

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
  const selectedSession = getSelectedCodexLiveSession(sessions, selectedSessionID);
  const selectedRequest = selectedSession ? getPrimarySessionRequest(selectedSession) : undefined;
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

        <div className="grid min-h-[620px] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)] xl:items-start">
          <SessionFeed
            sessions={sessions}
            selectedSessionID={selectedSession?.sessionID}
            onSelectSession={(sessionID) => {
              setSelectedSessionID((currentSessionID) => (currentSessionID === sessionID ? undefined : sessionID));
            }}
            t={t}
          />
          <div className="min-w-0 xl:sticky xl:top-5">
            <SessionDetail session={selectedSession} request={selectedRequest} diagnostic={diagnostic} t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}
