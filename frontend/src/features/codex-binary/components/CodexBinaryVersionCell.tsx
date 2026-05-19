import { CheckCircle2, Download, ExternalLink, FolderOpen, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
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
  const articleClass = row.isSelected
    ? 'border-[3px] border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]'
    : 'border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]';

  return (
    <article className={`${articleClass} cursor-pointer`} onClick={onToggleNotes}>
      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-0 truncate text-xl font-black leading-tight text-[var(--text-primary)]">
                Codex {row.version}
              </div>
              {row.isSelected ? (
                <span className="inline-flex items-center gap-1 bg-[var(--accent-green)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-on-accent)]">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('codex_binary.active')}
                </span>
              ) : null}
              {row.isRollback ? (
                <span className="bg-[var(--accent-yellow)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                  {t('codex_binary.rollback_available')}
                </span>
              ) : null}
            </div>
            {shouldShowAssetSize ? (
              <div className="mt-1 text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {t('codex_binary.file_size')}: {assetSize || t('codex_binary.file_size_unknown')}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:justify-end">
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
      </div>

      {row.task ? (
        <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
          <div className="mb-1 flex justify-between text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            <span>{t(`codex_binary.phase_${row.task.phase}`)}</span>
            <span>{taskSize ? `${progress}% · ${taskSize}` : `${progress}%`}</span>
          </div>
          <div className="h-2 border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <div className="h-full bg-[var(--text-primary)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div className="max-h-[22rem] overflow-auto border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4" onClick={(event) => event.stopPropagation()}>
          {notesState?.loading ? <div className="text-sm font-bold text-[var(--text-muted)]">{t('codex_binary.notes_loading')}</div> : null}
          {notesState?.error ? <div className="text-sm font-bold text-[var(--accent-red)]">{notesState.error}</div> : null}
          {notesState?.notes ? (
            <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-a:text-[var(--accent-red)]">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{notesState.notes.bodyMarkdown || t('codex_binary.notes_empty')}</ReactMarkdown>
              <div className="mt-3 text-[length:var(--font-size-ui-sm-plus)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {notesState.notes.source === 'cache' ? t('codex_binary.notes_from_cache') : t('codex_binary.notes_from_remote')}
              </div>
            </div>
          ) : null}
          {!row.tag && !notesState?.loading ? <div className="text-sm font-semibold text-[var(--text-muted)]">{t('codex_binary.local_import_notes')}</div> : null}
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
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        className="btn-swiss flex min-h-9 w-full min-w-0 items-center justify-center !px-2.5 !py-2 disabled:cursor-not-allowed disabled:opacity-55 sm:w-9"
        aria-label={t('codex_binary.more_actions')}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.35rem)] z-20 w-44 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-[4px_4px_0_var(--shadow-color)]"
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.06em] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-45 ${danger ? 'text-[var(--accent-red)]' : 'text-[var(--text-primary)]'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function StaticActionState({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <div className="flex min-h-9 min-w-0 items-center justify-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)] sm:min-w-[10.5rem]">
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
  const toneClass =
    tone === 'primary'
      ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]'
      : tone === 'warning'
        ? 'bg-[var(--accent-yellow)] !text-[var(--text-primary)]'
        : tone === 'danger'
          ? '!text-[var(--accent-red)]'
          : '';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`btn-swiss min-h-9 w-full min-w-0 whitespace-nowrap !px-3 !py-2 !text-[length:var(--font-size-ui-sm)] disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-[10.5rem] ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}
