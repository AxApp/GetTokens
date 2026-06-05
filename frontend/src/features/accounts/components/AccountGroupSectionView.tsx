import type { ReactNode } from 'react';
import { MoreVertical, Power, RefreshCw, SquareCheckBig } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroup, AccountRecord, Translator } from '../model/types';
import { resolveBulkQuotaRefreshTargets, resolveBulkSetDisabledTargets } from '../model/accountSelection';

interface AccountGroupSectionViewProps {
  t: Translator;
  group: AccountGroup;
  displayMode: AccountListDisplayMode;
  isSelectionMode?: boolean;
  selectedAccountIDSet?: ReadonlySet<string>;
  onToggleGroupSelection?: (accounts: AccountRecord[]) => void;
  onRefreshGroup?: (accounts: AccountRecord[]) => void;
  onSetGroupDisabled?: (accounts: AccountRecord[], nextDisabled: boolean) => void;
  renderAccount: (account: AccountRecord) => ReactNode;
  emptyContent?: ReactNode;
}

export default function AccountGroupSectionView({
  t,
  group,
  displayMode,
  isSelectionMode = false,
  selectedAccountIDSet,
  onToggleGroupSelection,
  onRefreshGroup,
  onSetGroupDisabled,
  renderAccount,
  emptyContent = null,
}: AccountGroupSectionViewProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasAccounts = group.accounts.length > 0;
  const allGroupSelected = hasAccounts && group.accounts.every((account) => selectedAccountIDSet?.has(account.id));
  const canRefreshGroup = resolveBulkQuotaRefreshTargets(group.accounts).targets.length > 0;
  const canEnableGroup = resolveBulkSetDisabledTargets(group.accounts, false).targets.length > 0;
  const canDisableGroup = resolveBulkSetDisabledTargets(group.accounts, true).targets.length > 0;
  const groupSelectionAction = isSelectionMode ? onToggleGroupSelection : undefined;

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

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <h3 className="text-[length:var(--font-size-ui-6xl)] font-black uppercase leading-none tracking-[-0.04em] text-[var(--text-primary)]">
          {group.label}
        </h3>
        <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
          <p className="text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {group.accounts.length} {t('accounts.plan_group_meta')}
          </p>
          {groupSelectionAction ? (
            <button
              type="button"
              aria-pressed={allGroupSelected}
              onClick={() => groupSelectionAction(group.accounts)}
              disabled={!hasAccounts}
              className="btn-swiss flex h-8 items-center gap-1.5 !px-2.5 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SquareCheckBig size={13} strokeWidth={3} />
              {allGroupSelected ? t('accounts.unselect_group') : t('accounts.select_group')}
            </button>
          ) : null}
          {onRefreshGroup ? (
            <button
              type="button"
              onClick={() => onRefreshGroup(group.accounts)}
              disabled={!canRefreshGroup}
              className="btn-swiss flex h-8 items-center gap-1.5 !px-2.5 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw size={13} strokeWidth={3} />
              {t('accounts.refresh_group')}
            </button>
          ) : null}
          {onSetGroupDisabled ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label={t('accounts.group_actions')}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="btn-swiss flex h-8 w-8 items-center justify-center !px-0 !py-0"
                title={t('accounts.group_actions')}
              >
                <MoreVertical size={14} strokeWidth={3} />
              </button>
              {isMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-2 w-44 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-[6px_6px_0_var(--shadow-color)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canEnableGroup}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSetGroupDisabled(group.accounts, false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Power size={14} strokeWidth={3} />
                    {t('accounts.enable_group')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canDisableGroup}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSetGroupDisabled(group.accounts, true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--color-status-danger)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Power size={14} strokeWidth={3} />
                    {t('accounts.disable_group')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {group.accounts.length === 0 && emptyContent ? (
        emptyContent
      ) : (
        <div
          className={
            displayMode === 'list'
              ? 'grid grid-cols-1 gap-3'
              : 'account-card-grid-full grid gap-8'
          }
          data-plan-group-grid={group.id}
        >
          {group.accounts.map((account) => renderAccount(account))}
        </div>
      )}
    </section>
  );
}
