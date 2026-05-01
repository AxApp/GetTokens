import { Pencil, RefreshCw, X } from 'lucide-react';
import type {
  MessageRole,
  ProjectSummary,
  SessionDetail,
  SessionFilter,
  SessionManagementSnapshot,
  SessionSummary,
} from './model.ts';

export interface SessionManagementCopy {
  refresh: string;
  refreshing: string;
  retry: string;
  loadFailed: string;
  loading: string;
  unavailable: string;
  unknownProvider: string;
  sessionsUnit: string;
  noProjects: string;
  noSessions: string;
  noMessages: string;
  projectStatusLine: (project: ProjectSummary) => string;
  projectSessionTag: (project: ProjectSummary) => string;
  projectActiveTag: (project: ProjectSummary) => string;
  projectArchivedTag: (project: ProjectSummary) => string;
  projectRecentTag: (project: ProjectSummary) => string;
  sessionSubtitleLine: (session: {
    summary: string;
    messageCount: number;
    updatedAt: string;
  }) => string;
  summaryLine: (snapshot: SessionManagementSnapshot['stats']) => string;
  headerSubtitleLine: (snapshot: SessionManagementSnapshot['stats']) => string;
  scanLine: (value: string) => string;
  providerLine: (value: string) => string;
  projectListTitle: string;
  projectSessionsTitle: string;
  modalTitle: string;
  close: string;
  filterActive: string;
  filterArchived: string;
  roleSystem: string;
  roleUser: string;
  roleAssistant: string;
  roleReasoning: string;
  roleToolCall: string;
  roleToolResult: string;
  roleEvent: string;
  metaMessages: string;
  metaRoles: string;
  metaUpdated: string;
  metaFile: string;
  metaProvider: string;
  modalMetaStatus: string;
  modalMetaCurrent: string;
  modalMetaTopic: string;
}

export interface ProviderMergeRow {
  sourceKey: string;
  sourceProvider: string;
  count: number;
  targetProvider: string;
}

