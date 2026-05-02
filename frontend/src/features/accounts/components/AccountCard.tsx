import { useEffect, useRef, useState } from 'react';
import { Copy, FileText, MoreVertical, Trash2 } from 'lucide-react';
import { DownloadAuthFile } from '../../../../wailsjs/go/main/App';
import { buildQuotaDisplay, formatQuotaResetDisplayWithUnix, formatQuotaResetRelative, supportsQuota } from '../model/accountQuota';
import { buildAccountCardContentText, buildAccountCardCopyText } from '../model/accountCardActions';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';
import {
  isCodexReauthEligible,
  resolveAccountOperationalState,
  resolveAccountStatusTone,
  resolveAccountFailureReason,
  resolveAccountPrimaryLabel,
} from '../model/accountPresentation';
import type { AccountRecord, CodexQuotaState, QuotaDisplay, Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import AccountHealthBar from './AccountHealthBar';
import AccountCardSkeleton from './AccountCardSkeleton';

interface AccountCardProps {
  t: Translator;
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
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
  usageSummary,
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
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const quotaDisplay = buildQuotaDisplay(account, quotaState);
  const primaryLabel = resolveAccountPrimaryLabel(account);
  const failureReason = resolveAccountFailureReason(account);
  const canReauth = isCodexReauthEligible(account);
  const operationalState = resolveAccountOperationalState(account, usageSummary, quotaDisplay, t);
  const statusTone =
    operationalState.tone === 'positive'
      ? 'positive'
      : operationalState.tone === 'warning'
        ? 'warning'
        : resolveAccountStatusTone(account);

  function openDetails() {
    if (isSelectionMode || isPendingDelete) {
      return;
    }
    onOpenDetails(account);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsActionMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }

    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      copyResetTimerRef.current = null;
    }, 1600);
  }

  async function copyAccountContent() {
    if (account.credentialSource !== 'auth-file' || !account.name) {
      await copyText(buildAccountCardContentText(account));
      return;
    }

    try {
      const response = await DownloadAuthFile(account.name);
      const rawContent = decodeBase64Utf8(response.contentBase64);
      await copyText(buildAccountCardContentText(account, parseMaybeJSON(rawContent)));
    } catch {
      await copyText(buildAccountCardContentText(account));
    }
  }

  const actionColumnClass = supportsQuota(account)
    ? canReauth
      ? 'grid-cols-3'
      : 'grid-cols-2'
    : canReauth
      ? 'grid-cols-2'
      : 'grid-cols-1';

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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-3">
          <h3 className="flex items-center gap-2 break-all text-[0.75rem] font-black uppercase leading-snug tracking-[0.08em] text-[var(--text-primary)]">
            <div
              title={operationalState.label}
              className={`h-2 w-2 shrink-0 ${
                statusTone === 'positive' ? 'bg-green-500' : statusTone === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
            <span className={account.credentialSource === 'auth-file' && account.email ? 'normal-case tracking-normal' : ''}>
              {primaryLabel}
            </span>
          </h3>
          {account.baseUrl ? (
            <div className="break-all font-mono text-[0.5625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {account.baseUrl}
            </div>
          ) : null}
          {failureReason ? (
            <div className="break-words text-[0.625rem] font-bold leading-relaxed text-red-500" title={failureReason}>
              {failureReason}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isSelectionMode ? (
            <label className="flex cursor-pointer items-center gap-2 text-[0.5625rem] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelection(account.id)}
                className="h-3.5 w-3.5 accent-[var(--text-primary)]"
              />
              {t('accounts.select_account')}
            </label>
          ) : null}
          {!isSelectionMode && !isPendingDelete ? (
            <div ref={actionMenuRef} className="relative" data-account-card-ignore-click="true">
              <button
                type="button"
                aria-label={t('accounts.card_actions')}
                aria-haspopup="menu"
                aria-expanded={isActionMenuOpen}
                onClick={() => setIsActionMenuOpen((prev) => !prev)}
                className="btn-swiss flex h-8 w-8 items-center justify-center !px-0 !py-0"
                title={t('accounts.card_actions')}
              >
                <MoreVertical size={16} strokeWidth={3} />
              </button>
              {isActionMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-2 w-44 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-[6px_6px_0_var(--shadow-color)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyText(buildAccountCardCopyText(account))}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  >
                    <Copy size={14} strokeWidth={3} />
                    {t('common.copy')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyAccountContent()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  >
                    <FileText size={14} strokeWidth={3} />
                    {t('common.copy_content')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      onRequestDelete(account.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.08em] text-red-500 hover:bg-[var(--bg-surface)]"
                  >
                    <Trash2 size={14} strokeWidth={3} />
                    {t('accounts.card_delete')}
                  </button>
                  {copyState !== 'idle' ? (
                    <div
                      className={`border-t border-dashed border-[var(--border-color)] px-3 py-2 text-[0.5625rem] font-black uppercase tracking-[0.12em] ${
                        copyState === 'success' ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {copyState === 'success' ? t('accounts.copy_done') : t('accounts.copy_failed')}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {usageSummary?.hasData ? (
        <div className="mb-4 border-t border-dashed border-[var(--border-color)] pt-4">
          <div className="space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[0.5rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
              {t('accounts.recent_health')}
            </div>
            <AccountHealthBar summary={usageSummary} />
          </div>
        </div>
      ) : null}

      {quotaDisplay.windows.length > 0 ? <QuotaWindows t={t} quotaDisplay={quotaDisplay} /> : null}

      <div className="mt-auto">
        {isPendingDelete ? (
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--border-color)] pt-3">
            <div className="shrink-0 text-[0.5625rem] font-black uppercase tracking-wide text-red-500">
              {t('common.confirm_delete')}
            </div>
            <div className="flex gap-2">
              <button onClick={onCancelDelete} className="btn-swiss !px-3 !py-1 !text-[0.5625rem]">
                {t('common.cancel')}
              </button>
              <button onClick={() => onConfirmDelete(account)} className="btn-swiss !px-3 !py-1 !text-[0.5625rem] !text-red-500">
                {t('common.delete')}
              </button>
            </div>
          </div>
        ) : (
          <div className={`grid gap-2 border-t border-dashed border-[var(--border-color)] pt-3 ${actionColumnClass}`}>
            <button onClick={() => onOpenDetails(account)} className="btn-swiss !py-1.5 !text-[0.5625rem]">
              {t('common.details')}
            </button>
            {supportsQuota(account) ? (
              <button
                onClick={() => onRefreshQuota(account)}
                className="btn-swiss !py-1.5 !text-[0.5625rem]"
                disabled={!ready || quotaState?.status === 'loading'}
              >
                {t('accounts.refresh_quota')}
              </button>
            ) : null}
            {canReauth ? (
              <button
                onClick={() => onStartReauth(account)}
                className="btn-swiss !py-1.5 !text-[0.5625rem]"
                disabled={isOAuthPending}
              >
                {isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth')}
              </button>
            ) : null}
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
          <div className="flex items-end justify-between gap-3 text-[0.5rem] font-black uppercase">
            <span className="tracking-[0.2em] text-[var(--text-muted)]">{window.label}</span>
            <span className="text-green-600">
              {t('accounts.quota_remaining')} {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
            </span>
          </div>
          <div className="relative h-6 w-full overflow-hidden">
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
                width: window.remainingPercent === null ? '0%' : `${window.remainingPercent}%`,
                backgroundImage:
                  'linear-gradient(to right, rgb(22 163 74) 0 8px, transparent 8px 12px)',
                backgroundSize: '12px 100%',
                backgroundRepeat: 'repeat-x',
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-[0.5rem] font-black uppercase tracking-[0.12em]">
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
