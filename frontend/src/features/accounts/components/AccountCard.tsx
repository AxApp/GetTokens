import { useEffect, useRef, useState } from 'react';
import { Copy, FileText, MoreVertical, Power, Terminal, Trash2 } from 'lucide-react';
import { buildQuotaDisplay, extractBilling, supportsQuota } from '../model/accountQuota';
import { buildAccountCardContentText, buildAccountCardCopyText } from '../model/accountCardActions';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import {
  isCodexReauthEligible,
  resolveAccountOperationalState,
  resolveAccountStatusTone,
  resolveAccountFailureReason,
  resolveAccountPrimaryLabel,
} from '../model/accountPresentation';
import type { AccountRecord, CodexQuotaState, Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import { rateLimitStateTone, type RateLimitState } from '../model/rateLimit';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import { canToggleRotationAccountDisabled } from '../model/accountRotation';
import AttributionCard, { type AttributionCardBadge } from './AttributionCard';

interface AccountCardProps {
  t: Translator;
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  minHeight?: number;
  density?: AccountListDisplayMode;
  ready: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  isPendingDelete: boolean;
  isOAuthPending: boolean;
  isStatusPending: boolean;
  onToggleSelection: (accountID: string) => void;
  onOpenDetails: (account: AccountRecord) => void;
  onRefreshQuota: (account: AccountRecord) => void;
  onStartReauth: (account: AccountRecord) => void;
  onToggleDisabled: (account: AccountRecord) => void;
  onRequestDelete: (accountID: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (account: AccountRecord) => void;
  downloadAuthFile?: (accountName: string) => Promise<{ contentBase64: string }>;
  localCliActions?: ReadonlyArray<AccountCardLocalCliAction>;
  defaultActionMenuOpen?: boolean;
}

export interface AccountCardLocalCliAction {
  id: string;
  label: string;
  detail?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: (account: AccountRecord) => void;
}

export default function AccountCard({
  t,
  account,
  quotaState,
  usageSummary,
  rateLimitStatus,
  minHeight,
  density = 'full',
  ready,
  isSelectionMode,
  isSelected,
  isPendingDelete,
  isOAuthPending,
  isStatusPending,
  onToggleSelection,
  onOpenDetails,
  onRefreshQuota,
  onStartReauth,
  onToggleDisabled,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  downloadAuthFile,
  localCliActions = [],
  defaultActionMenuOpen = false,
}: AccountCardProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(defaultActionMenuOpen);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const quotaDisplay = buildQuotaDisplay(account, quotaState);
  const billing = quotaState?.quota ? extractBilling(quotaState.quota) : undefined;
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
  const guardTone = rateLimitStateTone(rateLimitStatus);
  const cardTone =
    guardTone === 'critical'
      ? 'critical'
      : statusTone === 'positive'
        ? 'positive'
        : statusTone === 'warning' || guardTone === 'warning'
          ? 'warning'
          : 'critical';
  const badges: AttributionCardBadge[] = [];
  const formats = account.supportedFormats && account.supportedFormats.length > 0
    ? account.supportedFormats
    : ['anthropic'];
  for (const fmt of formats) {
    badges.push({
      label: fmt === 'anthropic'
        ? 'ANTHROPIC'
        : fmt === 'openai_chat'
          ? 'OPENAI CHAT'
          : fmt === 'openai_responses'
            ? 'OPENAI RESPONSES'
            : fmt === 'gemini_native'
              ? 'GEMINI'
              : fmt.toUpperCase(),
    });
  }
  if (account.disabled) {
    badges.push({ label: t('accounts.rotation_disabled_badge'), tone: 'critical' });
  }
  if (rateLimitStatus?.blocked) {
    badges.push({ label: rateLimitStatus.blockReason || 'ROUTE GUARD', tone: 'critical' });
  }
  const canToggleDisabled = canToggleRotationAccountDisabled(account);

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

    if (downloadAuthFile) {
      try {
        const response = await downloadAuthFile(account.name);
        const rawContent = decodeBase64Utf8(response.contentBase64);
        await copyText(buildAccountCardContentText(account, parseMaybeJSON(rawContent)));
        return;
      } catch {
        // Fall back to the card summary when the runtime auth file is unavailable.
      }
    }
    await copyText(buildAccountCardContentText(account));
  }

  const actionColumnClass = supportsQuota(account)
    ? canReauth
      ? 'account-card-action-grid-3'
      : 'account-card-action-grid-2'
    : canReauth
      ? 'account-card-action-grid-2'
      : 'account-card-action-grid-1';

  return (
    <AttributionCard
      t={t}
      title={primaryLabel}
      subtitle={account.baseUrl || ''}
      eyebrow={operationalState.label}
      failureReason={failureReason}
      badges={badges}
      usageSummary={usageSummary}
      quotaDisplay={quotaDisplay}
      billing={billing}
      rateLimitStatus={rateLimitStatus}
      tone={cardTone}
      density={density}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      interactive={!isSelectionMode && !isPendingDelete}
      topActions={
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isSelectionMode ? (
            <label className="flex cursor-pointer items-center gap-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  >
                    <Copy size={14} strokeWidth={3} />
                    {t('common.copy')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyAccountContent()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  >
                    <FileText size={14} strokeWidth={3} />
                    {t('common.copy_content')}
                  </button>
                  {localCliActions.length > 0 ? (
                    <>
                      <div className="my-1 border-t-2 border-dashed border-[var(--border-color)]" />
                      {localCliActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          role="menuitem"
                          disabled={action.disabled}
                          onClick={() => {
                            if (action.disabled) {
                              return;
                            }
                            setIsActionMenuOpen(false);
                            action.onSelect(account);
                          }}
                          title={action.disabledReason || action.detail || action.label}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Terminal size={14} strokeWidth={3} className="shrink-0" />
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </>
                  ) : null}
                  {canToggleDisabled ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        onToggleDisabled(account);
                      }}
                      disabled={!ready || isStatusPending}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] hover:bg-[var(--bg-surface)] disabled:cursor-wait disabled:opacity-50 ${
                        account.disabled ? 'text-[var(--text-primary)]' : 'text-[var(--color-status-warning)] dark:text-[var(--color-status-warning)]'
                      }`}
                    >
                      <Power size={14} strokeWidth={3} />
                      {isStatusPending ? t('common.loading') : account.disabled ? t('common.enable') : t('common.disable')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      onRequestDelete(account.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--color-status-danger)] hover:bg-[var(--bg-surface)]"
                  >
                    <Trash2 size={14} strokeWidth={3} />
                    {t('accounts.card_delete')}
                  </button>
                  {copyState !== 'idle' ? (
                    <div
                      className={`border-t border-dashed border-[var(--border-color)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
                        copyState === 'success' ? 'text-[var(--color-status-success)]' : 'text-[var(--color-status-danger)]'
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
      }
      footer={
        isPendingDelete ? (
          <div
            className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--border-color)] pt-3"
            data-account-card-ignore-click="true"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide text-[var(--color-status-danger)]">
              {t('common.confirm_delete')}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onCancelDelete} className="btn-swiss !px-3 !py-1 !text-[length:var(--font-size-ui-xs)]">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => onConfirmDelete(account)}
                className="btn-swiss !px-3 !py-1 !text-[length:var(--font-size-ui-xs)] !text-[var(--color-status-danger)]"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ) : density === 'list' ? undefined : (
          <div
            className={`account-card-action-grid grid gap-2 border-t border-dashed border-[var(--border-color)] pt-3 ${actionColumnClass}`}
            data-account-card-ignore-click="true"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => onOpenDetails(account)} className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]">
              {t('common.details')}
            </button>
            {supportsQuota(account) ? (
              <button
                type="button"
                onClick={() => onRefreshQuota(account)}
                className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                disabled={!ready || quotaState?.status === 'loading'}
              >
                {t('accounts.refresh_quota')}
              </button>
            ) : null}
            {canReauth ? (
              <button
                type="button"
                onClick={() => onStartReauth(account)}
                className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                disabled={isOAuthPending}
              >
                {isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth')}
              </button>
            ) : null}
          </div>
        )
      }
      onOpen={openDetails}
    />
  );
}
