import { type ReactNode, useEffect, useRef, useState } from 'react';
import SearchInput from '../../../components/ui/SearchInput';
import { defaultAccountsFilterState } from '../model/accountFilters';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountsFilterSource, AccountsFilterState, Translator } from '../model/types';

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

  function setSourceFilter(source: AccountsFilterSource) {
    onFiltersChange({
      ...filters,
      source,
    });
  }

  function toggleFilter(key: 'requestableOnly' | 'disabledOnly' | 'hasBalance' | 'hasLongestQuota' | 'errorsOnly') {
    onFiltersChange({
      ...filters,
      [key]: !filters[key],
    });
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex w-full items-center">
          <SearchInput
            value={searchTerm}
            onChange={onSearchChange}
            placeholder={t('accounts.search_placeholder')}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setIsMenuOpen((prev) => !prev)} className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]">
              {buildToolbarFilterLabel(t, filters)}
            </button>
            {isMenuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-3 flex min-w-[320px] flex-col gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[8px_8px_0_var(--shadow-color)]">
                <div className="space-y-2">
                  <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_source')}
                  </p>
                  <div className="grid h-10 grid-cols-3 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
                    <FilterOptionButton active={filters.source === 'all'} bordered onClick={() => setSourceFilter('all')}>
                      {t('accounts.filter_all')}
                    </FilterOptionButton>
                    <FilterOptionButton active={filters.source === 'auth-file'} bordered onClick={() => setSourceFilter('auth-file')}>
                      {t('accounts.source_auth_file')}
                    </FilterOptionButton>
                    <FilterOptionButton active={filters.source === 'api-key'} onClick={() => setSourceFilter('api-key')}>
                      {t('accounts.source_api_key')}
                    </FilterOptionButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.filter_group_status')}
                  </p>
                  <FilterCheckbox checked={filters.requestableOnly} onChange={() => toggleFilter('requestableOnly')}>
                    {t('accounts.filter_requestable')}
                  </FilterCheckbox>
                  <FilterCheckbox checked={filters.disabledOnly} onChange={() => toggleFilter('disabledOnly')}>
                    {t('accounts.filter_disabled_only')}
                  </FilterCheckbox>
                  <FilterCheckbox checked={filters.errorsOnly} onChange={() => toggleFilter('errorsOnly')}>
                    {t('accounts.errors_only')}
                  </FilterCheckbox>
                  <FilterCheckbox checked={filters.hasBalance} onChange={() => toggleFilter('hasBalance')}>
                    {t('accounts.filter_has_balance')}
                  </FilterCheckbox>
                  <FilterCheckbox checked={filters.hasLongestQuota} onChange={() => toggleFilter('hasLongestQuota')}>
                    {t('accounts.filter_longest_quota')}
                  </FilterCheckbox>
                </div>
                <div className="flex justify-end border-t border-dashed border-[var(--border-color)] pt-3">
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...defaultAccountsFilterState })}
                    className="btn-swiss h-8 !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
                  >
                    {t('accounts.filter_reset')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-stretch justify-end gap-2">
            <div
              className="grid h-10 shrink-0 grid-cols-3 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
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
            <button onClick={onToggleSelectionMode} className="btn-swiss h-10 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]">
              {isSelectionMode ? t('accounts.unselect_all') : t('accounts.selection_mode')}
            </button>
          </div>
        </div>
        {isSelectionMode ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-color)] pt-4">
            <button onClick={onToggleSelectAllFiltered} className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]">
              {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
            </button>
            <button onClick={onClearSelection} className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]" disabled={selectedAccountCount === 0}>
              {t('accounts.clear_selection')}
            </button>
            <button onClick={onExportSelected} className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]" disabled={selectedAccountCount === 0}>
              {t('accounts.export_selected')}
            </button>
            <span className="ml-auto text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
      className={`h-full min-h-0 px-3 text-[length:var(--font-size-ui-xs)] font-black uppercase leading-none tracking-[0.12em] ${
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

function FilterOptionButton({
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
      className={`h-full min-h-0 px-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase leading-none tracking-[0.1em] ${
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

function FilterCheckbox({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-[var(--text-primary)]"
      />
      {children}
    </label>
  );
}

function buildToolbarFilterLabel(t: Translator, filters: AccountsFilterState) {
  const parts: string[] = [];

  if (filters.source === 'auth-file') {
    parts.push(t('accounts.source_auth_file'));
  }
  if (filters.source === 'api-key') {
    parts.push(t('accounts.source_api_key'));
  }
  if (filters.requestableOnly) {
    parts.push(t('accounts.filter_requestable'));
  }
  if (filters.disabledOnly) {
    parts.push(t('accounts.filter_disabled_only'));
  }
  if (filters.hasBalance) {
    parts.push(t('accounts.filter_has_balance'));
  }
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
