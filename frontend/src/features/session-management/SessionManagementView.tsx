import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3, Check, MoreVertical, Pencil, RefreshCw, X } from 'lucide-react';
import { Alert, Button, Tag, Tooltip } from 'antd';
import { Combobox } from '../../components/ui/Combobox.tsx';
import SearchInput from '../../components/ui/SearchInput';
import type {
  MessageRole,
  ProjectSummary,
  SessionDetail,
  SessionFilter,
  SessionAnalysisResult,
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
  pluginHostTitle: string;
  analysisPluginName: string;
  analysisPluginHint: string;
  analysisOpen: string;
  analysisSelectorTitle: string;
  analysisSelectorHint: string;
  analysisDetailTitle: string;
  analysisSelectProject: string;
  analysisSelectSession: string;
  analysisBackToSelection: string;
  analysisTitle: string;
  analysisAll: string;
  analysisProject: string;
  analysisRecent: (limit: number) => string;
  analysisRunning: string;
  analysisEmpty: string;
  analysisKeywords: string;
  analysisWordCloud: string;
  analysisCommonPhrases: string;
  analysisProjects: string;
  analysisRoles: string;
  analysisTopics: string;
  loadMoreMessages: string;
  messagePageLoading: string;
  messageLoadedLine: (loaded: number, total: number) => string;
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
  messagePageLoading: boolean;
  messagePageError: string | null;
  hasMoreMessages: boolean;
  nextMessageOffset: number;
  rawJSONByMessageID: Record<string, string>;
  rawJSONLoadingMessageID: string | null;
  rawJSONError: string | null;
  error: string | null;
}

