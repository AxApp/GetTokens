import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, RefreshCw, X } from 'lucide-react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import { analyzeCodexSessions } from './api.ts';
import { getSessionManagementPreviewDetailID } from './previewData.ts';
import { createSessionManagementCopy } from './sessionManagementCopy.ts';
import {
  COMPACT_LAYOUT_MAX_WIDTH,
  sessionFilters,
} from './sessionManagementUtils.ts';
import { useSessionManagementProviderMerge } from './useSessionManagementProviderMerge.ts';
import { useSessionManagementSnapshot } from './useSessionManagementSnapshot.ts';
import { useSessionManagementDetail } from './useSessionManagementDetail.ts';
import type { SessionManagementWorkspace } from '../../types';
import type {
  MessageRole,
  SessionAnalysisPluginMode,
  SessionAnalysisResult,
  SessionFilter,
} from './model.ts';
import {
  buildSessionAnalysisInput,
  filterSessionManagementProjects,
  filterSessionManagementSessions,
} from './model.ts';
import {
  InitialLoadingShell,
  ProjectListPanel,
  ProviderMergeModal,
  SessionAnalysisDetailModal,
  SessionAnalysisScopeModal,
  SessionDetailModal,
  SessionManagementSearchBar,
  SessionsPanel,
} from './SessionManagementView.tsx';

interface SessionManagementFeatureProps {
  workspace?: SessionManagementWorkspace;
}

const SESSION_ANALYSIS_RECENT_LIMIT = 20;

interface SessionAnalysisRunRequest {
  mode: SessionAnalysisPluginMode;
  projectID?: string;
  sessionIDs?: string[];
  recentLimit?: number;
  label: string;
}

