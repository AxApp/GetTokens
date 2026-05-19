import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountsFilterState, Translator } from '../model/types';

interface AccountsToolbarProps {
  t: Translator;
  searchTerm: string;
  filters: AccountsFilterState;
  isSelectionMode: boolean;
  allFilteredSelected: boolean;
  selectedAccountCount: number;
  displayMode: AccountListDisplayMode;
  onSearchChange: (value: string) => void;
  onFiltersChange: (value: AccountsFilterState) => void;
  onDisplayModeChange: (value: AccountListDisplayMode) => void;
  onToggleSelectionMode: () => void;
  onToggleSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onExportSelected: () => void;
  initialFiltersMenuOpen?: boolean;
}

export default function AccountsToolbar({
  t,
  searchTerm,
  filters,
  isSelectionMode,
  allFilteredSelected,
  selectedAccountCount,
  displayMode,
  onSearchChange,
  onFiltersChange,
  onDisplayModeChange,
  onToggleSelectionMode,
  onToggleSelectAllFiltered,
  onClearSelection,
  onExportSelected,
  initialFiltersMenuOpen = false,
}: AccountsToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(initialFiltersMenuOpen);
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
            <button onClick={() => setIsMenuOpen((prev) => !prev)} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
              {buildToolbarFilterLabel(t, filters)}
            </button>
            {isMenuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-3 flex min-w-[260px] flex-col gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[8px_8px_0_var(--shadow-color)]">
                <div className="space-y-2">
                  <p className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_status')}
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={filters.hasLongestQuota}
                      onChange={() => toggleFilter('hasLongestQuota')}
                      className="h-3.5 w-3.5 accent-[var(--text-primary)]"
                    />
                    {t('accounts.filter_longest_quota')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              className="grid shrink-0 grid-cols-3 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
              data-account-card-ignore-click="true"
            >
              <DisplayModeButton active={displayMode === 'full'} bordered onClick={() => onDisplayModeChange('full')}>
                {t('accounts.display_mode_full')}
              </DisplayModeButton>
              <DisplayModeButton active={displayMode === 'compact'} bordered onClick={() => onDisplayModeChange('compact')}>
                {t('accounts.display_mode_compact')}
              </DisplayModeButton>
              <DisplayModeButton active={displayMode === 'list'} onClick={() => onDisplayModeChange('list')}>
                {t('accounts.display_mode_list')}
              </DisplayModeButton>
            </div>
            <button onClick={onToggleSelectionMode} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
              {isSelectionMode ? t('accounts.unselect_all') : t('accounts.selection_mode')}
            </button>
          </div>
        </div>
        {isSelectionMode ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-color)] pt-4">
            <button onClick={onToggleSelectAllFiltered} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]">
              {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
            </button>
            <button onClick={onClearSelection} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]" disabled={selectedAccountCount === 0}>
              {t('accounts.clear_selection')}
            </button>
            <button onClick={onExportSelected} className="btn-swiss !px-3 !py-2 !text-[0.5625rem]" disabled={selectedAccountCount === 0}>
              {t('accounts.export_selected')}
            </button>
            <span className="ml-auto text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {selectedAccountCount} {t('accounts.selected_count')}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DisplayModeButton({
  active,
  bordered = false,
  children,
  onClick,
}: {
  active: boolean;
  bordered?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 px-3 text-[0.5625rem] font-black uppercase tracking-[0.12em] ${
        bordered ? 'border-r border-[var(--border-color)]' : ''
      } ${
        active
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

function buildToolbarFilterLabel(t: Translator, filters: AccountsFilterState) {
  const parts: string[] = [];

  if (filters.hasLongestQuota) {
    parts.push(t('accounts.filter_longest_quota'));
  }
  if (filters.errorsOnly) {
    parts.push(t('accounts.errors_only'));
  }

  if (parts.length === 0) {
    return t('accounts.display_filters');
  }
  return `${t('accounts.display_filters')} · ${parts.join(' · ')}`;
}
