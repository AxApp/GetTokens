import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import {
  getCodexSessionDetail,
  getCodexSessionManagementSnapshot,
  refreshCodexSessionManagementSnapshot,
} from './api.ts';
import {
  persistSessionManagementSnapshot,
  readStoredSessionManagementSnapshot,
} from './cache.ts';
import { getSessionManagementPreviewDetailID } from './previewData.ts';
import type { SessionManagementWorkspace } from '../../types';
import type {
  MessageRole,
  ProjectSummary,
  SessionDetail,
  SessionFilter,
  SessionManagementSnapshot,
} from './model.ts';

const EMPTY_VALUE = '—';

const EMPTY_SNAPSHOT: SessionManagementSnapshot = {
  stats: {
    projectCount: 0,
    sessionCount: 0,
    activeSessionCount: 0,
    archivedSessionCount: 0,
    lastScanAt: EMPTY_VALUE,
    providerSummary: EMPTY_VALUE,
  },
  projects: [],
};

const INITIAL_DETAIL_STATE = {
  sessionID: null,
  detail: null,
  loading: false,
  refreshing: false,
  error: null,
} as const;

const filters: ReadonlyArray<{ id: SessionFilter; labelKey: string }> = [
  { id: 'all', labelKey: 'session_management.filter_all' },
  { id: 'active', labelKey: 'session_management.filter_active' },
  { id: 'archived', labelKey: 'session_management.filter_archived' },
];