export interface SessionDetailState {
  sessionID: string | null;
  detail: SessionDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export function roleTone(role: MessageRole) {
  if (role === 'system') {
    return 'text-[var(--accent-red)]';
  }
  if (role === 'tool_call') {
    return 'text-[var(--accent-red)]';
  }
  if (role === 'tool_result') {
    return 'text-[var(--text-primary)]';
  }
  if (role === 'reasoning') {
    return 'text-[var(--text-primary)]';
  }
  if (role === 'event') {
    return 'text-[var(--text-muted)]';
  }
  if (role === 'assistant') {
    return 'text-[var(--text-primary)]';
  }
  return 'text-[var(--text-muted)]';
}

export function getFileName(value: string | null | undefined, fallback: string) {
  const text = String(value || '').trim();
  if (!text) {
    return fallback;
  }
  const parts = text.split('/');
  return parts[parts.length - 1] || text;
}

export function getProviderDisplayLabel(value: string | null | undefined, fallback: string) {
  const text = String(value || '').trim();
  if (!text || text === '—' || text.toLowerCase() === 'unknown') {
    return fallback;
  }
  return text;
}

export function StatePanel({
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

export function LoadingBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--bg-surface)] ${className}`.trim()} />;
}

export function InitialLoadingShell({ copy }: { copy: SessionManagementCopy }) {
  return (
    <div className="mt-6 grid min-h-0 flex-1 grid-cols-[22rem_minmax(0,1fr)] gap-0 max-[960px]:grid-cols-1">
      <section className="flex min-h-0 flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
        <div className="flex h-14 items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-5">
          <h2 className="text-[0.75rem] font-black uppercase tracking-[0.3em]">{copy.projectListTitle}</h2>
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{copy.loading}</div>
        </div>
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={`project-loading-${index}`} className="border-b border-[var(--border-color)] px-5 py-4">
              <LoadingBar className="h-4 w-32" />
              <LoadingBar className="mt-3 h-3 w-full max-w-[15rem]" />
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
        <div className="flex h-14 items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-5">
          <div className="flex min-w-0 items-center gap-4">
            <h2 className="shrink-0 text-[0.75rem] font-black uppercase tracking-[0.3em]">{copy.projectSessionsTitle}</h2>
            <LoadingBar className="h-3 w-28" />
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingBar key={`filter-loading-${index}`} className="h-8 w-16 border border-[var(--border-color)]" />
            ))}
          </div>
        </div>
        <div className="space-y-0">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`session-loading-${index}`} className="border-b border-[var(--border-color)] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <LoadingBar className="h-4 w-56 max-w-full" />
                  <LoadingBar className="mt-3 h-3 w-full max-w-[28rem]" />
                </div>
                <LoadingBar className="h-7 w-14 border border-[var(--border-color)]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProjectListPanel({
  copy,
  projects,
  stats,
  activeProjectId,
  compactLayout,
  snapshotLoading,
  snapshotRefreshing,
  snapshotError,
  onRetry,
  onRefresh,
  onSelectProject,
  onOpenProviderEditor,
}: {
  copy: SessionManagementCopy;
  projects: ProjectSummary[];
  stats: SessionManagementSnapshot['stats'];
  activeProjectId: string;
  compactLayout: boolean;
  snapshotLoading: boolean;
  snapshotRefreshing: boolean;
  snapshotError: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  onSelectProject: (projectID: string, openCompact: boolean) => void;
  onOpenProviderEditor: (projectID: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
      <div className="flex h-14 items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-5">
        <h2 className="text-[0.75rem] font-black uppercase tracking-[0.3em]">{copy.projectListTitle}</h2>
        {snapshotRefreshing ? (
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {copy.refreshing}
          </div>
        ) : null}
      </div>
      {snapshotLoading && !projects.length && !snapshotError ? (
        <StatePanel title={copy.loading} description={copy.summaryLine(stats)} />
      ) : snapshotError && !projects.length ? (
        <StatePanel title={copy.loadFailed} description={snapshotError} actionLabel={copy.retry} onAction={onRetry} />
      ) : projects.length ? (
        <div className="min-h-0 overflow-y-auto">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id, compactLayout)}
                className={`w-full border-b border-[var(--border-color)] px-5 py-4 text-left transition-colors select-text ${
                  isActive ? 'bg-[var(--border-color)] text-[var(--bg-main)]' : 'bg-transparent hover:bg-[var(--bg-surface)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black uppercase tracking-[0.18em]">{project.name}</div>
                    <div className={`mt-2 truncate text-[0.625rem] font-bold uppercase tracking-[0.16em] ${
                      isActive ? 'text-[var(--bg-main)]/80' : 'text-[var(--text-muted)]'
                    }`}>
                      {[
                        copy.projectSessionTag(project),
                        copy.projectActiveTag(project),
                        copy.projectArchivedTag(project),
                        getProviderDisplayLabel(project.providerSummary, copy.unknownProvider),
                        copy.projectRecentTag(project),
                      ].join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenProviderEditor(project.id);
                    }}
                    className={`btn-swiss shrink-0 !px-2 !py-1 !text-[0.5625rem] !shadow-none ${
                      isActive ? '!border-[var(--bg-main)]/40 !text-[var(--bg-main)] hover:!bg-[var(--bg-main)]/10' : ''
                    }`}
                    title="编辑 provider 归并"
                    aria-label="编辑 provider 归并"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <StatePanel title={copy.noProjects} description={copy.scanLine(stats.lastScanAt)} actionLabel={copy.refresh} onAction={onRefresh} />
      )}
    </section>
  );
}

