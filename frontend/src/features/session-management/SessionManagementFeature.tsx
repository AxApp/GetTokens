import { useCallback, useEffect, useMemo, useState } from 'react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
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
  SessionFilter,
} from './model.ts';
import {
  InitialLoadingShell,
  ProjectListPanel,
  ProviderMergeModal,
  SessionDetailModal,
  SessionManagementSearchBar,
  SessionsPanel,
} from './SessionManagementView.tsx';

interface SessionManagementFeatureProps {
  workspace?: SessionManagementWorkspace;
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
  const {
    snapshot: rawSnapshot,
    snapshotLoading,
    snapshotRefreshing,
    snapshotError,
    loadSnapshot,
    updateSnapshot,
  } = useSessionManagementSnapshot(copy.loadFailed);
  const {
    detailState,
    loadDetail,
    clearDetail,
  } = useSessionManagementDetail(copy.loadFailed);

  useEffect(() => {
    void loadSnapshot('initial');
  }, [loadSnapshot]);

  const snapshot = rawSnapshot;
  const projects = snapshot.projects;
  const stats = snapshot.stats;

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sessions.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.summary.toLowerCase().includes(q),
        ),
    );
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
    const q = searchQuery.trim().toLowerCase();
    let sessions = activeProject.sessions;
    if (activeFilter !== 'all') {
      sessions = sessions.filter((session) => session.status === activeFilter);
    }
    if (q) {
      sessions = sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q),
      );
    }
    return sessions;
  }, [activeFilter, activeProject, searchQuery]);

  const selectedSessionSummary = useMemo(
    () => activeProject?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [activeProject, selectedSessionId],
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

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--bg-surface)] px-6 py-6 text-[var(--text-primary)] select-text">
      <WorkspacePageHeader
        title={t('session_management.title')}
        subtitle={copy.headerSubtitleLine(stats)}
        subtitleClassName="mt-3 truncate whitespace-nowrap text-[0.625rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]"
        actionsClassName="flex items-center gap-3 self-start"
        actions={
          <>
            {snapshotRefreshing ? (
              <div className="text-[0.625rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {copy.refreshing}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void loadSnapshot('refresh')}
              className="btn-swiss whitespace-nowrap"
            >
              {copy.refresh}
            </button>
          </>
        }
      />

      <div className="mt-8 flex min-h-0 flex-1 flex-col border-4 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
        <SessionManagementSearchBar
          copy={copy}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className={`flex min-h-0 flex-1 ${compactLayout ? 'flex-col' : 'flex-row'}`}>
          <div className={`flex min-h-0 flex-col border-[var(--border-color)] ${compactLayout ? 'w-full border-b-4' : 'w-[20rem] shrink-0 border-r-4'}`}>
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
              onOpenProviderEditor={openProviderEditor}
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
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
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
                className="btn-swiss"
              >
                {copy.close}
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

      {editingProjectId ? (
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
          renderRoleLabel={renderRoleLabel}
        />
      ) : null}
    </section>
  );
}
