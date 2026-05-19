import SegmentedControl from '../../../components/ui/SegmentedControl';
import type { SegmentedOption } from '../../../types';
import type { CodexBinaryReleaseFilter, CodexBinaryVersionNotes, CodexBinaryVersionRowView } from '../model';
import CodexBinaryVersionCell from './CodexBinaryVersionCell';

export default function CodexBinaryVersionList({
  rows,
  visibleRows,
  loading,
  releaseFilter,
  releaseFilterOptions,
  expandedRows,
  notesByRow,
  busyVersionID,
  busyRowID,
  menuRowID,
  onReleaseFilterChange,
  onToggleNotes,
  onActivate,
  onDownload,
  onToggleMenu,
  onOpenBrowser,
  onReveal,
  onDelete,
  t,
}: {
  rows: CodexBinaryVersionRowView[];
  visibleRows: CodexBinaryVersionRowView[];
  loading: boolean;
  releaseFilter: CodexBinaryReleaseFilter;
  releaseFilterOptions: SegmentedOption<CodexBinaryReleaseFilter>[];
  expandedRows: Record<string, boolean>;
  notesByRow: Record<string, { loading: boolean; notes?: CodexBinaryVersionNotes; error?: string }>;
  busyVersionID: string;
  busyRowID: string;
  menuRowID: string;
  onReleaseFilterChange: (filter: CodexBinaryReleaseFilter) => void;
  onToggleNotes: (row: CodexBinaryVersionRowView) => void;
  onActivate: (row: CodexBinaryVersionRowView) => void;
  onDownload: (row: CodexBinaryVersionRowView) => void;
  onToggleMenu: (rowID: string) => void;
  onOpenBrowser: (row: CodexBinaryVersionRowView) => void;
  onReveal: (row: CodexBinaryVersionRowView) => void;
  onDelete: (row: CodexBinaryVersionRowView) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 px-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {t('codex_binary.release_filter')}
        </div>
        <SegmentedControl options={releaseFilterOptions} value={releaseFilter} onChange={onReleaseFilterChange} />
      </div>
      {visibleRows.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--border-color)] p-8 text-center text-sm font-bold text-[var(--text-muted)]">
          {loading ? t('codex_binary.loading') : rows.length === 0 ? t('codex_binary.empty') : t('codex_binary.empty_filtered')}
        </div>
      ) : (
        visibleRows.map((row) => (
          <CodexBinaryVersionCell
            key={row.rowID}
            row={row}
            expanded={Boolean(expandedRows[row.rowID])}
            notesState={notesByRow[row.rowID]}
            busy={busyVersionID === row.installedVersionID || busyRowID === row.rowID}
            menuOpen={menuRowID === row.rowID}
            onToggleNotes={() => onToggleNotes(row)}
            onActivate={() => onActivate(row)}
            onDownload={() => onDownload(row)}
            onToggleMenu={() => onToggleMenu(row.rowID)}
            onOpenBrowser={() => onOpenBrowser(row)}
            onReveal={() => onReveal(row)}
            onDelete={() => onDelete(row)}
            t={t}
          />
        ))
      )}
    </section>
  );
}
