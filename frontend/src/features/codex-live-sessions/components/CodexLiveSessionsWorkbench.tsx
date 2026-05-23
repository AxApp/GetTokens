import { Copy, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import SearchInput from '../../../components/ui/SearchInput';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../../context/I18nContext';
import type { SegmentedOption } from '../../../types';
import {
  buildCodexLiveDiagnosticSummary,
  filterCodexLiveSessions,
  getPrimaryCodexLiveRequest,
  getSelectedCodexLiveSession,
} from '../model/selectors';
import type {
  CodexLiveSessionFilter,
  CodexLiveSessionSnapshot,
  CodexLiveTransportFilter,
} from '../model/types';
import { SessionDetail } from './CodexLiveSessionDetail';
import { SessionFeed } from './CodexLiveSessionFeed';
import { SourceBadge } from './CodexLiveSessionSummary';

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
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

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
  const selectedRequest = selectedSession ? getPrimaryCodexLiveRequest(selectedSession) : undefined;
  const diagnostic = selectedSession ? buildCodexLiveDiagnosticSummary(selectedSession, selectedRequest) : '';
  const filterLabel = buildCodexLiveFilterLabel(t, statusFilter, transportFilter, statusOptions, transportOptions);

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isFilterMenuOpen]);

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
      className="h-full min-h-0 min-w-0 overflow-auto bg-[var(--bg-surface)] p-5 lg:p-8"
    >
      <div className="grid w-full min-w-0 gap-5">
        <WorkspacePageHeader
          title={t('codex_live_sessions.title')}
          subtitle={`${t('codex_live_sessions.source')} ${snapshot.source.toUpperCase()} / ${t('codex_live_sessions.retention')} ${snapshot.retentionLabel} / ${t('codex_live_sessions.generated')} ${snapshot.generatedAt}`}
          className="flex-col items-start sm:flex-row sm:items-end"
          titleClassName="text-3xl font-black uppercase italic tracking-normal text-[var(--text-primary)] [word-break:keep-all] sm:text-4xl"
          actionsClassName="flex flex-wrap items-center justify-start gap-2 sm:justify-end"
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

        <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[6px_6px_0_var(--shadow-color)] lg:grid-cols-[minmax(260px,1fr)_auto]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('codex_live_sessions.search_placeholder')}
            clearLabel={t('codex_live_sessions.clear_search')}
          />
          <div ref={filterMenuRef} className="relative min-w-0">
            <button
              type="button"
              className="btn-swiss flex h-10 w-full min-w-0 items-center justify-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] lg:w-auto"
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              aria-expanded={isFilterMenuOpen}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              <span className="min-w-0 truncate">{filterLabel}</span>
            </button>
            {isFilterMenuOpen ? (
              <div className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 grid min-w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[6px_6px_0_var(--shadow-color)] lg:left-auto lg:right-0 lg:translate-x-0">
                <div className="grid gap-2">
                  <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('codex_live_sessions.filter_group_status')}
                  </p>
                  <div className="grid grid-cols-3 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
                    {statusOptions.map((option, index) => (
                      <FilterMenuOptionButton
                        key={option.id}
                        active={statusFilter === option.id}
                        bordered={(index + 1) % 3 !== 0}
                        topBorder={index >= 3}
                        onClick={() => setStatusFilter(option.id)}
                      >
                        {option.label}
                      </FilterMenuOptionButton>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('codex_live_sessions.filter_group_transport')}
                  </p>
                  <div className="grid grid-cols-4 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
                    {transportOptions.map((option, index) => (
                      <FilterMenuOptionButton
                        key={option.id}
                        active={transportFilter === option.id}
                        bordered={index < transportOptions.length - 1}
                        onClick={() => setTransportFilter(option.id)}
                      >
                        {option.label}
                      </FilterMenuOptionButton>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end border-t border-dashed border-[var(--border-color)] pt-3">
                  <button
                    type="button"
                    className="btn-swiss h-8 !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
                    onClick={() => {
                      setStatusFilter('all');
                      setTransportFilter('all');
                    }}
                  >
                    {t('codex_live_sessions.filter_reset')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid min-h-[620px] min-w-0 gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] xl:items-start">
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

function FilterMenuOptionButton({
  active,
  bordered = false,
  topBorder = false,
  children,
  onClick,
}: {
  active: boolean;
  bordered?: boolean;
  topBorder?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 min-w-0 px-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none tracking-[0.1em] ${
        bordered ? 'border-r border-[var(--border-color)]' : ''
      } ${topBorder ? 'border-t border-[var(--border-color)]' : ''} ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}

function buildCodexLiveFilterLabel(
  t: (key: string) => string,
  statusFilter: CodexLiveSessionFilter,
  transportFilter: CodexLiveTransportFilter,
  statusOptions: ReadonlyArray<SegmentedOption<CodexLiveSessionFilter>>,
  transportOptions: ReadonlyArray<SegmentedOption<CodexLiveTransportFilter>>,
) {
  const parts: string[] = [];
  if (statusFilter !== 'all') {
    parts.push(statusOptions.find((option) => option.id === statusFilter)?.label ?? statusFilter);
  }
  if (transportFilter !== 'all') {
    parts.push(transportOptions.find((option) => option.id === transportFilter)?.label ?? transportFilter);
  }
  if (parts.length === 0) {
    return t('codex_live_sessions.filter_menu');
  }
  return `${t('codex_live_sessions.filter_menu')} · ${parts.join(' · ')}`;
}
