import { useI18n } from '../../../context/I18nContext';

interface DebugHeaderProps {
  count: number;
  allSelected: boolean;
  selectedCount: number;
  copyState: 'idle' | 'success' | 'error';
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onCopySelected: () => void;
  onClearAll: () => void;
}

export default function DebugHeader({
  count,
  allSelected,
  selectedCount,
  copyState,
  onToggleSelectAll,
  onClearSelection,
  onCopySelected,
  onClearAll,
}: DebugHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
      <div>
        <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
          {t('debug.title')}
        </h2>
        <p className="mt-1 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {t('debug.subtitle')} / {count} UNITS
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onToggleSelectAll} className="btn-swiss" disabled={count === 0}>
          {allSelected ? t('debug.unselect_all') : t('debug.select_all')}
        </button>
        <button onClick={onClearSelection} className="btn-swiss" disabled={selectedCount === 0}>
          {t('debug.clear_selection')}
        </button>
        <button onClick={onCopySelected} className="btn-swiss" disabled={selectedCount === 0}>
          {copyState === 'success'
            ? t('debug.copy_success')
            : copyState === 'error'
              ? t('debug.copy_error')
              : `${t('debug.copy_selected')} (${selectedCount})`}
        </button>
        <button onClick={onClearAll} className="btn-swiss" disabled={count === 0}>
          {t('debug.clear')}
        </button>
      </div>
    </header>
  );
}