export default function SessionManagementFeature({ workspace = 'codex' }: SessionManagementFeatureProps) {
  const { locale, t } = useI18n();
  const copy = useMemo(() => createSessionManagementCopy(locale, t), [locale, t]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [activeFilter, setActiveFilter] = useState<SessionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [compactLayout, setCompactLayout] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= COMPACT_LAYOUT_MAX_WIDTH : false,
  );
  const [compactSessionsOpen, setCompactSessionsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [analysisSelectorOpen, setAnalysisSelectorOpen] = useState(false);
  const [analysisDetailOpen, setAnalysisDetailOpen] = useState(false);
  const [analysisScopeLabel, setAnalysisScopeLabel] = useState('');
  const [analysisResult, setAnalysisResult] = useState<SessionAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisButtonRef = useRef<HTMLButtonElement | null>(null);
  const {
    snapshot: rawSnapshot,
    snapshotLoading,
    snapshotRefreshing,
    snapshotError,
    loadSnapshot,
    updateSnapshot,
  } = useSessionManagementSnapshot(workspace, copy.loadFailed);
  const {
    detailState,
    loadDetail,
    loadMoreMessages,
    loadMessageRawJSON,
    clearDetail,
  } = useSessionManagementDetail(workspace, copy.loadFailed);

  useEffect(() => {
    void loadSnapshot('initial');
  }, [loadSnapshot]);

  const snapshot = rawSnapshot;
  const projects = snapshot.projects;
  const stats = snapshot.stats;

  const filteredProjects = useMemo(() => {
    return filterSessionManagementProjects(projects, searchQuery);
  }, [projects, searchQuery]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );
  const {
    editingProject,
    editingProjectId,
    editingProjectProviderRows,
    editingProjectProviderCandidates,
    providerSaving,
    providerEditorError,
    openProviderEditor,
    closeProviderEditor,
    resetProviderDraft,
    updateDraftValue,
    saveProviderMerge,
  } = useSessionManagementProviderMerge({
    snapshot,
    projects,
    unknownProviderLabel: copy.unknownProvider,
    loadFailedMessage: copy.loadFailed,
    onSnapshotUpdated: updateSnapshot,
  });

  const visibleSessions = useMemo(() => {
    if (!activeProject) {
      return [];
    }
    let sessions = activeProject.sessions;
    if (activeFilter !== 'all') {
      sessions = sessions.filter((session) => session.status === activeFilter);
    }
    return filterSessionManagementSessions(activeProject, searchQuery, sessions);
  }, [activeFilter, activeProject, searchQuery]);

  const selectedSessionSummary = useMemo(
    () => activeProject?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [activeProject, selectedSessionId],
  );
  const recentAnalysisSessionIDs = useMemo(
    () => visibleSessions.slice(0, SESSION_ANALYSIS_RECENT_LIMIT).map((session) => session.id),
    [visibleSessions],
  );

  const selectedSessionDetail =
    selectedSessionId && detailState.sessionID === selectedSessionId ? detailState.detail : null;
  const selectedSessionStatus = selectedSessionDetail?.status ?? selectedSessionSummary?.status ?? null;

  const modalProjectName = useMemo(() => {
    if (selectedSessionDetail?.projectID) {
      return projects.find((project) => project.id === selectedSessionDetail.projectID)?.name ?? copy.unavailable;
    }
    return activeProject?.name ?? copy.unavailable;
  }, [activeProject, copy.unavailable, projects, selectedSessionDetail?.projectID]);

  useEffect(() => {
    if (!projects.length) {
      if (activeProjectId) {
        setActiveProjectId('');
      }
      return;
    }

    if (!projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProjectId, projects]);

  // When search changes, auto-select first filtered project if current is hidden
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !filteredProjects.length) return;
    if (!filteredProjects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(filteredProjects[0].id);
    }
  }, [searchQuery, filteredProjects, activeProjectId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onResize = () => {
      setCompactLayout(window.innerWidth <= COMPACT_LAYOUT_MAX_WIDTH);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (!compactLayout) {
      setCompactSessionsOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    if (!projects.length || selectedSessionId) {
      return;
    }

    const previewDetailID = getSessionManagementPreviewDetailID();
    if (!previewDetailID) {
      return;
    }

    const projectWithSession = projects.find((project) =>
      project.sessions.some((session) => session.id === previewDetailID),
    );
    if (!projectWithSession) {
      return;
    }

    if (activeProjectId !== projectWithSession.id) {
      setActiveProjectId(projectWithSession.id);
    }
    setSelectedSessionId(previewDetailID);
  }, [activeProjectId, projects, selectedSessionId]);

  useEffect(() => {
    setSelectedSessionId(null);
  }, [activeFilter, activeProjectId]);

  useEffect(() => {
    if (!selectedSessionId) {
      clearDetail();
      return;
    }

    void loadDetail(selectedSessionId);
  }, [clearDetail, loadDetail, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedSessionId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedSessionId]);

  const renderRoleLabel = useCallback(
    (role: MessageRole) => {
      if (role === 'system') {
        return copy.roleSystem;
      }
      if (role === 'reasoning') {
        return copy.roleReasoning;
      }
      if (role === 'tool_call') {
        return copy.roleToolCall;
      }
      if (role === 'tool_result') {
        return copy.roleToolResult;
      }
      if (role === 'event') {
        return copy.roleEvent;
      }
      if (role === 'assistant') {
        return copy.roleAssistant;
      }
      return copy.roleUser;
    },
    [
      copy.roleAssistant,
      copy.roleEvent,
      copy.roleReasoning,
      copy.roleSystem,
      copy.roleToolCall,
      copy.roleToolResult,
      copy.roleUser,
    ],
  );

  const runAnalysis = useCallback(
    async (request: SessionAnalysisRunRequest) => {
      if (workspace !== 'codex') {
        return;
      }
      setAnalysisSelectorOpen(false);
      setAnalysisDetailOpen(true);
      setAnalysisScopeLabel(request.label);
      setAnalysisResult(null);
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        const input = buildSessionAnalysisInput({
          mode: request.mode,
          projectID: request.projectID,
          sessionIDs: request.sessionIDs,
          recentLimit: request.recentLimit,
        });
        if (input.scope === 'selected' && !input.sessionIDs?.length) {
          throw new Error(copy.noSessions);
        }
        const result = await analyzeCodexSessions(input);
        setAnalysisResult(result);
      } catch (error) {
        setAnalysisError(error instanceof Error && error.message ? error.message : copy.loadFailed);
      } finally {
        setAnalysisLoading(false);
      }
    },
    [copy.loadFailed, copy.noSessions, workspace],
  );

  const focusAnalysisEntry = useCallback(() => {
    window.requestAnimationFrame(() => {
      analysisButtonRef.current?.focus();
    });
  }, []);

  const closeAnalysisSelector = useCallback(() => {
    setAnalysisSelectorOpen(false);
    focusAnalysisEntry();
  }, [focusAnalysisEntry]);

  const closeAnalysisDetail = useCallback(() => {
    setAnalysisDetailOpen(false);
    focusAnalysisEntry();
  }, [focusAnalysisEntry]);

  if (snapshotLoading && !projects.length && !snapshotError) {
    return <InitialLoadingShell copy={copy} />;
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--gt-surface-canvas)] text-[var(--text-primary)] select-text">
      <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col gap-4 px-6 py-5">
      <WorkspacePageHeader
        title={t('session_management.title')}
        meta={
          <span
            className="block max-w-[min(62rem,70vw)] truncate text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-muted)]"
            title={copy.headerSubtitleLine(stats)}
          >
            {copy.headerSubtitleLine(stats)}
          </span>
        }
        actionsClassName="gap-2"
        actions={
          <>
            {snapshotRefreshing ? (
              <div className="text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-muted)]">
                {copy.refreshing}
              </div>
            ) : null}
            {workspace === 'codex' ? (
              <button
                type="button"
                ref={analysisButtonRef}
                aria-label={copy.analysisOpen}
                title={copy.analysisOpen}
                onClick={() => {
                  if (!projects.length || analysisLoading) {
                    return;
                  }
                  setAnalysisSelectorOpen(true);
                }}
                aria-disabled={!projects.length || analysisLoading ? 'true' : undefined}
                className={`inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] ${
                  !projects.length || analysisLoading ? 'cursor-not-allowed opacity-50' : ''
                }`}
              >
                <BarChart3 className="h-5 w-5" strokeWidth={2.4} />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={copy.refresh}
              title={copy.refresh}
              onClick={() => void loadSnapshot('refresh')}
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
            >
              <RefreshCw className={`h-5 w-5 ${snapshotRefreshing ? 'animate-spin' : ''}`} strokeWidth={2.4} />
            </button>
          </>
        }
      />

      <div
        data-session-management-workbench="true"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-[var(--gt-elevation-raised-2)]"
      >
        <SessionManagementSearchBar
          copy={copy}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className={`flex min-h-0 flex-1 ${compactLayout ? 'flex-col' : 'flex-row'}`}>
          <div className={`flex min-h-0 flex-col border-[var(--gt-border-subtle)] ${compactLayout ? 'w-full border-b' : 'w-[20rem] shrink-0 border-r'}`}>
            <ProjectListPanel
              copy={copy}
              projects={filteredProjects}
              stats={stats}
              activeProjectId={activeProject?.id ?? ''}
              compactLayout={compactLayout}
              snapshotLoading={snapshotLoading}
              snapshotRefreshing={snapshotRefreshing}
              snapshotError={snapshotError}
              searchActive={Boolean(searchQuery.trim())}
              onRetry={() => void loadSnapshot()}
              onRefresh={() => void loadSnapshot('refresh')}
              onSelectProject={(projectID, openCompact) => {
                setActiveProjectId(projectID);
                if (openCompact) {
                  setCompactSessionsOpen(true);
                }
              }}
              onOpenProviderEditor={workspace === 'codex' ? openProviderEditor : undefined}
            />
          </div>

          {compactLayout ? null : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <SessionsPanel
                copy={copy}
                activeProjectName={activeProject?.name ?? copy.unavailable}
                activeFilter={activeFilter}
                filters={sessionFilters.map((filter) => ({
                  id: filter.id,
                  label: t(filter.labelKey),
                }))}
                snapshotLoading={snapshotLoading}
                snapshotError={snapshotError}
                searchActive={Boolean(searchQuery.trim())}
                visibleSessions={visibleSessions}
                onRetry={() => void loadSnapshot()}
                onRefresh={() => void loadSnapshot('refresh')}
                onSelectFilter={setActiveFilter}
                onSelectSession={setSelectedSessionId}
              />
            </div>
          )}
        </div>
      </div>

      {compactLayout && compactSessionsOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--overlay-scrim-60)] p-4 backdrop-blur-sm sm:p-6"
          onClick={() => setCompactSessionsOpen(false)}
        >
          <div
            className="flex h-[80vh] w-full max-w-4xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setCompactSessionsOpen(false)}
                aria-label={copy.close}
                title={copy.close}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>
            <SessionsPanel
              copy={copy}
              activeProjectName={activeProject?.name ?? copy.unavailable}
              activeFilter={activeFilter}
              filters={sessionFilters.map((filter) => ({
                id: filter.id,
                label: t(filter.labelKey),
              }))}
              snapshotLoading={snapshotLoading}
              snapshotError={snapshotError}
              searchActive={Boolean(searchQuery.trim())}
              visibleSessions={visibleSessions}
              onRetry={() => void loadSnapshot()}
              onRefresh={() => void loadSnapshot('refresh')}
              onSelectFilter={setActiveFilter}
              onSelectSession={setSelectedSessionId}
            />
          </div>
        </div>
      ) : null}

      {workspace === 'codex' && editingProjectId ? (
        <ProviderMergeModal
          copy={copy}
          projectName={editingProject?.name ?? copy.unavailable}
          rows={editingProjectProviderRows}
          candidates={editingProjectProviderCandidates}
          saving={providerSaving}
          error={providerEditorError}
          onClose={closeProviderEditor}
          onReset={resetProviderDraft}
          onSave={() => void saveProviderMerge()}
          onChangeValue={updateDraftValue}
        />
      ) : null}

      {workspace === 'codex' && analysisSelectorOpen ? (
        <SessionAnalysisScopeModal
          copy={copy}
          projects={projects}
          activeProjectId={activeProject?.id ?? ''}
          activeProjectName={activeProject?.name ?? copy.unavailable}
          visibleSessions={visibleSessions}
          recentLimit={SESSION_ANALYSIS_RECENT_LIMIT}
          onClose={closeAnalysisSelector}
          onAnalyzeAll={() => void runAnalysis({
            mode: 'all',
            label: copy.analysisAll,
          })}
          onAnalyzeRecent={() => void runAnalysis({
            mode: 'recent',
            sessionIDs: recentAnalysisSessionIDs,
            recentLimit: SESSION_ANALYSIS_RECENT_LIMIT,
            label: copy.analysisRecent(SESSION_ANALYSIS_RECENT_LIMIT),
          })}
          onAnalyzeProject={(project) => void runAnalysis({
            mode: 'project',
            projectID: project.id,
            label: `${copy.analysisProject} / ${project.name}`,
          })}
          onAnalyzeSession={(session) => void runAnalysis({
            mode: 'recent',
            sessionIDs: [session.id],
            recentLimit: 1,
            label: `${copy.analysisSelectSession} / ${session.title || session.fileLabel}`,
          })}
        />
      ) : null}

      {workspace === 'codex' && analysisDetailOpen ? (
        <SessionAnalysisDetailModal
          copy={copy}
          scopeLabel={analysisScopeLabel || copy.analysisTitle}
          result={analysisResult}
          loading={analysisLoading}
          error={analysisError}
          onClose={closeAnalysisDetail}
          onBackToSelection={() => {
            setAnalysisDetailOpen(false);
            setAnalysisSelectorOpen(true);
          }}
        />
      ) : null}

      {selectedSessionId ? (
        <SessionDetailModal
          copy={copy}
          detailState={detailState}
          selectedSessionSummary={selectedSessionSummary}
          selectedSessionDetail={selectedSessionDetail}
          selectedSessionStatus={selectedSessionStatus}
          modalProjectName={modalProjectName}
          onClose={() => setSelectedSessionId(null)}
          onRefresh={() => {
            if (selectedSessionId) {
              void loadDetail(selectedSessionId, 'refresh');
            }
          }}
          onRetry={() => {
            if (selectedSessionId) {
              void loadDetail(selectedSessionId);
            }
          }}
          onLoadMoreMessages={() => void loadMoreMessages()}
          onViewRawJSON={(message) => void loadMessageRawJSON(message)}
          renderRoleLabel={renderRoleLabel}
        />
      ) : null}
      </div>
    </section>
  );
}
