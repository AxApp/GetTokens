import { buildQuotaDisplay, formatQuotaResetDisplayWithUnix, formatQuotaResetRelative, supportsQuota } from '../model/accountQuota';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';
import { isCodexReauthEligible, resolveAccountFailureReason, resolveAccountPrimaryLabel } from '../model/accountPresentation';
import type { AccountRecord, CodexQuotaState, QuotaDisplay, Translator } from '../model/types';
import AccountCardSkeleton from './AccountCardSkeleton';

interface AccountCardProps {
  t: Translator;
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  minHeight?: number;
  ready: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  isPendingDelete: boolean;
  isOAuthPending: boolean;
  onToggleSelection: (accountID: string) => void;
  onOpenDetails: (account: AccountRecord) => void;
  onRefreshQuota: (account: AccountRecord) => void;
  onStartReauth: (account: AccountRecord) => void;
  onRequestDelete: (accountID: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (account: AccountRecord) => void;
}

export default function AccountCard({
  t,
  account,
  quotaState,
  minHeight,
  ready,
  isSelectionMode,
  isSelected,
  isPendingDelete,
  isOAuthPending,
  onToggleSelection,
  onOpenDetails,
  onRefreshQuota,
  onStartReauth,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: AccountCardProps) {
  const quotaDisplay = buildQuotaDisplay(account, quotaState);
  const primaryLabel = resolveAccountPrimaryLabel(account);
  const failureReason = resolveAccountFailureReason(account);
  const canReauth = isCodexReauthEligible(account);

  function openDetails() {
    if (isSelectionMode || isPendingDelete) {
      return;
    }
    onOpenDetails(account);
  }

  if (quotaDisplay.status === 'loading') {
    return <AccountCardSkeleton />;
  }

  return (
    <div
      data-account-card
      className={`card-swiss flex h-full flex-col bg-[var(--bg-main)] p-5 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px] ${
        isSelectionMode || isPendingDelete ? '' : 'cursor-pointer'
      }`}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      onClick={(event) => {
        if (!shouldOpenAccountDetailsFromTarget(event.target, event.currentTarget)) {
          return;
        }
        openDetails();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        if (!shouldOpenAccountDetailsFromTarget(event.target, event.currentTarget)) {
          return;
        }
        event.preventDefault();
        openDetails();
      }}
      role="button"
      tabIndex={isSelectionMode || isPendingDelete ? -1 : 0}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="flex items-center gap-2 break-all text-[12px] font-black uppercase leading-snug tracking-[0.08em] text-[var(--text-primary)]">
            <div
              title={account.localOnly ? t('accounts.status_local') : account.status}
              className={`h-2 w-2 shrink-0 ${
                (account.localOnly ? 'LOCAL' : account.status).toUpperCase() === 'ACTIVE'
                  ? 'bg-green-500'
                  : (account.localOnly ? 'LOCAL' : account.status).toUpperCase() === 'DISABLED'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
            <span className={account.credentialSource === 'auth-file' && account.email ? 'normal-case tracking-normal' : ''}>
              {primaryLabel}
            </span>
          </h3>
          {failureReason ? (
            <div className="break-words text-[10px] font-bold leading-relaxed text-red-500" title={failureReason}>
              {failureReason}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isSelectionMode ? (
            <label className="flex cursor-pointer items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelection(account.id)}
                className="h-3.5 w-3.5 accent-[var(--text-primary)]"
              />
              {t('accounts.select_account')}
            </label>
          ) : null}
        </div>
      </div>

      {quotaDisplay.windows.length > 0 ? <QuotaWindows t={t} quotaDisplay={quotaDisplay} /> : null}

      <div className="mt-auto">
        {isPendingDelete ? (
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--border-color)] pt-3">
            <div className="shrink-0 text-[9px] font-black uppercase tracking-wide text-red-500">
              {t('common.confirm_delete')}
            </div>
            <div className="flex gap-2">
              <button onClick={onCancelDelete} className="btn-swiss !px-3 !py-1 !text-[9px]">
                {t('common.cancel')}
              </button>
              <button onClick={() => onConfirmDelete(account)} className="btn-swiss !px-3 !py-1 !text-[9px] !text-red-500">
                {t('common.delete')}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-2 border-t border-dashed border-[var(--border-color)] pt-3 ${
              supportsQuota(account) ? (canReauth ? 'grid-cols-4' : 'grid-cols-3') : canReauth ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            <button onClick={() => onOpenDetails(account)} className="btn-swiss !py-1.5 !text-[9px]">
              {t('common.details')}
            </button>
            {supportsQuota(account) ? (
              <button
                onClick={() => onRefreshQuota(account)}
                className="btn-swiss !py-1.5 !text-[9px]"
                disabled={!ready || quotaState?.status === 'loading'}
              >
                {t('accounts.refresh_quota')}
              </button>
            ) : null}
            {canReauth ? (
              <button
                onClick={() => onStartReauth(account)}
                className="btn-swiss !py-1.5 !text-[9px]"
                disabled={isOAuthPending}
              >
                {isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth')}
              </button>
            ) : null}
            <button onClick={() => onRequestDelete(account.id)} className="btn-swiss !py-1.5 !text-[9px] !text-red-500">
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuotaWindows({ t, quotaDisplay }: { t: Translator; quotaDisplay: QuotaDisplay }) {
  return (
    <div className="mb-4 space-y-3 border-t border-dashed border-[var(--border-color)] pt-4">
      {quotaDisplay.windows.map((window) => (
        <div
          key={window.id}
          className="space-y-2.5 border-b border-dashed border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0"
        >
          <div className="flex items-end justify-between gap-3 text-[8px] font-black uppercase">
            <span className="tracking-[0.2em] text-[var(--text-muted)]">{window.label}</span>
            <span className="text-green-600">
              {t('accounts.quota_remaining')} {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
            </span>
          </div>
          <div
            className={`relative h-6 w-full overflow-hidden ${quotaDisplay.status === 'loading' ? 'animate-pulse' : ''}`}
          >
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--border-color) 0 8px, transparent 8px 12px)',
                backgroundSize: '12px 100%',
                backgroundRepeat: 'repeat-x',
              }}
            />
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width:
                  window.remainingPercent === null
                    ? quotaDisplay.status === 'loading'
                      ? '40%'
                      : '0%'
                    : `${window.remainingPercent}%`,
                backgroundImage:
                  'linear-gradient(to right, rgb(22 163 74) 0 8px, transparent 8px 12px)',
                backgroundSize: '12px 100%',
                backgroundRepeat: 'repeat-x',
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-[8px] font-black uppercase tracking-[0.12em]">
            <span className="text-[var(--text-muted)]">{t('accounts.quota_reset')}</span>
            <div
              className="cursor-help text-right text-[var(--text-primary)]"
              title={formatQuotaResetDisplayWithUnix(window.resetLabel, window.resetAtUnix)}
            >
              {formatQuotaResetRelative(window.resetLabel, window.resetAtUnix)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
