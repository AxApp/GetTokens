import type { ReactNode } from 'react';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroup, AccountRecord, Translator } from '../model/types';

interface AccountGroupSectionViewProps {
  t: Translator;
  group: AccountGroup;
  displayMode: AccountListDisplayMode;
  renderAccount: (account: AccountRecord) => ReactNode;
  emptyContent?: ReactNode;
}

export default function AccountGroupSectionView({
  t,
  group,
  displayMode,
  renderAccount,
  emptyContent = null,
}: AccountGroupSectionViewProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <h3 className="text-[length:var(--font-size-ui-6xl)] font-black uppercase leading-none tracking-[-0.04em] text-[var(--text-primary)]">
          {group.label}
        </h3>
        <p className="mb-1 text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {group.accounts.length} {t('accounts.plan_group_meta')}
        </p>
      </div>

      {group.accounts.length === 0 && emptyContent ? (
        emptyContent
      ) : (
        <div
          className={
            displayMode === 'list'
              ? 'grid grid-cols-1 gap-3'
              : displayMode === 'compact'
                ? 'account-card-grid-compact grid gap-5'
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