export function roleTone(role: MessageRole) {
  if (role === 'system') {
    return 'text-[var(--gt-status-danger)]';
  }
  if (role === 'tool_call') {
    return 'text-[var(--gt-status-danger)]';
  }
  if (role === 'tool_result') {
    return 'text-[var(--gt-ink-primary)]';
  }
  if (role === 'reasoning') {
    return 'text-[var(--gt-ink-primary)]';
  }
  if (role === 'event') {
    return 'text-[var(--gt-ink-muted)]';
  }
  if (role === 'assistant') {
    return 'text-[var(--gt-ink-primary)]';
  }
  return 'text-[var(--gt-ink-muted)]';
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

function useModalInitialFocus(onClose: () => void) {
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, []);

  return focusRef;
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
      <div className="text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">{title}</div>
      {description ? (
        <div className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">{description}</div>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          size="small"
          onClick={onAction}
          className="mt-1"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingBar({ className = '' }: { className?: string }) {
  return <div className={`rounded-sm bg-[var(--gt-surface-muted)] ${className}`.trim()} />;
}

const sessionManagementModalBackdropClass = 'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-4 sm:p-6';
const sessionManagementModalPanelClass = 'flex w-full flex-col overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const sessionManagementModalHeaderClass = 'flex items-start justify-between gap-4 border-b border-[var(--gt-border-subtle)] px-5 py-4';
const sessionManagementModalFooterClass = 'flex items-center justify-between gap-3 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5 py-3';
const sessionManagementModalLabelClass = 'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const sessionManagementAnalysisSectionClass = 'border-b border-[var(--gt-border-subtle)] px-4 py-3';
const sessionManagementAnalysisColumnClass = 'border-b border-[var(--gt-border-subtle)] px-4 py-3 lg:border-b-0 lg:border-r lg:border-[var(--gt-border-subtle)]';
const sessionManagementAnalysisTitleClass = 'mb-2 text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const sessionManagementAnalysisCloudItemClass = 'max-w-full truncate font-semibold leading-none tracking-normal text-[var(--gt-ink-primary)]';
const sessionManagementAnalysisCardClass = 'min-w-0 rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2';
const sessionManagementAnalysisCardTitleClass = 'line-clamp-2 break-words text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const sessionManagementAnalysisCardMetaClass = 'mt-1 text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const sessionManagementAnalysisMetricRowClass = 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[length:var(--gt-font-size-xs)]';
const sessionManagementAnalysisMetricLabelClass = 'truncate font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const sessionManagementAnalysisMetricValueClass = 'font-semibold tabular-nums text-[var(--gt-ink-primary)]';
const sessionManagementAnalysisMetricMetaClass = 'text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const sessionManagementMessageMetaClass = 'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal';
const sessionManagementRawJsonPanelClass = 'mt-3 overflow-hidden rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const sessionManagementRawJsonHeaderClass = 'border-b border-[var(--gt-border-subtle)] px-3 py-1.5 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';

export function InitialLoadingShell({ copy }: { copy: SessionManagementCopy }) {
  return (
    <div className="mx-auto grid min-h-0 w-full max-w-[1480px] flex-1 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm">
      <section className="flex min-h-0 flex-col border-r border-[var(--gt-border-subtle)]">
        <div className="flex h-12 items-center border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5">
          <h2 className="text-[length:var(--gt-font-size-md)] font-semibold">{copy.projectListTitle}</h2>
        </div>
        <div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`project-loading-${index}`} className="border-b border-[var(--gt-border-subtle)] px-5 py-4">
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
        <div className="flex h-12 items-center border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5">
          <h2 className="text-[length:var(--gt-font-size-md)] font-semibold">{copy.projectSessionsTitle}</h2>
        </div>
        <div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`session-loading-${index}`} className="border-b border-[var(--gt-border-subtle)] px-6 py-4">
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
    <div data-session-management-search-frame="true" className="shrink-0 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3">
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={copy.searchPlaceholder}
        clearLabel={copy.close}
      />
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
  onOpenProviderEditor?: (projectID: string) => void;
}) {
  return (
    <section data-session-management-project-panel="true" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5">
        <h2 className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">{copy.projectListTitle}</h2>
        {snapshotRefreshing ? (
          <span className="text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
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
                className={`group flex w-full items-stretch border-b border-[var(--gt-border-subtle)] transition-colors ${
                  isActive ? 'bg-[var(--gt-surface-muted)]' : 'hover:bg-[var(--gt-surface-muted)]'
                }`}
              >
                <div className={`w-0.5 shrink-0 self-stretch transition-colors ${
                  isActive ? 'bg-[var(--gt-ink-primary)]' : 'bg-transparent group-hover:bg-[var(--gt-ink-muted)]/35'
                }`} />

                <Button
                  size="small"
                  onClick={() => onSelectProject(project.id, compactLayout)}
                  className="flex min-w-0 flex-1 flex-col gap-2.5 py-4 pl-4 pr-3 text-left"
                >
                  <div className={`truncate text-[length:var(--gt-font-size-lg)] font-semibold leading-none ${
                    isActive ? 'text-[var(--gt-ink-primary)]' : 'text-[var(--gt-ink-primary)]'
                  }`}>
                    {project.name}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {[
                      copy.projectSessionTag(project),
                      copy.projectActiveTag(project),
                      copy.projectArchivedTag(project),
                    ].map((tag) => (
                      <Tag
                        key={tag}
                        color={isActive ? undefined : 'default'}
                        className="text-[length:var(--gt-font-size-2xs)] font-normal leading-none"
                      >
                        {tag}
                      </Tag>
                    ))}
                    <span className={`truncate text-[length:var(--gt-font-size-2xs)] font-normal leading-none ${
                      isActive ? 'text-[var(--gt-ink-muted)]' : 'text-[var(--gt-ink-muted)]/70'
                    }`}>
                      {getProviderDisplayLabel(project.providerSummary, copy.unknownProvider)}
                    </span>
                  </div>
                </Button>

                {onOpenProviderEditor ? (
                  <div className="flex shrink-0 items-center px-3">
                  <Button
                    size="small"
                    type="text"
                    onClick={() => onOpenProviderEditor(project.id)}
                    aria-label="Edit provider mapping"
                    icon={<Pencil className="h-3 w-3" strokeWidth={2.5} />}
                    className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                      isActive
                        ? 'border-[var(--gt-border-subtle)] text-[var(--gt-ink-primary)] hover:border-[var(--gt-border-strong)]'
                        : 'border-transparent text-[var(--gt-ink-muted)]/45 hover:border-[var(--gt-border-subtle)] hover:text-[var(--gt-ink-primary)]'
                    }`}
                  />
                  </div>
                ) : null}
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

export function SessionAnalysisScopeModal({
  copy,
  projects,
  activeProjectId,
  activeProjectName,
  visibleSessions,
  recentLimit,
  onClose,
  onAnalyzeAll,
  onAnalyzeRecent,
  onAnalyzeProject,
  onAnalyzeSession,
}: {
  copy: SessionManagementCopy;
  projects: ProjectSummary[];
  activeProjectId: string;
  activeProjectName: string;
  visibleSessions: SessionSummary[];
  recentLimit: number;
  onClose: () => void;
  onAnalyzeAll: () => void;
  onAnalyzeRecent: () => void;
  onAnalyzeProject: (project: ProjectSummary) => void;
  onAnalyzeSession: (session: SessionSummary) => void;
}) {
  const recentSessions = visibleSessions.slice(0, recentLimit);
  const initialFocusRef = useModalInitialFocus(onClose);

  return (
    <div
      className={sessionManagementModalBackdropClass}
      onClick={onClose}
    >
      <div
        data-session-management-modal="analysis-scope"
        className={`${sessionManagementModalPanelClass} max-h-[90vh] max-w-5xl`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-analysis-scope-title"
      >
        <div className={sessionManagementModalHeaderClass}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
              <BarChart3 className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span>{copy.analysisTitle}</span>
            </div>
            <h3
              id="session-analysis-scope-title"
              className="mt-1 text-[length:var(--gt-font-size-xl)] font-semibold leading-tight text-[var(--gt-ink-primary)]"
            >
              {copy.analysisSelectorTitle}
            </h3>
            <p className="mt-2 max-w-3xl text-[length:var(--gt-font-size-sm)] font-normal leading-5 text-[var(--gt-ink-muted)]">
              {copy.analysisSelectorHint}
            </p>
          </div>
          <Tooltip title={copy.close}>
            <Button
              size="small"
              type="text"
              onClick={onClose}
              aria-label={copy.close}
              icon={<X className="h-3.5 w-3.5" strokeWidth={2.5} />}
            />
          </Tooltip>
        </div>

        <div className="grid min-h-0 gap-0 overflow-y-auto lg:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4 lg:border-b-0 lg:border-r">
            <div className={sessionManagementModalLabelClass}>
              {copy.pluginHostTitle}
            </div>
            <div className="mt-3 grid gap-2">
              <Button
                size="small"
                ref={initialFocusRef}
                onClick={onAnalyzeAll}
                disabled={!projects.length}
                block
                className="justify-center"
              >
                {copy.analysisAll}
              </Button>
              <Button
                size="small"
                onClick={onAnalyzeRecent}
                disabled={!recentSessions.length}
                block
                className="justify-center"
              >
                {copy.analysisRecent(recentLimit)}
              </Button>
            </div>
            <div className="mt-4 border-t border-[var(--gt-border-subtle)] pt-4 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
              {copy.analysisPluginName} / {activeProjectName}
            </div>
          </div>

          <div className="min-h-0 border-b border-[var(--gt-border-subtle)] lg:border-b-0 lg:border-r">
            <div className="sticky top-0 z-10 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-4 py-3">
              <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                {copy.analysisSelectProject}
              </div>
            </div>
            <div className="max-h-[56vh] overflow-y-auto">
              {projects.map((project) => {
                const active = project.id === activeProjectId;
                return (
                  <Button
                    key={project.id}
                    size="small"
                    type="text"
                    onClick={() => onAnalyzeProject(project)}
                    block
                    className={`block w-full border-b border-[var(--gt-border-subtle)] px-4 py-3 text-left transition-colors ${
                      active ? 'bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]' : 'hover:bg-[var(--gt-surface-muted)]'
                    }`}
                  >
                    <div className="truncate text-[length:var(--gt-font-size-md)] font-semibold">
                      {project.name}
                    </div>
                    <div className={`mt-1 text-[length:var(--gt-font-size-xs)] font-normal ${
                      active ? 'text-[var(--gt-ink-muted)]' : 'text-[var(--gt-ink-muted)]'
                    }`}>
                      {copy.projectStatusLine(project)}
                    </div>
                  </Button>
                );
              })}
              {!projects.length ? (
                <StatePanel title={copy.noProjects} description={copy.analysisSelectorHint} />
              ) : null}
            </div>
          </div>

          <div className="min-h-0">
            <div className="sticky top-0 z-10 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-4 py-3">
              <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                {copy.analysisSelectSession}
              </div>
            </div>
            <div className="max-h-[56vh] overflow-y-auto">
              {visibleSessions.map((session) => (
                <Button
                  key={session.id}
                  size="small"
                  type="text"
                  onClick={() => onAnalyzeSession(session)}
                  block
                  className="block w-full border-b border-[var(--gt-border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--gt-surface-muted)]"
                >
                  <div className="truncate text-[length:var(--gt-font-size-md)] font-semibold">
                    {session.displayTitle || session.title || getFileName(session.fileLabel, session.id)}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                    <span>{session.messageCount} {copy.metaMessages}</span>
                    <span>·</span>
                    <span className="truncate">{formatSessionMetadataDate(session.updatedAt)}</span>
                  </div>
                </Button>
              ))}
              {!visibleSessions.length ? (
                <StatePanel title={copy.noSessions} description={activeProjectName} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionAnalysisDetailModal({
  copy,
  scopeLabel,
  result,
  loading,
  error,
  onClose,
  onBackToSelection,
}: {
  copy: SessionManagementCopy;
  scopeLabel: string;
  result: SessionAnalysisResult | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onBackToSelection: () => void;
}) {
  const initialFocusRef = useModalInitialFocus(onClose);

  return (
    <div
      className={sessionManagementModalBackdropClass}
      onClick={onClose}
    >
      <div
        data-session-management-modal="analysis-detail"
        className={`${sessionManagementModalPanelClass} max-h-[90vh] max-w-6xl`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-analysis-detail-title"
      >
        <div className={sessionManagementModalHeaderClass}>
          <div className="min-w-0 flex-1">
            <div className={sessionManagementModalLabelClass}>
              {copy.analysisTitle}
            </div>
            <h3
              id="session-analysis-detail-title"
              className="mt-1 truncate text-[length:var(--gt-font-size-xl)] font-semibold leading-tight text-[var(--gt-ink-primary)]"
            >
              {copy.analysisDetailTitle}
            </h3>
            <div className="mt-2 truncate text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
              {result
                ? `${scopeLabel} / ${result.analyzedSessionCount} ${copy.sessionsUnit} / ${result.totalMessages} ${copy.metaMessages} / ${result.generatedAt}`
                : scopeLabel}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {loading ? (
              <span className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
                {copy.analysisRunning}
              </span>
            ) : null}
            <Button
              size="small"
              ref={initialFocusRef}
              onClick={loading ? undefined : onBackToSelection}
              aria-disabled={loading ? 'true' : undefined}
            >
              {copy.analysisBackToSelection}
            </Button>
            <Tooltip title={copy.close}>
              <Button
                size="small"
                type="text"
                onClick={onClose}
                aria-label={copy.close}
                icon={<X className="h-3.5 w-3.5" strokeWidth={2.5} />}
              />
            </Tooltip>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {error ? (
            <Alert type="error" message={`${copy.loadFailed} / ${error}`} />
          ) : null}
          {loading && !result ? (
            <StatePanel title={copy.analysisRunning} description={scopeLabel} />
          ) : result ? (
            <SessionAnalysisResultGrid copy={copy} result={result} />
          ) : !error ? (
            <StatePanel title={copy.analysisEmpty} description={scopeLabel} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SessionAnalysisResultGrid({ copy, result }: { copy: SessionManagementCopy; result: SessionAnalysisResult }) {
  const wordCloud = getAnalysisWordCloud(result);
  return (
    <div className="grid gap-0" data-session-management-analysis-results="quiet">
      <div className={sessionManagementAnalysisSectionClass}>
        <AnalysisSectionTitle>{copy.analysisWordCloud}</AnalysisSectionTitle>
        <div className="flex min-h-24 flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden">
          {wordCloud.slice(0, 28).map((item) => (
            <Tooltip key={item.term} title={`${item.term} / ${item.count}`}>
              <span
                className={sessionManagementAnalysisCloudItemClass}
                style={{
                  fontSize: `${12 + Math.max(0.2, Math.min(item.weight, 1)) * 18}px`,
                  opacity: 0.68 + Math.max(0.2, Math.min(item.weight, 1)) * 0.32,
                }}
              >
                {item.term}
              </span>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr_1fr]">
        <AnalysisColumn title={copy.analysisKeywords}>
          {result.keywords.slice(0, 10).map((keyword) => (
            <AnalysisMetricRow
              key={keyword.term}
              label={keyword.term}
              value={`${keyword.count}`}
              meta={`${keyword.sessionCount} ${copy.sessionsUnit}`}
            />
          ))}
        </AnalysisColumn>
        <AnalysisColumn title={copy.analysisProjects}>
          {result.projects.slice(0, 6).map((project) => (
            <AnalysisMetricRow
              key={project.projectID}
              label={project.projectName}
              value={`${project.sessionCount}`}
              meta={`${project.termCount} terms`}
            />
          ))}
        </AnalysisColumn>
        <AnalysisColumn title={copy.analysisRoles}>
          {result.roleContributions.slice(0, 6).map((role) => (
            <AnalysisMetricRow
              key={role.role}
              label={role.role}
              value={`${Math.round(role.share * 100)}%`}
              meta={`${role.messageCount} ${copy.metaMessages}`}
            />
          ))}
        </AnalysisColumn>
      </div>
      <div className={sessionManagementAnalysisSectionClass}>
        <AnalysisSectionTitle>{copy.analysisCommonPhrases}</AnalysisSectionTitle>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {result.commonPhrases.slice(0, 9).map((phrase) => (
            <div key={phrase.text} className={sessionManagementAnalysisCardClass}>
              <div className={sessionManagementAnalysisCardTitleClass}>
                {phrase.text}
              </div>
              <div className={sessionManagementAnalysisCardMetaClass}>
                {phrase.count} / {phrase.sessionCount} {copy.sessionsUnit}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--gt-border-subtle)] px-4 py-3 lg:col-span-3">
        <AnalysisSectionTitle>{copy.analysisTopics}</AnalysisSectionTitle>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {result.sessions.slice(0, 6).map((session) => (
            <div key={session.sessionID} className={sessionManagementAnalysisCardClass}>
              <div className={sessionManagementAnalysisCardTitleClass}>
                {session.title || getFileName(session.sessionID, copy.unavailable)}
              </div>
              <div className={sessionManagementAnalysisCardMetaClass}>
                {session.topicLine}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getAnalysisWordCloud(result: SessionAnalysisResult) {
  if (result.wordCloud.length > 0) {
    return result.wordCloud;
  }
  const maxCount = Math.max(...result.keywords.map((keyword) => keyword.count), 1);
  return result.keywords.map((keyword) => ({
    term: keyword.term,
    count: keyword.count,
    sessionCount: keyword.sessionCount,
    weight: 0.4 + 0.6 * (keyword.count / maxCount),
  }));
}

function AnalysisSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className={sessionManagementAnalysisTitleClass}>
      {children}
    </div>
  );
}

function AnalysisColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={sessionManagementAnalysisColumnClass}>
      <AnalysisSectionTitle>{title}</AnalysisSectionTitle>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function AnalysisMetricRow({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className={sessionManagementAnalysisMetricRowClass}>
      <span className={sessionManagementAnalysisMetricLabelClass}>{label}</span>
      <span className={sessionManagementAnalysisMetricValueClass}>{value}</span>
      <span className={sessionManagementAnalysisMetricMetaClass}>{meta}</span>
    </div>
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
    <section ref={panelRef} data-session-management-session-panel="true" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="shrink-0 text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">{copy.projectSessionsTitle}</h2>
          <span className="truncate text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
            {activeProjectName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded bg-[var(--gt-surface-canvas)] p-1">
          {useActionMenu ? (
            <div ref={actionMenuRef} className="relative">
              <Tooltip title={copy.sessionActions}>
                <Button
                  size="small"
                  type="text"
                  aria-label={copy.sessionActions}
                  aria-haspopup="menu"
                  aria-expanded={actionMenuOpen}
                  onClick={() => setActionMenuOpen((prev) => !prev)}
                  icon={<MoreVertical className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  className="flex h-8 w-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] text-[var(--gt-ink-muted)] transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]"
                />
              </Tooltip>
              {actionMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-52 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-1.5 shadow-sm"
                >
                  {filters.map((filter) => {
                    const isActive = activeFilter === filter.id;
                    return (
                      <Button
                        key={filter.id}
                        size="small"
                        type="text"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => {
                          onSelectFilter(filter.id);
                          setActionMenuOpen(false);
                        }}
                        icon={<Check className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />}
                        block
                        className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[length:var(--gt-font-size-sm)] font-normal transition-colors ${
                          isActive
                            ? 'bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]'
                            : 'text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)]'
                        }`}
                      >
                        <span>{filter.label}</span>
                      </Button>
                    );
                  })}
                  <div className="my-1 border-t border-[var(--gt-border-subtle)]" />
                  <Button
                    size="small"
                    type="text"
                    role="menuitem"
                    onClick={() => {
                      setActionMenuOpen(false);
                      onRefresh();
                    }}
                    icon={<RefreshCw className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />}
                    block
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition-colors hover:bg-[var(--gt-surface-muted)]"
                  >
                    <span>{copy.refresh}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {filters.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <Button
                    key={filter.id}
                    size="small"
                    type={isActive ? 'primary' : 'text'}
                    onClick={() => onSelectFilter(filter.id)}
                    className={`rounded px-3 py-1.5 text-[length:var(--gt-font-size-xs)] font-normal transition-colors ${
                      isActive
                        ? 'bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
                        : 'bg-transparent text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]'
                    }`}
                  >
                    {filter.label}
                  </Button>
                );
              })}
              <Tooltip title={copy.refresh}>
                <Button
                  size="small"
                  type="text"
                  onClick={onRefresh}
                  aria-label={copy.refresh}
                  icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  className="flex h-8 w-8 items-center justify-center rounded border border-transparent text-[var(--gt-ink-muted)] transition-colors hover:border-[var(--gt-border-subtle)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]"
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>
      {snapshotLoading && !visibleSessions.length && !snapshotError ? (
        <StatePanel title={copy.loading} description={copy.scanLine(copy.unavailable)} />
      ) : (
        <>
          {snapshotError ? (
            <div className="border-b border-[var(--gt-border-subtle)] px-5 py-2.5 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-status-danger)]">
              {copy.loadFailed} / {snapshotError}
            </div>
          ) : null}
          <div className="min-h-0 overflow-y-auto overflow-x-hidden">
            {visibleSessions.length ? (
              visibleSessions.map((session) => (
                <Button
                  key={session.id}
                  size="small"
                  type="text"
                  onClick={() => onSelectSession(session.id)}
                  block
                  className="group block w-full rounded-sm border-l-2 border-l-transparent border-b border-b-[var(--gt-border-subtle)] px-6 py-4 text-left transition-colors hover:border-l-[var(--gt-ink-muted)]/45 hover:bg-[var(--gt-surface-muted)] active:bg-[var(--gt-surface-muted)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="line-clamp-2 min-w-0 flex-1 break-words text-[length:var(--gt-font-size-lg)] font-semibold leading-tight text-[var(--gt-ink-primary)]">
                      {session.displayTitle || session.title || 'UNTITLED SESSION'}
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[length:var(--gt-font-size-2xs)] font-normal leading-none ${
                      session.status === 'active'
                        ? 'border-[color-mix(in_srgb,var(--gt-status-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-ink-primary)]'
                        : 'border-[var(--gt-border-subtle)] text-[var(--gt-ink-muted)]'
                    }`}>
                      {session.status}
                    </span>
                  </div>

                  <div
                    className={`mt-3 flex items-center border-t border-[var(--gt-border-subtle)] pt-2 text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)] ${
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
                </Button>
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
      className={sessionManagementModalBackdropClass}
      onClick={onClose}
    >
      <div
        data-session-management-modal="provider-merge"
        className={`${sessionManagementModalPanelClass} max-w-xl`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-management-provider-merge-title"
      >
        <div className={sessionManagementModalHeaderClass}>
          <div>
            <div className={sessionManagementModalLabelClass}>
              Provider 归并
            </div>
            <h3
              id="session-management-provider-merge-title"
              className="mt-1 text-[length:var(--gt-font-size-xl)] font-semibold leading-tight text-[var(--gt-ink-primary)]"
            >
              {projectName}
            </h3>
            <p className="mt-2 text-[length:var(--gt-font-size-sm)] font-normal leading-5 text-[var(--gt-ink-muted)]">
              将来源 Provider 统一映射到目标标签，不同来源可归并到同一个目标
            </p>
          </div>
          <Tooltip title={copy.close}>
            <Button
              size="small"
              type="text"
              onClick={onClose}
              aria-label={copy.close}
              icon={<X className="h-3.5 w-3.5" strokeWidth={2.5} />}
            />
          </Tooltip>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--gt-border-subtle)]">
          {rows.map((row) => {
            const sourceLabel = getProviderDisplayLabel(row.sourceProvider, copy.unknownProvider);
            return (
              <div key={row.sourceKey} className="flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--gt-font-size-lg)] font-semibold">
                    {sourceLabel}
                  </div>
                  <div className="mt-0.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                    {row.count} 条会话
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gt-ink-muted)]" strokeWidth={2} />
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
            <div className="px-5 py-8 text-center text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
              暂无可归并的 Provider
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="border-t border-[var(--gt-border-subtle)] px-5 py-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-status-danger)]">
            {error}
          </div>
        ) : null}

        <div className={sessionManagementModalFooterClass}>
          <Button
            size="small"
            onClick={onReset}
            disabled={saving}
          >
            重置
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              onClick={onClose}
              disabled={saving}
            >
              {copy.close}
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={onSave}
              disabled={saving}
              aria-busy={saving}
              icon={saving ? <RefreshCw className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" /> : undefined}
            >
              <span>{saving ? '保存中…' : '保存'}</span>
            </Button>
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
  onLoadMoreMessages,
  onViewRawJSON,
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
  onLoadMoreMessages: () => void;
  onViewRawJSON: (message: SessionDetail['messages'][number]) => void;
  renderRoleLabel: (role: MessageRole) => string;
}) {
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container || !detailState.hasMoreMessages || detailState.messagePageLoading) {
      return;
    }

    const loadMoreThreshold = 240;
    const handleScroll = () => {
      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceToBottom <= loadMoreThreshold) {
        onLoadMoreMessages();
      }
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [
    detailState.hasMoreMessages,
    detailState.messagePageLoading,
    selectedSessionDetail?.messages.length,
    onLoadMoreMessages,
  ]);

  return (
    <div
      className={sessionManagementModalBackdropClass}
      onClick={onClose}
    >
      <div
        data-session-management-modal="session-detail"
        className={`${sessionManagementModalPanelClass} max-h-[90vh] max-w-5xl select-text`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-management-dialog-title"
      >
        <div className={sessionManagementModalHeaderClass}>
          <div className="min-w-0 flex-1">
            <div className={sessionManagementModalLabelClass}>
              {copy.modalTitle}
            </div>
            <h3 id="session-management-dialog-title" className="mt-1 truncate text-[length:var(--gt-font-size-xl)] font-semibold leading-tight text-[var(--gt-ink-primary)]">
              {selectedSessionDetail?.displayTitle ??
                selectedSessionSummary?.displayTitle ??
                selectedSessionDetail?.title ??
                selectedSessionSummary?.title ??
                getFileName(selectedSessionDetail?.fileLabel ?? selectedSessionSummary?.fileLabel, copy.unavailable)}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
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
              <span className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
                {copy.refreshing}
              </span>
            ) : null}
            <Tooltip title={copy.refresh}>
              <Button
                size="small"
                type="text"
                onClick={onRefresh}
                aria-label={copy.refresh}
                icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />}
              />
            </Tooltip>
            <Tooltip title={copy.close}>
              <Button
                size="small"
                type="text"
                onClick={onClose}
                aria-label={copy.close}
                icon={<X className="h-3.5 w-3.5" strokeWidth={2.5} />}
              />
            </Tooltip>
          </div>
        </div>
        {detailState.error ? (
          <Alert type="error" message={`${copy.loadFailed} / ${detailState.error}`} />
        ) : null}
        <div ref={messagesScrollRef} className="min-h-0 overflow-y-auto">
          {detailState.loading && !selectedSessionDetail ? (
            <div className="px-5 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="border-b border-[var(--gt-border-subtle)] py-3"
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
            <>
              {selectedSessionDetail.messages.map((message, index) => (
                <div
                  key={message.id}
                  onClick={() => onViewRawJSON(message)}
                  className="cursor-pointer border-b border-[var(--gt-border-subtle)] px-5 py-3 transition-colors hover:bg-[var(--gt-surface-muted)]"
                >
                  <div className={sessionManagementMessageMetaClass}>
                    <span className="text-[var(--gt-ink-muted)]/50">#{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-[var(--gt-ink-muted)]">{message.timeLabel}</span>
                    <span className={roleTone(message.role)}>{renderRoleLabel(message.role)}</span>
                    {message.truncated ? (
                      <span className="text-[var(--gt-ink-muted)]/50">TRUNCATED</span>
                    ) : null}
                    {message.lineNumber ? (
                      <span className="text-[var(--gt-ink-muted)]/50">JSONL:{message.lineNumber}</span>
                    ) : null}
                    {detailState.rawJSONLoadingMessageID === message.id ? (
                      <span className="text-[var(--gt-ink-muted)]/50">RAW JSON</span>
                    ) : null}
                  </div>
                  <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[length:var(--gt-font-size-sm)] leading-5 text-[var(--gt-ink-primary)]">
                    {message.content || message.summary}
                  </pre>
                  {detailState.rawJSONByMessageID[message.id] ? (
                    <div className={sessionManagementRawJsonPanelClass} data-session-management-raw-json="quiet">
                      <div className={sessionManagementRawJsonHeaderClass}>
                        RAW JSON
                      </div>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-primary)]">
                        {detailState.rawJSONByMessageID[message.id]}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}
              {detailState.rawJSONError ? (
                <div className="border-b border-[var(--gt-border-subtle)] px-5 py-2 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-status-danger)]">
                  {copy.loadFailed} / {detailState.rawJSONError}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
                  {copy.messageLoadedLine(selectedSessionDetail.messages.length, selectedSessionDetail.messageCount)}
                </div>
                {detailState.messagePageError ? (
                  <div className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-status-danger)]">
                    {copy.loadFailed} / {detailState.messagePageError}
                  </div>
                ) : null}
                {detailState.hasMoreMessages ? (
                  <Button
                    size="small"
                    onClick={onLoadMoreMessages}
                    disabled={detailState.messagePageLoading}
                  >
                    {detailState.messagePageLoading ? copy.messagePageLoading : copy.loadMoreMessages}
                  </Button>
                ) : null}
              </div>
            </>
          ) : detailState.error ? (
            <StatePanel title={copy.loadFailed} description={detailState.error} actionLabel={copy.retry} onAction={onRetry} />
          ) : (
            <StatePanel title={copy.noMessages} description={selectedSessionSummary?.displayTitle ?? selectedSessionSummary?.title ?? copy.unavailable} />
          )}
        </div>
      </div>
    </div>
  );
}
