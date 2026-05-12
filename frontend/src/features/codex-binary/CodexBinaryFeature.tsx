import { CheckCircle2, Download, FolderOpen, RefreshCw, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import { toErrorMessage } from '../../utils/error';
import {
  downloadCodexBinary,
  enableCodexBinaryManagedPath,
  getCodexBinarySnapshot,
  getCodexBinaryVersionNotes,
  refreshCodexBinaryAvailable,
  useCodexBinary,
} from './api';
import {
  buildCodexBinaryRows,
  formatTaskProgress,
  getCodexBinaryRowActions,
  type CodexBinarySnapshot,
  type CodexBinaryVersionNotes,
  type CodexBinaryVersionRowView,
} from './model';

type NotesState = Record<string, { loading: boolean; notes?: CodexBinaryVersionNotes; error?: string }>;

export default function CodexBinaryFeature() {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<CodexBinarySnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyVersionID, setBusyVersionID] = useState('');
  const [busyRowID, setBusyRowID] = useState('');
  const [managedBusy, setManagedBusy] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [notesByRow, setNotesByRow] = useState<NotesState>({});

  const rows = useMemo(() => (snapshot ? buildCodexBinaryRows(snapshot) : []), [snapshot]);

  async function reload(messageOverride?: string, refreshRemote = true) {
    setLoading(true);
    try {
      const nextSnapshot = await getCodexBinarySnapshot();
      setSnapshot(nextSnapshot);
      setMessage(messageOverride || t('codex_binary.loaded'));
      if (refreshRemote) {
        try {
          const refreshedSnapshot = await refreshCodexBinaryAvailable();
          setSnapshot(refreshedSnapshot);
          setMessage(t('codex_binary.remote_loaded'));
        } catch (error) {
          setMessage(`${t('codex_binary.remote_load_failed')}: ${toErrorMessage(error)}`);
        }
      }
    } catch (error) {
      setMessage(`${t('codex_binary.load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function activate(row: CodexBinaryVersionRowView) {
    if (!row.installedVersionID || !snapshot) {
      return;
    }
    setBusyVersionID(row.installedVersionID);
    try {
      const nextSnapshot = await useCodexBinary(row.installedVersionID, snapshot.selectedVersionID);
      setSnapshot(nextSnapshot);
      setMessage(row.isRollback ? t('codex_binary.rollback_done') : t('codex_binary.activate_done'));
    } catch (error) {
      setMessage(`${t('codex_binary.activate_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setBusyVersionID('');
    }
  }

  async function downloadAndActivate(row: CodexBinaryVersionRowView) {
    if (!row.tag) {
      return;
    }
    setBusyRowID(row.rowID);
    try {
      const nextSnapshot = await downloadCodexBinary(row.sourceID, row.tag);
      setSnapshot(nextSnapshot);
      setMessage(t('codex_binary.download_activate_done'));
    } catch (error) {
      setMessage(`${t('codex_binary.download_activate_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setBusyRowID('');
    }
  }

  async function enableManagedPath() {
    setManagedBusy(true);
    try {
      const result = await enableCodexBinaryManagedPath();
      if (result.snapshot) {
        setSnapshot(result.snapshot);
      } else {
        await reload(undefined, false);
      }
      const status = result.changed ? t('codex_binary.managed_enabled') : t('codex_binary.managed_already_enabled');
      setMessage(`${status}: ${result.profilePath}`);
    } catch (error) {
      setMessage(`${t('codex_binary.managed_enable_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setManagedBusy(false);
    }
  }

  async function toggleNotes(row: CodexBinaryVersionRowView) {
    setExpandedRows((prev) => ({ ...prev, [row.rowID]: !prev[row.rowID] }));
    if (!row.tag || notesByRow[row.rowID]?.notes || notesByRow[row.rowID]?.loading) {
      return;
    }
    setNotesByRow((prev) => ({ ...prev, [row.rowID]: { loading: true } }));
    try {
      const notes = await getCodexBinaryVersionNotes(row.sourceID, row.tag);
      setNotesByRow((prev) => ({ ...prev, [row.rowID]: { loading: false, notes } }));
    } catch (error) {
      setNotesByRow((prev) => ({
        ...prev,
        [row.rowID]: { loading: false, error: toErrorMessage(error) },
      }));
    }
  }

  return (
    <div className="h-full min-h-0 w-full overflow-auto px-4 py-5 sm:p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_BINARY">
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={t('codex_binary.title')}
          subtitle={t('codex_binary.subtitle')}
          align="center"
        />

        <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[6px_6px_0_var(--shadow-color)] sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0 space-y-3">
              <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('codex_binary.current_label')}
              </div>
              <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
                <div className="min-w-0 truncate text-2xl font-black text-[var(--text-primary)]">
                  {snapshot?.currentVersion?.displayName || t('codex_binary.no_active')}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill severity={snapshot?.doctor.severity || 'info'} text={snapshot?.doctor.message || t('codex_binary.loading')} />
                  {snapshot?.managedConfig ? (
                    <StatusPill
                      severity={snapshot.managedConfig.isPathConfigured ? 'ok' : 'warning'}
                      text={snapshot.managedConfig.isPathConfigured ? t('codex_binary.managed_path_enabled') : t('codex_binary.managed_path_disabled')}
                    />
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 truncate text-xs font-semibold text-[var(--text-muted)]">
                {snapshot?.managedBinPath || '~/.config/gettokens/codex/bin/codex'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {snapshot?.managedConfig && !snapshot.managedConfig.isPathConfigured ? (
                <button
                  type="button"
                  onClick={() => void enableManagedPath()}
                  disabled={managedBusy}
                  className="btn-swiss whitespace-nowrap bg-[var(--text-primary)] !px-3 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {managedBusy ? t('codex_binary.managing') : t('codex_binary.enable_managed')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void reload(t('codex_binary.refreshed'), true)}
                disabled={loading}
                className="btn-swiss whitespace-nowrap !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('codex_binary.refresh')}
              </button>
            </div>
          </div>
          {snapshot?.managedConfig ? (
            <div className="mt-4 grid gap-x-5 gap-y-2 border-t-2 border-[var(--border-color)] pt-3 text-[0.625rem] font-semibold text-[var(--text-muted)] md:grid-cols-3">
              <ManagedMeta label={t('codex_binary.managed_bin_dir')} value={snapshot.managedConfig.binDir} />
              <ManagedMeta label={t('codex_binary.resolved_codex_path')} value={snapshot.managedConfig.resolvedCodexPath || t('codex_binary.resolved_codex_missing')} />
              <ManagedMeta label={t('codex_binary.managed_profile_target')} value={snapshot.managedConfig.profilePath || t('codex_binary.managed_profile_unknown')} strong />
            </div>
          ) : null}
          {message ? <div className="mt-3 border-t border-[var(--border-color)] pt-3 text-xs font-semibold text-[var(--text-muted)]">{message}</div> : null}
        </section>

        <section className="space-y-3">
          {rows.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--border-color)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
              {loading ? t('codex_binary.loading') : t('codex_binary.empty')}
            </div>
          ) : (
            rows.map((row) => (
              <VersionCell
                key={row.rowID}
                row={row}
                expanded={Boolean(expandedRows[row.rowID])}
                notesState={notesByRow[row.rowID]}
                busy={busyVersionID === row.installedVersionID || busyRowID === row.rowID}
                onToggleNotes={() => void toggleNotes(row)}
                onActivate={() => void activate(row)}
                onDownloadAndActivate={() => void downloadAndActivate(row)}
                t={t}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function VersionCell({
  row,
  expanded,
  notesState,
  busy,
  onToggleNotes,
  onActivate,
  onDownloadAndActivate,
  t,
}: {
  row: CodexBinaryVersionRowView;
  expanded: boolean;
  notesState?: { loading: boolean; notes?: CodexBinaryVersionNotes; error?: string };
  busy: boolean;
  onToggleNotes: () => void;
  onActivate: () => void;
  onDownloadAndActivate: () => void;
  t: (key: string) => string;
}) {
  const actions = getCodexBinaryRowActions(row);
  const progress = formatTaskProgress(row.task);

  return (
    <article className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <button
          type="button"
          onClick={onToggleNotes}
          className="min-w-0 border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-black text-[var(--text-primary)]">Codex {row.version}</span>
            {row.tag ? <span className="border border-[var(--border-color)] px-2 py-1 text-[0.62rem] font-black text-[var(--text-muted)]">{row.tag}</span> : null}
            {row.isSelected ? <span className="inline-flex items-center gap-1 bg-[var(--accent-green)] px-2 py-1 text-[0.62rem] font-black text-white"><CheckCircle2 className="h-3 w-3" />{t('codex_binary.active')}</span> : null}
            {row.isRollback ? <span className="bg-[var(--accent-yellow)] px-2 py-1 text-[0.62rem] font-black text-[var(--text-primary)]">{t('codex_binary.rollback_available')}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[var(--text-muted)]">
            <span>{row.isInstalled ? t('codex_binary.installed') : t('codex_binary.remote_available')}</span>
            {row.publishedAt ? <span>{t('codex_binary.published_at')} {formatDate(row.publishedAt)}</span> : null}
            {row.installedAt ? <span>{t('codex_binary.installed_at')} {formatDate(row.installedAt)}</span> : null}
          </div>
          {row.task ? (
            <div className="mt-3 max-w-md">
              <div className="mb-1 flex justify-between text-[0.65rem] font-black uppercase text-[var(--text-muted)]">
                <span>{t(`codex_binary.phase_${row.task.phase}`)}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 border border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="h-full bg-[var(--accent-red)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </button>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {actions.primary === 'download_activate' ? <CellButton tone="primary" icon={<Download className="h-4 w-4" />} disabled={busy} label={busy ? t('codex_binary.downloading') : t('codex_binary.download_activate')} onClick={onDownloadAndActivate} /> : null}
          {actions.primary === 'activate' ? <CellButton tone="primary" icon={<CheckCircle2 className="h-4 w-4" />} disabled={busy} label={busy ? t('codex_binary.activating') : t('codex_binary.activate')} onClick={onActivate} /> : null}
          {actions.primary === 'rollback' ? <CellButton tone="warning" icon={<RotateCcw className="h-4 w-4" />} disabled={busy} label={busy ? t('codex_binary.activating') : t('codex_binary.rollback')} onClick={onActivate} /> : null}
          {actions.secondary === 'cancel' ? <CellButton tone="danger" icon={<X className="h-4 w-4" />} disabled label={t('codex_binary.cancel_download')} /> : null}
          {actions.secondary === 'reveal' ? <CellButton icon={<FolderOpen className="h-4 w-4" />} disabled label={t('codex_binary.reveal')} /> : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          {notesState?.loading ? <div className="text-sm font-bold text-[var(--text-muted)]">{t('codex_binary.notes_loading')}</div> : null}
          {notesState?.error ? <div className="text-sm font-bold text-[var(--accent-red)]">{notesState.error}</div> : null}
          {notesState?.notes ? (
            <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-a:text-[var(--accent-red)]">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{notesState.notes.bodyMarkdown || t('codex_binary.notes_empty')}</ReactMarkdown>
              <div className="mt-3 text-[0.65rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
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
      onClick={onClick}
      disabled={disabled}
      className={`btn-swiss min-h-9 whitespace-nowrap !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-55 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusPill({ severity, text }: { severity: string; text: string }) {
  const color = severity === 'ok' ? 'bg-[var(--accent-green)] text-white' : severity === 'error' ? 'bg-[var(--accent-red)] text-white' : 'bg-[var(--accent-yellow)] text-[var(--text-primary)]';
  return <span className={`inline-flex items-center px-3 py-2 text-xs font-black ${color}`}>{text}</span>;
}

function ManagedMeta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">{label}</div>
      <div className={`mt-1 min-w-0 truncate ${strong ? 'text-[var(--text-primary)]' : ''}`}>{value}</div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