export function SessionsPanel({
  copy,
  activeProjectName,
  activeFilter,
  filters,
  snapshotLoading,
  snapshotError,
  visibleSessions,
  onRetry,
  onRefresh,
  onSelectFilter,
  onSelectSession,
}: {
  copy: SessionManagementCopy;
  activeProjectName: string;
  activeFilter: SessionFilter;
  filters: ReadonlyArray<{ id: SessionFilter; label: string }>;
  snapshotLoading: boolean;
  snapshotError: string | null;
  visibleSessions: SessionSummary[];
  onRetry: () => void;
  onRefresh: () => void;
  onSelectFilter: (filter: SessionFilter) => void;
  onSelectSession: (sessionID: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
      <div className="flex h-14 items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-5">
        <div className="flex min-w-0 items-center gap-4">
          <h2 className="shrink-0 text-[0.75rem] font-black uppercase tracking-[0.3em]">{copy.projectSessionsTitle}</h2>
          <div className="truncate text-[0.625rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {activeProjectName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onSelectFilter(filter.id)}
                className={`border px-3 py-1 text-[0.625rem] font-black uppercase tracking-[0.18em] transition-all ${
                  isActive
                    ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                    : 'border-[var(--border-color)] bg-transparent text-[var(--text-primary)]'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onRefresh}
            className="border px-3 py-1 text-[0.625rem] font-black uppercase tracking-[0.18em] transition-colors hover:bg-[var(--bg-surface)]"
          >
            {copy.refresh}
          </button>
        </div>
      </div>
      {snapshotLoading && !visibleSessions.length && !snapshotError ? (
        <StatePanel title={copy.loading} description={copy.scanLine(copy.unavailable)} />
      ) : (
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
                  onClick={() => onSelectSession(session.id)}
                  className="w-full border-b border-[var(--border-color)] px-5 py-4 text-left transition-colors hover:bg-[var(--bg-surface)] select-text"
                >
                  <div>
                    <div>
                      {session.title ? (
                        <div className="text-sm font-black uppercase tracking-[0.16em]">{session.title}</div>
                      ) : null}
                      <div className={`${session.title ? 'mt-2 ' : ''}line-clamp-2 text-[0.625rem] font-bold uppercase leading-5 tracking-[0.16em] text-[var(--text-muted)]`}>
                        {copy.sessionSubtitleLine(session)}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.5625rem] font-black uppercase tracking-[0.18em]">
                      <div
                        className={`inline-flex border px-2 py-1 ${
                          session.status === 'active'
                            ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                            : 'border-[var(--border-color)] text-[var(--text-muted)]'
                        }`}
                      >
                        {session.status === 'active' ? copy.filterActive : copy.filterArchived}
                      </div>
                      <div className="inline-flex border border-[var(--border-color)] px-2 py-1 text-[var(--text-muted)]">
                        {getProviderDisplayLabel(session.provider, copy.unknownProvider)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <StatePanel title={copy.noSessions} description={activeProjectName} actionLabel={snapshotError ? copy.retry : undefined} onAction={snapshotError ? onRetry : undefined} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function ProviderMergeModal({
  copy,
  projectName,
  rows,
  candidates,
  saving,
  error,
  onClose,
  onReset,
  onSave,
  onChangeValue,
}: {
  copy: SessionManagementCopy;
  projectName: string;
  rows: ProviderMergeRow[];
  candidates: string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
  onChangeValue: (sourceKey: string, value: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-management-provider-merge-title"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="text-[0.625rem] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Provider 归并
            </div>
            <h3
              id="session-management-provider-merge-title"
              className="mt-2 text-2xl font-black italic uppercase tracking-tight"
            >
              {projectName}
            </h3>
            <div className="mt-3 text-[0.75rem] leading-6 text-[var(--text-muted)]">
              把同一项目下不同 provider 的会话归到同一个 provider 标签下。保存后会直接修改对应 rollout 文件里的 provider。
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            title={copy.close}
            className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[minmax(0,16rem)_minmax(0,1fr)] border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
            <div className="border-b-2 border-r-2 border-[var(--border-color)] px-4 py-3 text-[0.5625rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
              来源 provider
            </div>
            <div className="border-b-2 border-[var(--border-color)] px-4 py-3 text-[0.5625rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
              归并目标
            </div>
            {rows.map((row) => (
              <div
                key={row.sourceKey}
                className="contents"
              >
                <div className="border-b border-r-2 border-[var(--border-color)] px-4 py-4">
                  <div className="text-sm font-black uppercase tracking-[0.16em]">
                    {getProviderDisplayLabel(row.sourceProvider, copy.unknownProvider)}
                  </div>
                  <div className="mt-2 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {row.count} 条会话
                  </div>
                </div>
                <label className="block border-b border-[var(--border-color)] px-4 py-4">
                  <input
                    value={row.targetProvider}
                    disabled={saving}
                    onChange={(event) => onChangeValue(row.sourceKey, event.target.value)}
                    className="w-full border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--text-primary)] outline-none focus:border-[var(--accent-red)]"
                    placeholder={copy.unknownProvider}
                    list={`provider-merge-candidates-${row.sourceKey}`}
                  />
                  <datalist id={`provider-merge-candidates-${row.sourceKey}`}>
                    {candidates.map((candidate) => (
                      <option key={`${row.sourceKey}-${candidate}`} value={candidate} />
                    ))}
                  </datalist>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {candidates.map((candidate) => {
                      const isSelected = candidate === getProviderDisplayLabel(row.targetProvider, copy.unknownProvider);
                      return (
                        <button
                          key={`${row.sourceKey}-${candidate}-chip`}
                          type="button"
                          disabled={saving}
                          onClick={() => onChangeValue(row.sourceKey, candidate)}
                          className={`border px-2.5 py-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] ${
                            isSelected
                              ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                              : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]'
                          }`}
                        >
                          {candidate}
                        </button>
                      );
                    })}
                  </div>
                </label>
              </div>
            ))}
          </div>
          {error ? (
            <div className="mt-4 border border-[var(--accent-red)] bg-[var(--bg-main)] px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--accent-red)]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t-2 border-[var(--border-color)] px-6 py-4">
          <button type="button" onClick={onReset} disabled={saving} className="btn-swiss">
            恢复当前值
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="btn-swiss">
              取消
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="btn-swiss">
              {saving ? '保存中' : '保存归并'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionDetailModal({
  copy,
  detailState,
  selectedSessionSummary,
  selectedSessionDetail,
  selectedSessionStatus,
  modalProjectName,
  onClose,
  onRefresh,
  onRetry,
  renderRoleLabel,
}: {
  copy: SessionManagementCopy;
  detailState: SessionDetailState;
  selectedSessionSummary: SessionSummary | null;
  selectedSessionDetail: SessionDetail | null;
  selectedSessionStatus: SessionFilter | null;
  modalProjectName: string;
  onClose: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  renderRoleLabel: (role: MessageRole) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)] select-text"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-management-dialog-title"
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="text-[0.625rem] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
              {copy.modalTitle}
            </div>
            <h3 id="session-management-dialog-title" className="mt-2 text-2xl font-black italic uppercase tracking-tight">
              {getFileName(selectedSessionDetail?.fileLabel ?? selectedSessionSummary?.fileLabel, copy.unavailable)}
            </h3>
            <div className="mt-3 space-y-2 text-[0.75rem] leading-6 text-[var(--text-muted)]">
              <div className="text-[0.625rem] font-bold uppercase tracking-[0.18em]">
                项目：{modalProjectName}
              </div>
              <div>
                Provider：
                {getProviderDisplayLabel(
                  selectedSessionSummary?.provider ?? selectedSessionDetail?.provider,
                  copy.unknownProvider,
                )}
                {' / '}
                状态：{selectedSessionStatus === null ? copy.unavailable : selectedSessionStatus === 'archived' ? copy.filterArchived : copy.filterActive}
                {' / '}
                消息：{(selectedSessionDetail?.messageCount ?? selectedSessionSummary?.messageCount) ?? 0}
                {' / '}
                当前：{selectedSessionDetail?.currentMessageLabel ?? copy.unavailable}
              </div>
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
              onClick={onRefresh}
              aria-label={copy.refresh}
              title={copy.refresh}
              className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]"
            >
              <RefreshCw className={`h-4 w-4 ${detailState.refreshing ? 'animate-spin' : ''}`} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              title={copy.close}
              className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
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
                  className="border-b border-[var(--border-color)] py-4"
                >
                  <div className="flex items-center gap-4">
                    <LoadingBar className="h-3 w-10" />
                    <LoadingBar className="h-3 w-12" />
                    <LoadingBar className="h-3 w-14" />
                  </div>
                  <LoadingBar className="mt-3 h-4 w-full" />
                  <LoadingBar className="mt-2 h-4 w-4/5" />
                </div>
              ))}
            </div>
          ) : selectedSessionDetail?.messages.length ? (
            selectedSessionDetail.messages.map((message, index) => (
              <div
                key={message.id}
                className="border-b border-[var(--border-color)] px-6 py-4"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.625rem] font-black uppercase tracking-[0.18em]">
                  <span className="text-[var(--text-muted)]">#{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-[var(--text-muted)]">{message.timeLabel}</span>
                  <span className={roleTone(message.role)}>{renderRoleLabel(message.role)}</span>
                </div>
                <div
                  className="mt-3 overflow-hidden text-[0.75rem] leading-6 text-[var(--text-primary)]"
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                >
                  {message.summary}
                </div>
              </div>
            ))
          ) : detailState.error ? (
            <StatePanel title={copy.loadFailed} description={detailState.error} actionLabel={copy.retry} onAction={onRetry} />
          ) : (
            <StatePanel title={copy.noMessages} description={selectedSessionSummary?.title ?? copy.unavailable} />
          )}
        </div>
      </div>
    </div>
  );
}
