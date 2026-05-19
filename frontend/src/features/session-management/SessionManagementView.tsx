import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, MoreVertical, Pencil, RefreshCw, Search, X } from 'lucide-react';
import { Combobox } from '../../components/ui/Combobox.tsx';
import type {
  MessageRole,
  ProjectSummary,
  SessionDetail,
  SessionFilter,
  SessionManagementSnapshot,
  SessionSummary,
} from './model.ts';
import {
  formatSessionMetadataDate,
  shouldUseCompactSessionMetadata,
  shouldUseSessionsPanelActionMenu,
} from './sessionManagementUtils.ts';

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
  searchPlaceholder: string;
  searchNoResults: string;
  sessionActions: string;
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
    <div className="flex min-h-[10rem] flex-col items-start justify-center gap-2.5 px-6 py-8 text-left">
      <div className="text-[length:var(--font-size-ui-lg-compact)] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">{title}</div>
      {description ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">{description}</div>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn-swiss mt-1">
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
    <div className="mt-6 grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)] border-4 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
      <section className="flex min-h-0 flex-col border-r-4 border-[var(--border-color)]">
        <div className="flex h-14 items-center border-b-4 border-[var(--border-color)] px-5">
          <h2 className="text-[length:var(--font-size-ui-md)] font-black uppercase tracking-[0.25em]">{copy.projectListTitle}</h2>
        </div>
        <div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`project-loading-${index}`} className="border-b border-[var(--border-color)] px-5 py-4">
              <LoadingBar className="h-4 w-36" />
              <div className="mt-2.5 flex items-center gap-1.5">
                <LoadingBar className="h-3.5 w-10" />
                <LoadingBar className="h-3.5 w-8" />
                <LoadingBar className="h-3.5 w-8" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-14 items-center border-b-4 border-[var(--border-color)] px-5">
          <h2 className="text-[length:var(--font-size-ui-md)] font-black uppercase tracking-[0.25em]">{copy.projectSessionsTitle}</h2>
        </div>
        <div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`session-loading-${index}`} className="border-b border-[var(--border-color)] px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <LoadingBar className="h-4 w-48" />
                <LoadingBar className="h-4 w-12" />
              </div>
              <LoadingBar className="mt-2 h-3 w-64 max-w-full" />
              <LoadingBar className="mt-1.5 h-2.5 w-40" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SessionManagementSearchBar({
  copy,
  searchQuery,
  onSearchChange,
}: {
  copy: SessionManagementCopy;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b-4 border-[var(--border-color)] px-4">
      <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" strokeWidth={2.5} />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={copy.searchPlaceholder}
        className="min-w-0 flex-1 bg-transparent text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.16em] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
      />
      {searchQuery ? (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          className="flex h-7 w-7 shrink-0 items-center justify-center border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border-color)] hover:text-[var(--text-primary)] active:scale-90"
          aria-label={copy.close}
          title={copy.close}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ) : null}
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
  searchActive,
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
  searchActive: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  onSelectProject: (projectID: string, openCompact: boolean) => void;
  onOpenProviderEditor: (projectID: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] px-5">
        <h2 className="text-[length:var(--font-size-ui-md)] font-black uppercase tracking-[0.25em]">{copy.projectListTitle}</h2>
        {snapshotRefreshing ? (
          <span className="animate-pulse text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {copy.refreshing}
          </span>
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
              <div
                key={project.id}
                className={`group flex w-full items-stretch border-b border-[var(--border-color)] transition-colors ${
                  isActive ? 'bg-[var(--border-color)]' : 'hover:bg-[var(--bg-surface)]'
                }`}
              >
                {/* Left accent line */}
                <div className={`w-0.5 shrink-0 self-stretch transition-colors ${
                  isActive ? 'bg-[var(--bg-main)]' : 'bg-transparent group-hover:bg-[var(--text-muted)]/40'
                }`} />

                <button
                  type="button"
                  onClick={() => onSelectProject(project.id, compactLayout)}
                  className="flex min-w-0 flex-1 flex-col gap-2.5 py-4 pl-4 pr-3 text-left active:opacity-70"
                >
                  <div className={`truncate text-[length:var(--font-size-ui-lg)] font-black uppercase tracking-tight leading-none ${
                    isActive ? 'text-[var(--bg-main)]' : 'text-[var(--text-primary)]'
                  }`}>
                    {project.name}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {[
                      copy.projectSessionTag(project),
                      copy.projectActiveTag(project),
                      copy.projectArchivedTag(project),
                    ].map((tag) => (
                      <span
                        key={tag}
                        className={`border px-1.5 py-0.5 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] leading-none ${
                          isActive
                            ? 'border-[var(--bg-main)]/60 text-[var(--bg-main)]'
                            : 'border-[var(--border-color)]/60 text-[var(--text-muted)]'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                    <span className={`truncate text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] leading-none ${
                      isActive ? 'text-[var(--bg-main)]/60' : 'text-[var(--text-muted)]/50'
                    }`}>
                      {getProviderDisplayLabel(project.providerSummary, copy.unknownProvider)}
                    </span>
                  </div>
                </button>

                <div className="flex shrink-0 items-center px-3">
                  <button
                    type="button"
                    onClick={() => onOpenProviderEditor(project.id)}
                    aria-label="Edit provider mapping"
                    className={`flex h-7 w-7 items-center justify-center border transition-all active:scale-90 ${
                      isActive
                        ? 'border-[var(--bg-main)]/30 text-[var(--bg-main)] hover:border-[var(--bg-main)]'
                        : 'border-transparent text-[var(--text-muted)]/40 hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <StatePanel
          title={searchActive ? copy.searchNoResults : copy.noProjects}
          description={searchActive ? undefined : copy.scanLine(stats.lastScanAt)}
          actionLabel={searchActive ? undefined : copy.refresh}
          onAction={searchActive ? undefined : onRefresh}
        />
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
  searchActive,
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
  searchActive: boolean;
  visibleSessions: SessionSummary[];
  onRetry: () => void;
  onRefresh: () => void;
  onSelectFilter: (filter: SessionFilter) => void;
  onSelectSession: (sessionID: string) => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const useActionMenu = shouldUseSessionsPanelActionMenu(panelWidth);
  const useCompactSessionMetadata = shouldUseCompactSessionMetadata(panelWidth);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const updateWidth = () => {
      setPanelWidth(panel.getBoundingClientRect().width);
    };
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setPanelWidth(entry.contentRect.width);
    });
    observer.observe(panel);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!useActionMenu) {
      setActionMenuOpen(false);
    }
  }, [useActionMenu]);

  useEffect(() => {
    if (!actionMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActionMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionMenuOpen]);

  return (
    <section ref={panelRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b-4 border-[var(--border-color)] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="shrink-0 text-[length:var(--font-size-ui-md)] font-black uppercase tracking-[0.25em]">{copy.projectSessionsTitle}</h2>
          <span className="truncate text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            / {activeProjectName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {useActionMenu ? (
            <div ref={actionMenuRef} className="relative">
              <button
                type="button"
                aria-label={copy.sessionActions}
                aria-haspopup="menu"
                aria-expanded={actionMenuOpen}
                title={copy.sessionActions}
                onClick={() => setActionMenuOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center border border-[var(--border-color)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-90"
              >
                <MoreVertical className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              {actionMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-[6px_6px_0_var(--shadow-color)]"
                >
                  {filters.map((filter) => {
                    const isActive = activeFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => {
                          onSelectFilter(filter.id);
                          setActionMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] transition-colors active:scale-95 ${
                          isActive
                            ? 'bg-[var(--border-color)] text-[var(--bg-main)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        <Check className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                        <span>{filter.label}</span>
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-dashed border-[var(--border-color)]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionMenuOpen(false);
                      onRefresh();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)] active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                    <span>{copy.refresh}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {filters.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => onSelectFilter(filter.id)}
                    className={`border px-3 py-1.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] transition-colors active:scale-95 ${
                      isActive
                        ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                        : 'border-[var(--border-color)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onRefresh}
                aria-label={copy.refresh}
                title={copy.refresh}
                className="flex h-8 w-8 items-center justify-center border border-[var(--border-color)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-90"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </div>
      {snapshotLoading && !visibleSessions.length && !snapshotError ? (
        <StatePanel title={copy.loading} description={copy.scanLine(copy.unavailable)} />
      ) : (
        <>
          {snapshotError ? (
            <div className="border-b border-[var(--border-color)] px-5 py-2.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--accent-red)]">
              {copy.loadFailed} / {snapshotError}
            </div>
          ) : null}
          <div className="min-h-0 overflow-y-auto overflow-x-hidden">
            {visibleSessions.length ? (
              visibleSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className="group block w-full border-b border-[var(--border-color)] px-6 py-4 text-left transition-colors hover:bg-[var(--bg-surface)] active:bg-[var(--bg-muted)]"
                >
                  {/* Line 1: title + status badge */}
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0 flex-1 truncate text-[length:var(--font-size-ui-lg)] font-black uppercase tracking-tight leading-none text-[var(--text-primary)]">
                      {session.title || 'UNTITLED SESSION'}
                    </div>
                    <span className={`shrink-0 border px-2 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.22em] leading-none ${
                      session.status === 'active'
                        ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
                        : 'border-[var(--border-color)]/50 text-[var(--text-muted)]'
                    }`}>
                      {session.status}
                    </span>
                  </div>

                  {/* Line 2: summary */}
                  {session.summary ? (
                    <div className="mt-1.5 truncate text-[length:var(--font-size-ui-md-compact)] leading-snug text-[var(--text-muted)]">
                      {session.summary}
                    </div>
                  ) : null}

                  {/* Line 3: metadata */}
                  <div
                    className={`mt-2 flex items-center text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]/60 ${
                      useCompactSessionMetadata ? 'justify-between gap-x-6' : 'gap-x-2'
                    }`}
                  >
                    {useCompactSessionMetadata ? (
                      <>
                        <span>{session.messageCount}</span>
                        <span className="ml-auto shrink-0">{formatSessionMetadataDate(session.updatedAt)}</span>
                      </>
                    ) : (
                      <>
                        <span>{getProviderDisplayLabel(session.provider, copy.unknownProvider)}</span>
                        <span>·</span>
                        <span>{session.messageCount} msgs</span>
                        <span>·</span>
                        <span className="max-w-[8rem] truncate">{getFileName(session.fileLabel, session.id)}</span>
                        <span className="ml-auto shrink-0">{session.updatedAt}</span>
                      </>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <StatePanel
                title={searchActive ? copy.searchNoResults : copy.noSessions}
                description={activeProjectName}
                actionLabel={snapshotError ? copy.retry : undefined}
                onAction={snapshotError ? onRetry : undefined}
              />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-70)] p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col border-4 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-management-provider-merge-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-[var(--border-color)] px-5 py-4">
          <div>
            <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Provider 归并
            </div>
            <h3
              id="session-management-provider-merge-title"
              className="mt-1 text-[length:var(--font-size-ui-3xl)] font-black uppercase tracking-tight leading-none"
            >
              {projectName}
            </h3>
            <p className="mt-2 text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              将来源 Provider 统一映射到目标标签，不同来源可归并到同一个目标
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            title={copy.close}
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] active:scale-90"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Mapping rows */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border-color)]">
          {rows.map((row) => {
            const sourceLabel = getProviderDisplayLabel(row.sourceProvider, copy.unknownProvider);
            return (
              <div key={row.sourceKey} className="flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--font-size-ui-lg-compact)] font-black normal-case tracking-tight">
                    {sourceLabel}
                  </div>
                  <div className="mt-0.5 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {row.count} 条会话
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <Combobox
                    value={row.targetProvider}
                    options={candidates}
                    placeholder={copy.unknownProvider}
                    disabled={saving}
                    onChange={(value) => onChangeValue(row.sourceKey, value)}
                  />
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              暂无可归并的 Provider
            </div>
          ) : null}
        </div>

        {/* Error */}
        {error ? (
          <div className="border-t border-[var(--border-color)] px-5 py-3 text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-[0.14em] text-[var(--accent-red)]">
            {error}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t-4 border-[var(--border-color)] px-5 py-3">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="btn-swiss text-[length:var(--font-size-ui-xs)] disabled:opacity-50"
          >
            重置
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-swiss text-[length:var(--font-size-ui-xs)] disabled:opacity-50"
            >
              {copy.close}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              aria-busy={saving}
              className="btn-swiss inline-flex items-center gap-1.5 text-[length:var(--font-size-ui-xs)] disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-3 w-3 animate-spin" strokeWidth={2.5} aria-hidden="true" /> : null}
              <span>{saving ? '保存中…' : '保存'}</span>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col border-4 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)] select-text"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-management-dialog-title"
      >
        <div className="flex items-start justify-between gap-4 border-b-4 border-[var(--border-color)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
              {copy.modalTitle}
            </div>
            <h3 id="session-management-dialog-title" className="mt-1 truncate text-xl font-black uppercase tracking-tight">
              {getFileName(selectedSessionDetail?.fileLabel ?? selectedSessionSummary?.fileLabel, copy.unavailable)}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <span>{modalProjectName}</span>
              <span className="opacity-40">·</span>
              <span>
                {copy.metaProvider}:{' '}
                {getProviderDisplayLabel(
                  selectedSessionSummary?.provider ?? selectedSessionDetail?.provider,
                  copy.unknownProvider,
                )}
              </span>
              <span className="opacity-40">·</span>
              <span>
                {copy.modalMetaStatus}:{' '}
                {selectedSessionStatus === null
                  ? copy.unavailable
                  : selectedSessionStatus === 'archived'
                  ? copy.filterArchived
                  : copy.filterActive}
              </span>
              <span className="opacity-40">·</span>
              <span>
                {copy.metaMessages}: {(selectedSessionDetail?.messageCount ?? selectedSessionSummary?.messageCount) ?? 0}
              </span>
              {selectedSessionDetail?.currentMessageLabel ? (
                <>
                  <span className="opacity-40">·</span>
                  <span>{copy.modalMetaCurrent}: {selectedSessionDetail.currentMessageLabel}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {detailState.refreshing ? (
              <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {copy.refreshing}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              aria-label={copy.refresh}
              title={copy.refresh}
              className="flex h-7 w-7 items-center justify-center border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-90"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${detailState.refreshing ? 'animate-spin' : ''}`} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              title={copy.close}
              className="flex h-7 w-7 items-center justify-center border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-90"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        {detailState.error ? (
          <div className="border-b border-[var(--border-color)] px-5 py-2.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--accent-red)]">
            {copy.loadFailed} / {detailState.error}
          </div>
        ) : null}
        <div className="min-h-0 overflow-y-auto">
          {detailState.loading && !selectedSessionDetail ? (
            <div className="px-5 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="border-b border-[var(--border-color)] py-3"
                >
                  <div className="flex items-center gap-3">
                    <LoadingBar className="h-2.5 w-8" />
                    <LoadingBar className="h-2.5 w-10" />
                    <LoadingBar className="h-2.5 w-12" />
                  </div>
                  <LoadingBar className="mt-2.5 h-3 w-full" />
                  <LoadingBar className="mt-1.5 h-3 w-4/5" />
                </div>
              ))}
            </div>
          ) : selectedSessionDetail?.messages.length ? (
            selectedSessionDetail.messages.map((message, index) => (
              <div
                key={message.id}
                className="border-b border-[var(--border-color)] px-5 py-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em]">
                  <span className="text-[var(--text-muted)]/50">#{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-[var(--text-muted)]">{message.timeLabel}</span>
                  <span className={roleTone(message.role)}>{renderRoleLabel(message.role)}</span>
                </div>
                <div
                  className="mt-2 overflow-hidden text-[length:var(--font-size-ui-md-compact)] leading-5 text-[var(--text-primary)]"
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
