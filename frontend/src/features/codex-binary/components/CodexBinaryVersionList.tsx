import SegmentedControl from '../../../components/ui/SegmentedControl';
import type { SegmentedOption } from '../../../types';
import type { CodexBinaryReleaseFilter, CodexBinaryVersionNotes, CodexBinaryVersionRowView } from '../model';
import CodexBinaryVersionCell from './CodexBinaryVersionCell';

const codexBinaryVersionListLabelClass =
  'text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]';
const codexBinaryVersionListEmptyClass =
  'border border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-8 text-center text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]';

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
    <section className="space-y-3" data-codex-binary-version-list="quiet">
      <div className="flex flex-col gap-2 px-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div className={codexBinaryVersionListLabelClass}>
          {t('codex_binary.release_filter')}
        </div>
        <SegmentedControl options={releaseFilterOptions} value={releaseFilter} onChange={onReleaseFilterChange} />
      </div>
      {visibleRows.length === 0 ? (
        <div className={codexBinaryVersionListEmptyClass} data-codex-binary-version-empty="quiet">
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
