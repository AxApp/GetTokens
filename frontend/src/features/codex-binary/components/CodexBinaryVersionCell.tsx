import { CheckCircle2, Download, ExternalLink, FolderOpen, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from 'antd';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  formatBinarySize,
  formatTaskProgress,
  getCodexBinaryRowActions,
  type CodexBinaryVersionNotes,
  type CodexBinaryVersionRowView,
} from '../model';
import { formatTaskSize, getVersionBrowserURL } from '../presentation';

const codexBinaryVersionCellShellClass =
  'overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] transition hover:border-[color-mix(in_srgb,var(--gt-ink-primary)_32%,var(--gt-border-subtle))]';
const codexBinaryVersionCellSelectedClass =
  'border-[color-mix(in_srgb,var(--gt-status-success)_38%,var(--gt-border-subtle))] bg-[color-mix(in_srgb,var(--gt-status-success)_4%,var(--gt-surface-canvas))]';
const codexBinaryVersionCellHeaderClass =
  'grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center';
const codexBinaryVersionCellTitleClass =
  'min-w-0 truncate text-[length:var(--gt-font-size-lg)] font-semibold leading-tight tracking-normal text-[var(--gt-ink-primary)]';
const codexBinaryVersionCellMetaClass =
  'mt-1 text-[length:var(--gt-font-size-sm)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const codexBinaryVersionCellBadgeBaseClass =
  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal';
const codexBinaryVersionCellBadgeToneClass = {
  success:
    'border-[color-mix(in_srgb,var(--gt-status-success)_22%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_8%,var(--gt-surface-canvas))] text-[var(--gt-status-success)]',
  warning:
    'border-[color-mix(in_srgb,var(--gt-status-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_9%,var(--gt-surface-canvas))] text-[var(--gt-status-warning)]',
} satisfies Record<'success' | 'warning', string>;
const codexBinaryVersionCellActionsClass =
  'flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row lg:justify-end';
const codexBinaryVersionCellProgressClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const codexBinaryVersionCellProgressMetaClass =
  'mb-1 flex justify-between gap-3 text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexBinaryVersionCellProgressTrackClass =
  'h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--gt-ink-primary)_10%,var(--gt-surface-canvas))]';
const codexBinaryVersionCellProgressFillClass =
  'h-full rounded-full bg-[var(--gt-ink-primary)]';
const codexBinaryVersionCellNotesClass =
  'max-h-[22rem] overflow-auto border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';
const codexBinaryVersionCellNotesMetaClass =
  'mt-3 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexBinaryVersionCellStatusTextClass =
  'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexBinaryVersionCellErrorTextClass =
  'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]';
const codexBinaryVersionCellMenuClass =
  'absolute right-0 top-[calc(100%+0.35rem)] z-20 w-48 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-1 shadow-sm';
const codexBinaryVersionCellStaticActionClass =
  'flex min-h-9 min-w-0 items-center justify-center gap-2 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-center text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)] sm:min-w-[10.5rem]';

