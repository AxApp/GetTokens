import type { AccountGroup, AccountRecord, CodexQuotaState, Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import { shouldEqualizeAccountCardDisplayMode } from '../model/accountCardLayout';
import AccountCard, { type AccountCardLocalCliAction } from './AccountCard';
import AccountGroupSectionView from './AccountGroupSectionView';

interface AccountGroupSectionProps {
  t: Translator;
  group: AccountGroup;
  accountCardHeights: Record<string, number>;
  codexQuotaByName: Record<string, CodexQuotaState>;
  accountUsageByID: Record<string, AccountUsageSummary>;
  accountRateLimitByID: Record<string, RateLimitState>;
  ready: boolean;
  isSelectionMode: boolean;
  selectedAccountIDSet: Set<string>;
  pendingDeleteID: string | null;
  oauthPendingAccountID: string | null;
  pendingStatusAccountID: string | null;
  displayMode: AccountListDisplayMode;
  onToggleSelection: (accountID: string) => void;
  onToggleGroupSelection?: (accounts: AccountRecord[]) => void;
  onRefreshGroup?: (accounts: AccountRecord[]) => void;
  onSetGroupDisabled?: (accounts: AccountRecord[], nextDisabled: boolean) => void;
  onOpenDetails: (account: AccountRecord) => void;
  onRefreshQuota: (account: AccountRecord) => void;
  onStartReauth: (account: AccountRecord) => void;
  onToggleDisabled: (account: AccountRecord) => void;
  onRequestDelete: (accountID: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (account: AccountRecord) => void;
  downloadAuthFile?: (accountName: string) => Promise<{ contentBase64: string }>;
  resolveLocalCliActions?: (account: AccountRecord) => ReadonlyArray<AccountCardLocalCliAction>;
}

export default function AccountGroupSection({
  t,
  group,
  accountCardHeights,
  codexQuotaByName,
  accountUsageByID,
  accountRateLimitByID,
  ready,
  isSelectionMode,
  selectedAccountIDSet,
  pendingDeleteID,
  oauthPendingAccountID,
  pendingStatusAccountID,
  displayMode,
  onToggleSelection,
  onToggleGroupSelection,
  onRefreshGroup,
  onSetGroupDisabled,
  onOpenDetails,
  onRefreshQuota,
  onStartReauth,
  onToggleDisabled,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  downloadAuthFile,
  resolveLocalCliActions,
}: AccountGroupSectionProps) {
  return (
    <AccountGroupSectionView
      t={t}
      group={group}
      displayMode={displayMode}
      isSelectionMode={isSelectionMode}
      selectedAccountIDSet={selectedAccountIDSet}
      onToggleGroupSelection={onToggleGroupSelection}
      onRefreshGroup={onRefreshGroup}
      onSetGroupDisabled={onSetGroupDisabled}
      renderAccount={(account) => (
        <AccountCard
          key={account.id}
          t={t}
          account={account}
          quotaState={codexQuotaByName[account.quotaKey || '']}
          usageSummary={accountUsageByID[account.id]}
          rateLimitStatus={accountRateLimitByID[account.id]}
          minHeight={
            shouldEqualizeAccountCardDisplayMode(displayMode)
              ? accountCardHeights[account.id]
              : undefined
          }
          density={displayMode}
          ready={ready}
          isSelectionMode={isSelectionMode}
          isSelected={selectedAccountIDSet.has(account.id)}
          isPendingDelete={pendingDeleteID === account.id}
          isOAuthPending={oauthPendingAccountID === account.id}
          isStatusPending={pendingStatusAccountID === account.id}
          onToggleSelection={onToggleSelection}
          onOpenDetails={onOpenDetails}
          onRefreshQuota={onRefreshQuota}
          onStartReauth={onStartReauth}
          onToggleDisabled={onToggleDisabled}
          onRequestDelete={onRequestDelete}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          downloadAuthFile={downloadAuthFile}
          localCliActions={resolveLocalCliActions?.(account) || []}
        />
      )}
    />
  );
}
