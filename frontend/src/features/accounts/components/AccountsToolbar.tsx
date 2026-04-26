import { useEffect, useRef, useState } from 'react';
import type { AccountsFilterState, AccountsFilterSource, Translator } from '../model/types';

interface AccountsToolbarProps {
  t: Translator;
  searchTerm: string;
  filters: AccountsFilterState;
  isSelectionMode: boolean;
  allFilteredSelected: boolean;
  selectedAccountCount: number;
  onSearchChange: (value: string) => void;
  onFiltersChange: (value: AccountsFilterState) => void;
  onToggleSelectionMode: () => void;
  onToggleSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onExportSelected: () => void;
}

export default function AccountsToolbar({
  t,
  searchTerm,
  filters,
  isSelectionMode,
  allFilteredSelected,
  selectedAccountCount,
  onSearchChange,
  onFiltersChange,
  onToggleSelectionMode,
  onToggleSelectAllFiltered,
  onClearSelection,
  onExportSelected,
}: AccountsToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isMenuOpen]);

  function updateSource(source: AccountsFilterSource) {
    onFiltersChange({
      ...filters,
      source,
    });
  }

  function toggleFilter(key: 'hasLongestQuota' | 'errorsOnly') {
    onFiltersChange({
      ...filters,
      [key]: !filters[key],
    });
  }

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
          <div ref={menuRef} className="relative">
            <button onClick={() => setIsMenuOpen((prev) => !prev)} className="btn-swiss !px-3 !py-2 !text-[9px]">
              {buildToolbarFilterLabel(t, filters)}
            </button>
            {isMenuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-3 flex min-w-[260px] flex-col gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[8px_8px_0_var(--shadow-color)]">
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_source')}
                  </p>
                  <div className="flex flex-col gap-2">
                    {(['all', 'auth-file', 'api-key'] as const).map((source) => (
                      <label
                        key={source}
                        className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
                      >
                        <input
                          type="radio"
                          name="accounts-source-filter"
                          checked={filters.source === source}
                          onChange={() => updateSource(source)}
                          className="h-3.5 w-3.5 accent-[var(--text-primary)]"
                        />
                        {source === 'all'
                          ? t('accounts.filter_all')
                          : source === 'auth-file'
                            ? t('accounts.source_auth_file')
                            : t('accounts.source_api_key')}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 border-t border-dashed border-[var(--border-color)] pt-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_status')}
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={filters.hasLongestQuota}
                      onChange={() => toggleFilter('hasLongestQuota')}
                      className="h-3.5 w-3.5 accent-[var(--text-primary)]"
                    />
                    {t('accounts.filter_longest_quota')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={filters.errorsOnly}
                      onChange={() => toggleFilter('errorsOnly')}
                      className="h-3.5 w-3.5 accent-[var(--text-primary)]"
                    />
                    {t('accounts.errors_only')}
                  </label>
                </div>
              </div>
            ) : null}
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

function buildToolbarFilterLabel(t: Translator, filters: AccountsFilterState) {
  const parts = [];

  if (filters.source === 'all') {
    parts.push(t('accounts.filter_all'));
  } else if (filters.source === 'auth-file') {
    parts.push(t('accounts.source_auth_file'));
  } else {
    parts.push(t('accounts.source_api_key'));
  }

  if (filters.hasLongestQuota) {
    parts.push(t('accounts.filter_longest_quota'));
  }
  if (filters.errorsOnly) {
    parts.push(t('accounts.errors_only'));
  }

  return `${t('accounts.display_filters')} · ${parts.join(' · ')}`;
}
