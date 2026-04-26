import { groupProviderLabel } from './accountPresentation';
import type { AccountGroup, AccountRecord, CodexQuotaState, Translator } from './types';
import AccountCard from './AccountCard';

interface AccountGroupSectionProps {
  t: Translator;
  group: AccountGroup;
  groupCardHeight?: number;
  codexQuotaByName: Record<string, CodexQuotaState>;
  ready: boolean;
  isSelectionMode: boolean;
  selectedAccountIDSet: Set<string>;
  pendingDeleteID: string | null;
  onToggleSelection: (accountID: string) => void;
  onOpenDetails: (account: AccountRecord) => void;
  onRefreshQuota: (account: AccountRecord) => void;
  onRequestDelete: (accountID: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (account: AccountRecord) => void;
}

export default function AccountGroupSection({
  t,
  group,
  groupCardHeight,
  codexQuotaByName,
  ready,
  isSelectionMode,
  selectedAccountIDSet,
  pendingDeleteID,
  onToggleSelection,
  onOpenDetails,
  onRefreshQuota,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: AccountGroupSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <div className="space-y-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {groupProviderLabel(group.accounts)}
          </span>
          <h3 className="text-[28px] font-black uppercase leading-none tracking-[-0.04em] text-[var(--text-primary)]">
            {group.label}
          </h3>
        </div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {group.accounts.length} {t('accounts.plan_group_meta')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3" data-plan-group-grid={group.id}>
        {group.accounts.map((account) => (
          <AccountCard
            key={account.id}
            t={t}
            account={account}
            quotaState={codexQuotaByName[account.quotaKey || '']}
            minHeight={groupCardHeight}
            ready={ready}
            isSelectionMode={isSelectionMode}
            isSelected={selectedAccountIDSet.has(account.id)}
            isPendingDelete={pendingDeleteID === account.id}
            onToggleSelection={onToggleSelection}
            onOpenDetails={onOpenDetails}
            onRefreshQuota={onRefreshQuota}
            onRequestDelete={onRequestDelete}
            onCancelDelete={onCancelDelete}
            onConfirmDelete={onConfirmDelete}
          />
        ))}
      </div>
    </section>
  );
}