export interface CodexBinaryVersionCellProps {
  row: CodexBinaryVersionRowView;
  expanded: boolean;
  notesState?: { loading: boolean; notes?: CodexBinaryVersionNotes; error?: string };
  busy: boolean;
  menuOpen: boolean;
  onToggleNotes: () => void;
  onActivate: () => void;
  onDownload: () => void;
  onToggleMenu: () => void;
  onOpenBrowser: () => void;
  onReveal: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

export default function CodexBinaryVersionCell({
  row,
  expanded,
  notesState,
  busy,
  menuOpen,
  onToggleNotes,
  onActivate,
  onDownload,
  onToggleMenu,
  onOpenBrowser,
  onReveal,
  onDelete,
  t,
}: CodexBinaryVersionCellProps) {
  const actions = getCodexBinaryRowActions(row);
  const progress = formatTaskProgress(row.task);
  const assetSize = formatBinarySize(row.assetSize || row.task?.bytesTotal);
  const shouldShowAssetSize = row.hasRemote || Boolean(assetSize);
  const taskSize = formatTaskSize(row.task, row.assetSize);

  return (
    <article
      data-design-system-component="true"
      data-design-system-component-name="CodexBinaryVersionCell"
      data-codex-binary-version-cell="quiet"
      className={`${codexBinaryVersionCellShellClass} ${row.isSelected ? codexBinaryVersionCellSelectedClass : ''} cursor-pointer`}
      onClick={onToggleNotes}
    >
      <div className={codexBinaryVersionCellHeaderClass}>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className={codexBinaryVersionCellTitleClass}>
              Codex {row.version}
            </div>
            {row.isSelected ? (
              <span className={`${codexBinaryVersionCellBadgeBaseClass} ${codexBinaryVersionCellBadgeToneClass.success}`}>
                <CheckCircle2 className="h-3 w-3" />
                {t('codex_binary.active')}
              </span>
            ) : null}
            {row.isRollback ? (
              <span className={`${codexBinaryVersionCellBadgeBaseClass} ${codexBinaryVersionCellBadgeToneClass.warning}`}>
                {t('codex_binary.rollback_available')}
              </span>
            ) : null}
          </div>
          {shouldShowAssetSize ? (
            <div className={codexBinaryVersionCellMetaClass}>
              {t('codex_binary.file_size')}: {assetSize || t('codex_binary.file_size_unknown')}
            </div>
          ) : null}
        </div>

        <div className={codexBinaryVersionCellActionsClass}>
          {actions.primary === 'download' ? <CellButton tone="primary" icon={<Download className="h-4 w-4" />} disabled={busy} label={busy ? t('codex_binary.downloading') : t('codex_binary.download')} onClick={onDownload} /> : null}
          {actions.primary === 'activate' ? <CellButton tone="primary" icon={<CheckCircle2 className="h-4 w-4" />} disabled={busy} label={busy ? t('codex_binary.activating') : t('codex_binary.activate')} onClick={onActivate} /> : null}
          {actions.primary === 'rollback' ? <CellButton tone="primary" icon={<RotateCcw className="h-4 w-4" />} disabled={busy} label={busy ? t('codex_binary.activating') : t('codex_binary.rollback')} onClick={onActivate} /> : null}
          {actions.primary === 'none' && row.isSelected ? <StaticActionState icon={<CheckCircle2 className="h-4 w-4" />} label={t('codex_binary.active')} /> : null}
          {actions.primary === 'none' && row.task ? <StaticActionState label={`${progress}%`} /> : null}
          {row.isInstalled || getVersionBrowserURL(row) ? (
            <VersionMoreMenu
              open={menuOpen}
              disabled={busy}
              browserURL={getVersionBrowserURL(row)}
              deleteDisabled={row.isSelected}
              onToggle={onToggleMenu}
              onOpenBrowser={onOpenBrowser}
              onReveal={row.isInstalled ? onReveal : undefined}
              onDelete={row.isInstalled ? onDelete : undefined}
              t={t}
            />
          ) : null}
        </div>
      </div>

      {row.task ? (
        <div data-codex-binary-version-progress="quiet" className={codexBinaryVersionCellProgressClass}>
          <div className={codexBinaryVersionCellProgressMetaClass}>
            <span>{t(`codex_binary.phase_${row.task.phase}`)}</span>
            <span>{taskSize ? `${progress}% · ${taskSize}` : `${progress}%`}</span>
          </div>
          <div className={codexBinaryVersionCellProgressTrackClass}>
            <div className={codexBinaryVersionCellProgressFillClass} style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div data-codex-binary-version-notes="quiet" className={codexBinaryVersionCellNotesClass} onClick={(event) => event.stopPropagation()}>
          {notesState?.loading ? <div className={codexBinaryVersionCellStatusTextClass}>{t('codex_binary.notes_loading')}</div> : null}
          {notesState?.error ? <div className={codexBinaryVersionCellErrorTextClass}>{notesState.error}</div> : null}
          {notesState?.notes ? (
            <div className="prose prose-sm max-w-none text-[var(--gt-ink-primary)] prose-headings:text-[var(--gt-ink-primary)] prose-a:text-[var(--gt-status-danger)]">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{notesState.notes.bodyMarkdown || t('codex_binary.notes_empty')}</ReactMarkdown>
              <div className={codexBinaryVersionCellNotesMetaClass}>
                {notesState.notes.source === 'cache' ? t('codex_binary.notes_from_cache') : t('codex_binary.notes_from_remote')}
              </div>
            </div>
          ) : null}
          {!row.tag && !notesState?.loading ? <div className={codexBinaryVersionCellStatusTextClass}>{t('codex_binary.local_import_notes')}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

function VersionMoreMenu({
  open,
  disabled,
  browserURL,
  deleteDisabled,
  onToggle,
  onOpenBrowser,
  onReveal,
  onDelete,
  t,
}: {
  open: boolean;
  disabled?: boolean;
  browserURL?: string;
  deleteDisabled?: boolean;
  onToggle: () => void;
  onOpenBrowser: () => void;
  onReveal?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="relative">
      <Button
        size="small"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        icon={<MoreHorizontal className="h-4 w-4" />}
        aria-label={t('codex_binary.more_actions')}
        title={t('codex_binary.more_actions')}
      />
      {open ? (
        <div
          className={codexBinaryVersionCellMenuClass}
          onClick={(event) => event.stopPropagation()}
        >
          {browserURL ? <MenuAction icon={<ExternalLink className="h-4 w-4" />} label={t('codex_binary.open_in_browser')} onClick={onOpenBrowser} /> : null}
          {onReveal ? <MenuAction icon={<FolderOpen className="h-4 w-4" />} label={t('codex_binary.reveal_in_finder')} onClick={onReveal} /> : null}
          {onDelete ? <MenuAction icon={<Trash2 className="h-4 w-4" />} label={t('codex_binary.delete_version')} onClick={onDelete} disabled={deleteDisabled} danger /> : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      size="small"
      onClick={onClick}
      disabled={disabled}
      icon={icon}
      className={`${danger ? 'text-[var(--gt-status-danger)] hover:bg-[color-mix(in_srgb,var(--gt-status-danger)_7%,var(--gt-surface-canvas))]' : ''}`}
    >
      {label}
    </Button>
  );
}

function StaticActionState({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <div className={codexBinaryVersionCellStaticActionClass}>
      {icon}
      {label}
    </div>
  );
}

function CellButton({
  icon,
  label,
  disabled,
  onClick,
  tone = 'secondary',
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  tone?: 'primary' | 'secondary' | 'warning' | 'danger';
}) {
  return (
    <Button
      type={tone === 'primary' ? 'primary' : 'default'}
      size="small"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      icon={icon}
    >
      {label}
    </Button>
  );
}