function roleTone(role: MessageRole) {
  if (role === 'system') {
    return 'text-[var(--accent-red)]';
  }
  if (role === 'assistant') {
    return 'text-[var(--text-primary)]';
  }
  return 'text-[var(--text-muted)]';
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function createCopy(locale: 'zh' | 'en', t: (key: string) => string) {
  const isEnglish = locale === 'en';
  const resolve = (key: string, zhText: string, enText: string) => {
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
    return isEnglish ? enText : zhText;
  };

  return {
    refresh: isEnglish ? 'Refresh' : '刷新',
    refreshing: isEnglish ? 'Refreshing' : '刷新中',
    retry: isEnglish ? 'Retry' : '重试',
    loadFailed: isEnglish ? 'Load failed' : '加载失败',
    loading: isEnglish ? 'Loading' : '加载中',
    unavailable: EMPTY_VALUE,
    sessionsUnit: isEnglish ? 'sessions' : '会话',
    noProjects: isEnglish ? 'No project data yet.' : '当前还没有项目数据。',
    noSessions: isEnglish ? 'No sessions match the current filter.' : '当前筛选下没有会话。',
    noMessages: isEnglish ? 'No message records available.' : '当前会话没有消息记录。',
    projectStatusLine: (project: ProjectSummary) =>
      isEnglish
        ? `Active ${project.activeSessionCount} / Archived ${project.archivedSessionCount}`
        : `活跃 ${project.activeSessionCount} / 归档 ${project.archivedSessionCount}`,
    projectSubtitleLine: (project: ProjectSummary) =>
      isEnglish
        ? `${project.sessionCount} sessions / Active ${project.activeSessionCount} / Archived ${project.archivedSessionCount} / ${project.providerSummary || EMPTY_VALUE} / ${project.lastActiveAt}`
        : `${project.sessionCount} 条会话 / 活跃 ${project.activeSessionCount} / 归档 ${project.archivedSessionCount} / ${project.providerSummary || EMPTY_VALUE} / ${project.lastActiveAt}`,
    sessionSubtitleLine: (session: {
      summary: string;
      messageCount: number;
      status: 'active' | 'archived';
      updatedAt: string;
    }) =>
      isEnglish
        ? `${session.status === 'active' ? 'Active' : 'Archived'} / ${session.summary || EMPTY_VALUE} / ${session.messageCount} messages / ${session.updatedAt}`
        : `${session.status === 'active' ? '活跃' : '已归档'} / ${session.summary || EMPTY_VALUE} / ${session.messageCount} 条消息 / ${session.updatedAt}`,
    summaryLine: (snapshot: SessionManagementSnapshot['stats']) =>
      isEnglish
        ? `${snapshot.projectCount} projects / ${snapshot.sessionCount} sessions`
        : `${snapshot.projectCount} 个项目 / ${snapshot.sessionCount} 条会话`,
    headerSubtitleLine: (snapshot: SessionManagementSnapshot['stats']) =>
      isEnglish
        ? `${snapshot.projectCount} projects / ${snapshot.sessionCount} sessions / ${snapshot.providerSummary} / ${snapshot.lastScanAt}`
        : `${snapshot.projectCount} 个项目 / ${snapshot.sessionCount} 条会话 / ${snapshot.providerSummary} / ${snapshot.lastScanAt}`,
    scanLine: (value: string) => (isEnglish ? `Last scan / ${value}` : `最近扫描 / ${value}`),
    providerLine: (value: string) => `Provider / ${value}`,
    projectListTitle: resolve('session_management.project_list', '项目列表', 'Projects'),
    projectSessionsTitle: resolve('session_management.project_sessions', '项目会话', 'Sessions'),
    modalTitle: resolve('session_management.modal_title', '会话详情', 'Session Detail'),
    close: resolve('session_management.modal_close', '关闭', 'Close'),
    filterActive: resolve('session_management.filter_active', '活跃', 'Active'),
    filterArchived: resolve('session_management.filter_archived', '已归档', 'Archived'),
    roleSystem: resolve('session_management.message_role_system', '系统', 'System'),
    roleUser: resolve('session_management.message_role_user', '用户', 'User'),
    roleAssistant: resolve('session_management.message_role_assistant', '助手', 'Assistant'),
    metaMessages: resolve('session_management.session_meta_messages', '消息', 'Messages'),
    metaRoles: resolve('session_management.session_meta_roles', '角色分布', 'Roles'),
    metaUpdated: resolve('session_management.session_meta_updated', '最近更新', 'Updated'),
    metaFile: resolve('session_management.session_meta_file', '文件', 'File'),
    metaProvider: resolve('session_management.project_meta_provider', 'Provider', 'Provider'),
    modalMetaStatus: isEnglish ? 'Status' : '状态',
    modalMetaCurrent: resolve('session_management.modal_summary_current', '当前消息', 'Current'),
    modalMetaTopic: resolve('session_management.modal_summary_topic', '主题', 'Topic'),
  };
}

function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[12rem] flex-col items-start justify-center gap-3 px-5 py-6 text-left">
      <div className="text-sm font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">{title}</div>
      {description ? (
        <div className="max-w-2xl text-[0.75rem] leading-6 text-[var(--text-muted)]">{description}</div>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="border-2 border-[var(--border-color)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-[0.22em] transition-colors hover:bg-[var(--border-color)] hover:text-[var(--bg-main)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

interface SessionDetailState {
  sessionID: string | null;
  detail: SessionDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

interface SessionManagementFeatureProps {
  workspace?: SessionManagementWorkspace;
}

export default function SessionManagementFeature({ workspace = 'codex' }: SessionManagementFeatureProps) {
  const { locale, t } = useI18n();
  const copy = useMemo(() => createCopy(locale, t), [locale, t]);
  const cachedSnapshotRef = useRef<SessionManagementSnapshot | null>(readStoredSessionManagementSnapshot());
  const [snapshot, setSnapshot] = useState<SessionManagementSnapshot | null>(cachedSnapshotRef.current);
  const [snapshotLoading, setSnapshotLoading] = useState(cachedSnapshotRef.current === null);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [activeFilter, setActiveFilter] = useState<SessionFilter>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<SessionDetailState>(INITIAL_DETAIL_STATE);
  const snapshotRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const loadSnapshot = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const requestID = snapshotRequestRef.current + 1;
      snapshotRequestRef.current = requestID;

      if (mode === 'refresh') {
        setSnapshotRefreshing(true);
      } else {
        setSnapshotLoading(true);
      }
      setSnapshotError(null);

      try {
        const nextSnapshot =
          mode === 'refresh'
            ? await refreshCodexSessionManagementSnapshot()
            : await getCodexSessionManagementSnapshot();
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshot(nextSnapshot);
        persistSessionManagementSnapshot(nextSnapshot);
      } catch (error) {
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshotError(toErrorMessage(error, copy.loadFailed));
      } finally {
        if (snapshotRequestRef.current !== requestID) {
          return;
        }
        setSnapshotLoading(false);
        setSnapshotRefreshing(false);
      }
    },
    [copy.loadFailed],
  );

  const loadDetail = useCallback(
    async (sessionID: string, mode: 'initial' | 'refresh' = 'initial') => {
      const requestID = detailRequestRef.current + 1;
      detailRequestRef.current = requestID;

      setDetailState((previous) => {
        const keepCurrent = previous.sessionID === sessionID ? previous.detail : null;
        return {
          sessionID,
          detail: keepCurrent,
          loading: keepCurrent === null,
          refreshing: mode === 'refresh' && keepCurrent !== null,
          error: null,
        };
      });

      try {
        const detail = await getCodexSessionDetail(sessionID);
        if (detailRequestRef.current !== requestID) {
          return;
        }
        setDetailState({
          sessionID,
          detail,
          loading: false,
          refreshing: false,
          error: null,
        });
      } catch (error) {
        if (detailRequestRef.current !== requestID) {
          return;
        }
        setDetailState((previous) => ({
          sessionID,
          detail: previous.sessionID === sessionID ? previous.detail : null,
          loading: false,
          refreshing: false,
          error: toErrorMessage(error, copy.loadFailed),
        }));
      }
    },
    [copy.loadFailed],
  );

  useEffect(() => {
    const initialMode = cachedSnapshotRef.current ? 'refresh' : 'initial';
    cachedSnapshotRef.current = null;
    void loadSnapshot(initialMode);
  }, [loadSnapshot]);

  const projects = snapshot?.projects ?? EMPTY_SNAPSHOT.projects;
  const stats = snapshot?.stats ?? EMPTY_SNAPSHOT.stats;

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );

  const visibleSessions = useMemo(() => {
    if (!activeProject) {
      return [];
    }
    if (activeFilter === 'all') {
      return activeProject.sessions;
    }
    return activeProject.sessions.filter((session) => session.status === activeFilter);
  }, [activeFilter, activeProject]);

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
      detailRequestRef.current += 1;
      setDetailState(INITIAL_DETAIL_STATE);
      return;
    }

    void loadDetail(selectedSessionId);
  }, [loadDetail, selectedSessionId]);

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
      if (role === 'assistant') {
        return copy.roleAssistant;
      }
      return copy.roleUser;
    },
    [copy.roleAssistant, copy.roleSystem, copy.roleUser],
  );

  const renderSessionsBody = () => {
    if (snapshotLoading && !snapshot) {
      return <StatePanel title={copy.loading} description={copy.scanLine(copy.unavailable)} />;
    }

    if (snapshotError && !snapshot) {
      return <StatePanel title={copy.loadFailed} description={snapshotError} actionLabel={copy.retry} onAction={() => void loadSnapshot()} />;
    }

    if (!projects.length) {
      return <StatePanel title={copy.noProjects} description={copy.scanLine(stats.lastScanAt)} actionLabel={copy.refresh} onAction={() => void loadSnapshot('refresh')} />;
    }

    return (
      <>
        {snapshotError ? (
          <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--accent-red)]">
            {copy.loadFailed} / {snapshotError}
          </div>
        ) : null}
        <div className="min-h-0 overflow-y-auto">
          {visibleSessions.length ? (
            visibleSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className="w-full border-b border-[var(--border-color)] px-5 py-4 text-left transition-colors hover:bg-[var(--bg-surface)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.16em]">{session.title}</div>
                    <div className="mt-2 truncate text-[0.625rem] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {copy.sessionSubtitleLine(session)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`inline-flex border px-2 py-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] ${
                        session.status === 'active'
                          ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                          : 'border-[var(--border-color)] text-[var(--text-muted)]'
                      }`}
                    >
                      {session.status === 'active' ? copy.filterActive : copy.filterArchived}
                    </div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <StatePanel title={copy.noSessions} description={activeProject?.name ?? copy.unavailable} />
          )}
        </div>
      </>
    );
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--bg-surface)] px-6 py-6 text-[var(--text-primary)]">
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

      <div className="mt-6 grid min-h-0 flex-1 grid-cols-[22rem_minmax(0,1fr)] gap-6 max-[960px]:grid-cols-1">
        <section className="flex min-h-0 flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
          <div className="flex h-14 items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-5">
            <h2 className="text-[0.75rem] font-black uppercase tracking-[0.3em]">{copy.projectListTitle}</h2>
            {snapshotRefreshing ? (
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {copy.refreshing}
              </div>
            ) : null}
          </div>
          {snapshotLoading && !snapshot ? (
            <StatePanel title={copy.loading} description={copy.summaryLine(stats)} />
          ) : snapshotError && !snapshot ? (
            <StatePanel title={copy.loadFailed} description={snapshotError} actionLabel={copy.retry} onAction={() => void loadSnapshot()} />
          ) : projects.length ? (
            <div className="min-h-0 overflow-y-auto">
              {projects.map((project) => {
                const isActive = project.id === activeProject?.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setActiveProjectId(project.id)}
                    className={`w-full border-b border-[var(--border-color)] px-5 py-4 text-left transition-colors ${
                      isActive ? 'bg-[var(--border-color)] text-[var(--bg-main)]' : 'bg-transparent hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-black uppercase tracking-[0.18em]">{project.name}</div>
                        <div
                          className={`mt-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] ${
                            isActive ? 'text-[var(--bg-main)]/80' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {copy.projectSubtitleLine(project)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <StatePanel title={copy.noProjects} description={copy.scanLine(stats.lastScanAt)} actionLabel={copy.refresh} onAction={() => void loadSnapshot('refresh')} />
          )}
        </section>

        <section className="flex min-h-0 flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--border-color)] px-5 py-3">
            <div>
              <h2 className="text-[0.75rem] font-black uppercase tracking-[0.3em]">{copy.projectSessionsTitle}</h2>
              <div className="mt-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {activeProject?.name ?? copy.unavailable}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {filters.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`border px-3 py-1 text-[0.625rem] font-black uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                        : 'border-[var(--border-color)] bg-transparent text-[var(--text-primary)]'
                    }`}
                  >
                    {t(filter.labelKey)}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void loadSnapshot('refresh')}
                className="border px-3 py-1 text-[0.625rem] font-black uppercase tracking-[0.18em] transition-colors hover:bg-[var(--bg-surface)]"
              >
                {copy.refresh}
              </button>
            </div>
          </div>
          {renderSessionsBody()}
        </section>
      </div>

      {selectedSessionId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
          onClick={() => setSelectedSessionId(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-6xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-management-dialog-title"
          >
            <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-5">
              <div>
                <div className="text-[0.625rem] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  {modalProjectName} / {copy.modalTitle}
                </div>
                <h3 id="session-management-dialog-title" className="mt-2 text-2xl font-black italic uppercase tracking-tight">
                  {selectedSessionDetail?.title ?? selectedSessionSummary?.title ?? copy.loading}
                </h3>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>
                    {copy.modalMetaStatus} / {selectedSessionStatus === null ? copy.unavailable : selectedSessionStatus === 'archived' ? copy.filterArchived : copy.filterActive}
                  </span>
                  <span>
                    {copy.metaMessages} / {(selectedSessionDetail?.messageCount ?? selectedSessionSummary?.messageCount) ?? 0}
                  </span>
                  <span>
                    {copy.metaFile} / {selectedSessionDetail?.fileLabel ?? selectedSessionSummary?.fileLabel ?? copy.unavailable}
                  </span>
                  <span>
                    {copy.modalMetaCurrent} / {selectedSessionDetail?.currentMessageLabel ?? copy.unavailable}
                  </span>
                  <span>
                    {copy.metaRoles} / {selectedSessionDetail?.roleSummary ?? selectedSessionSummary?.roleSummary ?? copy.unavailable}
                  </span>
                  <span>
                    {copy.modalMetaTopic} / {selectedSessionDetail?.topic ?? copy.unavailable}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {detailState.refreshing ? (
                  <div className="text-[0.625rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    {copy.refreshing}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSessionId) {
                      void loadDetail(selectedSessionId, 'refresh');
                    }
                  }}
                  className="border-2 border-[var(--border-color)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-[0.22em] transition-colors hover:bg-[var(--border-color)] hover:text-[var(--bg-main)]"
                >
                  {copy.refresh}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(null)}
                  className="border-2 border-[var(--border-color)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-[0.22em] transition-colors hover:bg-[var(--border-color)] hover:text-[var(--bg-main)]"
                >
                  {copy.close}
                </button>
              </div>
            </div>
            {detailState.error ? (
              <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-[var(--accent-red)]">
                {copy.loadFailed} / {detailState.error}
              </div>
            ) : null}
            <div className="min-h-0 overflow-y-auto">
              {detailState.loading && !selectedSessionDetail ? (
                <div className="px-6 py-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`placeholder-${index}`}
                      className="grid gap-3 border-b border-[var(--border-color)] py-4 md:grid-cols-[5rem_6rem_8rem_minmax(0,16rem)_minmax(0,1fr)] md:items-start"
                    >
                      <div className="h-4 w-10 bg-[var(--bg-surface)]" />
                      <div className="h-4 w-14 bg-[var(--bg-surface)]" />
                      <div className="h-4 w-16 bg-[var(--bg-surface)]" />
                      <div className="h-4 w-32 bg-[var(--bg-surface)]" />
                      <div className="h-4 w-full bg-[var(--bg-surface)]" />
                    </div>
                  ))}
                </div>
              ) : selectedSessionDetail?.messages.length ? (
                selectedSessionDetail.messages.map((message, index) => (
                  <div
                    key={message.id}
                    className="grid gap-3 border-b border-[var(--border-color)] px-6 py-4 md:grid-cols-[5rem_6rem_8rem_minmax(0,16rem)_minmax(0,1fr)] md:items-start"
                  >
                    <div className="text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      #{String(index + 1).padStart(2, '0')}
                    </div>
                    <div className={`text-[0.625rem] font-black uppercase tracking-[0.18em] ${roleTone(message.role)}`}>
                      {renderRoleLabel(message.role)}
                    </div>
                    <div className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{message.timeLabel}</div>
                    <div className="text-[0.75rem] font-black uppercase tracking-[0.12em]">{message.title}</div>
                    <div className="text-[0.75rem] leading-6 text-[var(--text-primary)]">{message.summary}</div>
                  </div>
                ))
              ) : detailState.error ? (
                <StatePanel title={copy.loadFailed} description={detailState.error} actionLabel={copy.retry} onAction={() => selectedSessionId && void loadDetail(selectedSessionId)} />
              ) : (
                <StatePanel title={copy.noMessages} description={selectedSessionSummary?.title ?? copy.unavailable} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
