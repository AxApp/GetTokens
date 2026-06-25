import { useEffect, useMemo, useState } from 'react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import type { SegmentedOption } from '../../types';
import { toErrorMessage } from '../../utils/error';
import CodexBinarySummaryPanel from './components/CodexBinarySummaryPanel';
import CodexBinaryVersionList from './components/CodexBinaryVersionList';
import {
  deleteCodexBinaryVersion,
  downloadCodexBinary,
  enableCodexBinaryManagedPath,
  getCodexBinarySnapshot,
  getCodexBinaryVersionNotes,
  refreshCodexBinaryAvailable,
  revealCodexBinaryVersion,
  useCodexBinary,
} from './api';
import {
  buildCodexBinaryRows,
  DEFAULT_CODEX_BINARY_RELEASE_FILTER,
  filterCodexBinaryRows,
  isActiveDownloadTask,
  type CodexBinaryReleaseFilter,
  type CodexBinarySnapshot,
  type CodexBinaryVersionNotes,
  type CodexBinaryVersionRowView,
} from './model';
import { getVersionBrowserURL } from './presentation';

type NotesState = Record<string, { loading: boolean; notes?: CodexBinaryVersionNotes; error?: string }>;

export default function CodexBinaryFeature() {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<CodexBinarySnapshot | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyVersionID, setBusyVersionID] = useState('');
  const [busyRowID, setBusyRowID] = useState('');
  const [managedBusy, setManagedBusy] = useState(false);
  const [releaseFilter, setReleaseFilter] = useState<CodexBinaryReleaseFilter>(DEFAULT_CODEX_BINARY_RELEASE_FILTER);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [notesByRow, setNotesByRow] = useState<NotesState>({});
  const [menuRowID, setMenuRowID] = useState('');

  const rows = useMemo(() => (snapshot ? buildCodexBinaryRows(snapshot) : []), [snapshot]);
  const visibleRows = useMemo(() => filterCodexBinaryRows(rows, releaseFilter), [rows, releaseFilter]);
  const hasActiveDownloadTask = useMemo(() => rows.some((row) => isActiveDownloadTask(row.task)), [rows]);
  const releaseFilterOptions = useMemo<SegmentedOption<CodexBinaryReleaseFilter>[]>(
    () => [
      { id: 'all', label: t('codex_binary.filter_all') },
      { id: 'stable', label: t('codex_binary.filter_stable') },
      { id: 'alpha', label: t('codex_binary.filter_alpha') },
    ],
    [t],
  );

  async function reload(messageOverride?: string, refreshRemote = false) {
    setLoading(true);
    try {
      const nextSnapshot = await getCodexBinarySnapshot();
      setSnapshot(nextSnapshot);
      setMessage(messageOverride || '');
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
    void reload(undefined, false);
  }, []);

  useEffect(() => {
    if (!menuRowID) {
      return undefined;
    }
    const closeMenu = () => setMenuRowID('');
    const closeMenuByEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuRowID('');
      }
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', closeMenuByEscape);
    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', closeMenuByEscape);
    };
  }, [menuRowID]);

  useEffect(() => {
    if (!busyRowID && !hasActiveDownloadTask) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void getCodexBinarySnapshot()
        .then(setSnapshot)
        .catch((error) => setMessage(`${t('codex_binary.load_failed')}: ${toErrorMessage(error)}`));
    }, 500);
    return () => window.clearInterval(timer);
  }, [busyRowID, hasActiveDownloadTask, t]);

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

  async function downloadVersion(row: CodexBinaryVersionRowView) {
    if (!row.tag) {
      return;
    }
    setBusyRowID(row.rowID);
    try {
      const nextSnapshot = await downloadCodexBinary(row.sourceID, row.tag);
      setSnapshot(nextSnapshot);
      setMessage(t('codex_binary.download_done'));
    } catch (error) {
      setMessage(`${t('codex_binary.download_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setBusyRowID('');
    }
  }

  async function revealVersion(row: CodexBinaryVersionRowView) {
    if (!row.installedVersionID) {
      return;
    }
    setMenuRowID('');
    try {
      await revealCodexBinaryVersion(row.installedVersionID);
      setMessage(t('codex_binary.reveal_done'));
    } catch (error) {
      setMessage(`${t('codex_binary.reveal_failed')}: ${toErrorMessage(error)}`);
    }
  }

  async function deleteVersion(row: CodexBinaryVersionRowView) {
    if (!row.installedVersionID || row.isSelected) {
      return;
    }
    setMenuRowID('');
    const confirmed = window.confirm(t('codex_binary.delete_confirm'));
    if (!confirmed) {
      return;
    }
    setBusyVersionID(row.installedVersionID);
    try {
      const nextSnapshot = await deleteCodexBinaryVersion(row.installedVersionID);
      setSnapshot(nextSnapshot);
      setMessage(t('codex_binary.delete_done'));
    } catch (error) {
      setMessage(`${t('codex_binary.delete_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setBusyVersionID('');
    }
  }

  function openVersionInBrowser(row: CodexBinaryVersionRowView) {
    const url = getVersionBrowserURL(row);
    if (!url) {
      return;
    }
    setMenuRowID('');
    window.open(url, '_blank', 'noopener,noreferrer');
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
    <div className="h-full min-h-0 w-full overflow-auto [scrollbar-gutter:stable] px-4 py-5 sm:p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_BINARY">
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={t('codex_binary.title')}
          subtitle={t('codex_binary.subtitle')}
          align="center"
        />

        <div className="space-y-4">
          <CodexBinarySummaryPanel
            snapshot={snapshot}
            message={message}
            loading={loading}
            managedBusy={managedBusy}
            onEnableManagedPath={() => void enableManagedPath()}
            onRefresh={() => void reload(t('codex_binary.refreshed'), true)}
            t={t}
          />

          <CodexBinaryVersionList
            rows={rows}
            visibleRows={visibleRows}
            loading={loading}
            releaseFilter={releaseFilter}
            releaseFilterOptions={releaseFilterOptions}
            expandedRows={expandedRows}
            notesByRow={notesByRow}
            busyVersionID={busyVersionID}
            busyRowID={busyRowID}
            menuRowID={menuRowID}
            onReleaseFilterChange={setReleaseFilter}
            onToggleNotes={(row) => void toggleNotes(row)}
            onActivate={(row) => void activate(row)}
            onDownload={(row) => void downloadVersion(row)}
            onToggleMenu={(rowID) => setMenuRowID((current) => (current === rowID ? '' : rowID))}
            onOpenBrowser={openVersionInBrowser}
            onReveal={(row) => void revealVersion(row)}
            onDelete={(row) => void deleteVersion(row)}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
