import { Copy, SlidersHorizontal, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import RefreshActionButton from '../../../components/ui/RefreshActionButton';
import SearchInput from '../../../components/ui/SearchInput';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../../context/I18nContext';
import type { CodexLiveSessionsView, SegmentedOption } from '../../../types';
import {
  buildCodexLiveDiagnosticSummary,
  buildCodexLiveProjectSummaries,
  filterCodexLiveSessions,
  getCodexLiveProjectIDForSession,
  getPrimaryCodexLiveRequest,
} from '../model/selectors';
import type {
  CodexLiveRequest,
  CodexLiveSessionFilter,
  CodexLiveSessionSnapshot,
  CodexLiveTransportFilter,
} from '../model/types';
import { SessionDetail } from './CodexLiveSessionDetail';
import { ProjectFeed, SessionFeed } from './CodexLiveSessionFeed';
import { SourceBadge } from './CodexLiveSessionSummary';
import { buildCodexLiveHistoryRequestFeedRows, buildCodexLiveRequestFeedRows } from './formatters';

interface CodexLiveSessionsWorkbenchProps {
  snapshot: CodexLiveSessionSnapshot;
  view?: CodexLiveSessionsView;
  onViewChange?: (view: CodexLiveSessionsView) => void;
  detailRequests?: readonly CodexLiveRequest[];
  overviewRequests?: readonly CodexLiveRequest[];
  overviewHistoryLabel?: string;
  overviewCanLoadMore?: boolean;
  onLoadMoreOverview?: () => void;
  detailHistoryLabel?: string;
  detailCanLoadMore?: boolean;
  onLoadMoreDetail?: () => void;
  overviewLoading?: boolean;
  overviewError?: string;
  detailLoading?: boolean;
  detailError?: string;
  initialSelectedSessionID?: string;
  onRefresh?: () => void;
  onClearSessions?: () => void;
  onSelectionChange?: (sessionID?: string) => void;
}

const transportOptions: ReadonlyArray<SegmentedOption<CodexLiveTransportFilter>> = [
  { id: 'all', label: 'ALL' },
  { id: 'websocket', label: 'WS' },
  { id: 'http', label: 'HTTP' },
  { id: 'unknown', label: '?' },
];

const codexLiveWorkbenchShellClass =
  'h-full min-h-0 min-w-0 overflow-auto bg-[var(--gt-surface-canvas)] p-5 lg:p-8';
const codexLiveWorkbenchTitleClass =
  'text-2xl font-semibold tracking-normal text-[var(--gt-ink-primary)] [word-break:keep-all] sm:text-3xl';
const codexLiveWorkbenchActionButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const codexLiveWorkbenchSegmentClass =
  'grid grid-cols-2 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexLiveWorkbenchSegmentButtonClass =
  'h-9 min-w-16 px-3 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal transition-colors';
const codexLiveWorkbenchFilterButtonClass =
  'inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] lg:w-auto';
const codexLiveWorkbenchFilterMenuClass =
  'absolute left-1/2 top-[calc(100%+0.75rem)] z-30 grid min-w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 gap-4 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 [box-shadow:var(--gt-elevation-card)] lg:left-auto lg:right-0 lg:translate-x-0';
const codexLiveWorkbenchFilterGroupLabelClass =
  'text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexLiveWorkbenchFilterOptionGridClass =
  'grid overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexLiveWorkbenchFilterOptionClass =
  'min-h-9 min-w-0 px-2 text-[length:var(--gt-font-size-2xs)] font-semibold leading-none tracking-normal transition-colors';
const codexLiveWorkbenchFilterResetRowClass =
  'flex justify-end border-t border-[var(--gt-border-subtle)] pt-3';

export default function CodexLiveSessionsWorkbench({
  snapshot,
  view = 'session',
  onViewChange,
  detailRequests = [],
  overviewRequests = [],
  overviewHistoryLabel,
  overviewCanLoadMore = false,
  onLoadMoreOverview,
  detailHistoryLabel,
  detailCanLoadMore = false,
  onLoadMoreDetail,
  overviewLoading = false,
  overviewError,
  detailLoading = false,
  detailError,
  initialSelectedSessionID,
  onRefresh,
  onClearSessions,
  onSelectionChange,
}: CodexLiveSessionsWorkbenchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CodexLiveSessionFilter>('all');
  const [transportFilter, setTransportFilter] = useState<CodexLiveTransportFilter>('all');
  const [selectedSessionID, setSelectedSessionID] = useState(initialSelectedSessionID);
  const [selectedProjectID, setSelectedProjectID] = useState<string>();
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

  const filteredSessions = useMemo(
    () => filterCodexLiveSessions({ sessions: snapshot.sessions, query, statusFilter, transportFilter }),
    [query, snapshot.sessions, statusFilter, transportFilter],
  );
  const projects = useMemo(() => buildCodexLiveProjectSummaries(filteredSessions), [filteredSessions]);
  const selectedProject = selectedProjectID ? projects.find((project) => project.projectID === selectedProjectID) : undefined;
  const isProjectView = view === 'project';
  const sessions = useMemo(
    () => selectedProject
      ? filteredSessions.filter((session) => getCodexLiveProjectIDForSession(session) === selectedProject.projectID)
      : filteredSessions,
    [filteredSessions, selectedProject],
  );
  const requestRows = useMemo(() => buildCodexLiveRequestFeedRows(sessions), [sessions]);
  const overviewRequestRows = useMemo(
    () => overviewRequests.length > 0 ? buildCodexLiveHistoryRequestFeedRows(sessions, overviewRequests) : requestRows,
    [overviewRequests, requestRows, sessions],
  );
  const selectedSession = !isProjectView && selectedSessionID
    ? sessions.find((session) => session.sessionID === selectedSessionID)
    : undefined;
  const selectedSessionWithDetail = useMemo(
    () =>
      selectedSession
        ? {
            ...selectedSession,
            requests: detailRequests.length > 0 ? [...detailRequests] : selectedSession.requests,
          }
        : undefined,
    [detailRequests, selectedSession],
  );
  const selectedRequest = selectedSessionWithDetail ? getPrimaryCodexLiveRequest(selectedSessionWithDetail) : undefined;
  const diagnostic = selectedSessionWithDetail
    ? buildCodexLiveDiagnosticSummary(selectedSessionWithDetail, selectedRequest)
    : '';
  const filterLabel = buildCodexLiveFilterLabel(t, statusFilter, transportFilter, statusOptions, transportOptions);

  useEffect(() => {
    if (view !== 'project' && selectedProjectID) {
      setSelectedProjectID(undefined);
    }
  }, [selectedProjectID, view]);

  useEffect(() => {
    if (selectedProjectID && !selectedProject) {
      setSelectedProjectID(undefined);
    }
  }, [selectedProject, selectedProjectID]);

  useEffect(() => {
    onSelectionChange?.(selectedSession?.sessionID);
  }, [onSelectionChange, selectedSession?.sessionID]);

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

  function confirmClearSessions() {
    if (!onClearSessions) {
      return;
    }
    if (!window.confirm(t('codex_live_sessions.clear_sessions_confirm'))) {
      return;
    }
    setSelectedSessionID(undefined);
    setSelectedProjectID(undefined);
    onClearSessions();
  }

  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name="CodexLiveSessionsWorkbench"
      data-codex-live-sessions-workbench-shell="quiet"
      className={codexLiveWorkbenchShellClass}
    >
      <div className="grid w-full min-w-0 gap-5">
        <WorkspacePageHeader
          title={t('codex_live_sessions.title')}
          subtitle={`${t('codex_live_sessions.source')} ${snapshot.source.toUpperCase()} / ${t('codex_live_sessions.retention')} ${snapshot.retentionLabel} / ${t('codex_live_sessions.generated')} ${snapshot.generatedAt}`}
          className="flex-col items-start sm:flex-row sm:items-end"
          titleClassName={codexLiveWorkbenchTitleClass}
          actionsClassName="flex flex-wrap items-center justify-start gap-2 sm:justify-end"
          actions={
            <div data-codex-live-sessions-header-actions="quiet" className="flex flex-wrap items-center justify-end gap-2">
              <div
                className={codexLiveWorkbenchSegmentClass}
                data-codex-live-sessions-view-header="true"
                aria-label={t('codex_live_sessions.view_switch_label')}
              >
                {(['session', 'project'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={view === item}
                    onClick={() => {
                      setSelectedSessionID(undefined);
                      setSelectedProjectID(undefined);
                      onViewChange?.(item);
                    }}
                    className={`${codexLiveWorkbenchSegmentButtonClass} ${
                      view === item
                        ? 'bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
                        : 'text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-canvas)] hover:text-[var(--gt-ink-primary)]'
                    } ${item === 'session' ? 'border-r border-[var(--gt-border-subtle)]' : ''}`}
                  >
                    {t(`codex_live_sessions.view_${item}`)}
                  </button>
                ))}
              </div>
              <SourceBadge snapshot={snapshot} />
              <RefreshActionButton
                onClick={onRefresh}
                label={t('common.refresh')}
                title={t('codex_live_sessions.refresh_title')}
                iconStrokeWidth={2.5}
                className="text-[length:var(--gt-font-size-xs)]"
              />
              <button
                type="button"
                className={codexLiveWorkbenchActionButtonClass}
                onClick={confirmClearSessions}
                disabled={!onClearSessions || snapshot.sessions.length === 0}
                title={t('codex_live_sessions.clear_sessions_title')}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                {t('codex_live_sessions.clear_sessions')}
              </button>
              <button
                type="button"
                className={codexLiveWorkbenchActionButtonClass}
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

        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(260px,1fr)_auto]">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('codex_live_sessions.search_placeholder')}
            clearLabel={t('codex_live_sessions.clear_search')}
          />
          <div ref={filterMenuRef} className="relative min-w-0">
            <button
              type="button"
              className={codexLiveWorkbenchFilterButtonClass}
              onClick={() => setIsFilterMenuOpen((prev) => !prev)}
              aria-expanded={isFilterMenuOpen}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              <span className="min-w-0 truncate">{filterLabel}</span>
            </button>
            {isFilterMenuOpen ? (
              <div data-codex-live-sessions-filter-menu="quiet" className={codexLiveWorkbenchFilterMenuClass}>
                <div className="grid gap-2">
                  <p className={codexLiveWorkbenchFilterGroupLabelClass}>
                    {t('codex_live_sessions.filter_group_status')}
                  </p>
                  <div className={`${codexLiveWorkbenchFilterOptionGridClass} grid-cols-3`}>
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
                  <p className={codexLiveWorkbenchFilterGroupLabelClass}>
                    {t('codex_live_sessions.filter_group_transport')}
                  </p>
                  <div className={`${codexLiveWorkbenchFilterOptionGridClass} grid-cols-4`}>
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
                <div className={codexLiveWorkbenchFilterResetRowClass}>
                  <button
                    type="button"
                    className={`${codexLiveWorkbenchActionButtonClass} h-8 px-2 text-[length:var(--gt-font-size-2xs)]`}
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

        <div className="grid min-h-[620px] min-w-0 gap-5 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:items-start">
          {isProjectView ? (
            <ProjectFeed
              projects={projects}
              selectedProjectID={selectedProject?.projectID}
              onSelectProject={(projectID) => {
                setSelectedSessionID(undefined);
                setSelectedProjectID((currentProjectID) => (currentProjectID === projectID ? undefined : projectID));
              }}
              t={t}
            />
          ) : (
            <SessionFeed
              sessions={sessions}
              selectedSessionID={selectedSession?.sessionID}
              onSelectSession={(sessionID) => {
                setSelectedSessionID((currentSessionID) => (currentSessionID === sessionID ? undefined : sessionID));
              }}
              onShowOverview={() => setSelectedSessionID(undefined)}
              t={t}
            />
          )}
          <div className="min-w-0">
            <SessionDetail
              session={selectedSessionWithDetail}
              request={selectedRequest}
              overviewSessions={sessions}
              overviewRequestCount={overviewRequestRows.length}
              overviewRequestRows={overviewRequestRows}
              overviewHistoryLabel={overviewHistoryLabel}
              overviewCanLoadMore={overviewCanLoadMore}
              onLoadMoreOverview={onLoadMoreOverview}
              detailHistoryLabel={detailHistoryLabel}
              detailCanLoadMore={detailCanLoadMore}
              onLoadMoreDetail={onLoadMoreDetail}
              overviewLoading={overviewLoading}
              overviewError={overviewError}
              loading={detailLoading}
              errorMessage={detailError}
              t={t}
            />
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
      className={`${codexLiveWorkbenchFilterOptionClass} ${
        bordered ? 'border-r border-[var(--gt-border-subtle)]' : ''
      } ${topBorder ? 'border-t border-[var(--gt-border-subtle)]' : ''} ${
        active
          ? 'bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
          : 'text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-canvas)] hover:text-[var(--gt-ink-primary)]'
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
