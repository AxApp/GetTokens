import type { SourceFilter, Translator } from '../model/types';

interface AccountsToolbarProps {
  t: Translator;
  searchTerm: string;
  sourceFilter: SourceFilter;
  isSelectionMode: boolean;
  allFilteredSelected: boolean;
  selectedAccountCount: number;
  onSearchChange: (value: string) => void;
  onSourceFilterChange: (value: SourceFilter) => void;
  onToggleSelectionMode: () => void;
  onToggleSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onExportSelected: () => void;
}

export default function AccountsToolbar({
  t,
  searchTerm,
  sourceFilter,
  isSelectionMode,
  allFilteredSelected,
  selectedAccountCount,
  onSearchChange,
  onSourceFilterChange,
  onToggleSelectionMode,
  onToggleSelectAllFiltered,
  onClearSelection,
  onExportSelected,
}: AccountsToolbarProps) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex w-full items-center">
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            type="text"
            className="input-swiss w-full uppercase"
            placeholder={t('accounts.search_placeholder')}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'auth-file', 'api-key'] as const).map((source) => (
              <button
                key={source}
                onClick={() => onSourceFilterChange(source)}
                className={`btn-swiss !px-3 !py-2 !text-[9px] ${
                  sourceFilter === source ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''
                }`}
              >
                {source === 'all'
                  ? t('accounts.filter_all')
                  : source === 'auth-file'
                    ? t('accounts.source_auth_file')
                    : t('accounts.source_api_key')}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end">
            <button onClick={onToggleSelectionMode} className="btn-swiss !px-3 !py-2 !text-[9px]">
              {isSelectionMode ? t('accounts.unselect_all') : t('accounts.selection_mode')}
            </button>
          </div>
        </div>
        {isSelectionMode ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-color)] pt-4">
            <button onClick={onToggleSelectAllFiltered} className="btn-swiss !px-3 !py-2 !text-[9px]">
              {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
            </button>
            <button onClick={onClearSelection} className="btn-swiss !px-3 !py-2 !text-[9px]" disabled={selectedAccountCount === 0}>
              {t('accounts.clear_selection')}
            </button>
            <button onClick={onExportSelected} className="btn-swiss !px-3 !py-2 !text-[9px]" disabled={selectedAccountCount === 0}>
              {t('accounts.export_selected')}
            </button>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {selectedAccountCount} {t('accounts.selected_count')}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
