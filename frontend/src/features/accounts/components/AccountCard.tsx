import { useEffect, useRef, useState } from 'react';
import { FileText, MoreVertical, Power, RefreshCw, RotateCw, Terminal, Trash2 } from 'lucide-react';
import { buildQuotaBlockBadgeLabel, buildQuotaDisplay, extractBilling, hasQuotaEmptyBlock } from '../model/accountQuota';
import { buildAccountCardContentText } from '../model/accountCardActions';
import { writeAccountClipboardText } from '../model/accountClipboard';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import { buildAccountCardRefreshAction } from '../model/accountCardRefresh';
import {
  buildAccountAttributionBadges,
  isCodexAuthFile,
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
import { buildAccountDeleteOverlay } from './accountDeleteOverlay';

interface AccountCardProps {
  t: Translator;
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  usageRefreshing?: boolean;
  rateLimitStatus?: RateLimitState;
  rateLimitRefreshing?: boolean;
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
  extraBadges?: AttributionCardBadge[];
  eyebrowPrefix?: string;
  showDeleteAction?: boolean;
  showFooterActions?: boolean;
  showFooterReauthAction?: boolean;
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
  usageRefreshing = false,
  rateLimitStatus,
  rateLimitRefreshing = false,
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
  extraBadges = [],
  eyebrowPrefix = '',
  showDeleteAction = true,
  showFooterActions = true,
  showFooterReauthAction = true,
}: AccountCardProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(defaultActionMenuOpen);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const quotaDisplay = buildQuotaDisplay(account, quotaState);
  const billing = quotaState?.quota ? extractBilling(quotaState.quota) : undefined;
  const refreshAction = buildAccountCardRefreshAction({
    account,
    quotaState,
    usageRefreshing,
    rateLimitRefreshing,
  });
  const primaryLabel = resolveAccountPrimaryLabel(account);
  const failureReason = resolveAccountFailureReason(account);
  const canReauth = isCodexReauthEligible(account);
  const showFooterReauth = showFooterReauthAction && canReauth;
  const canMenuReauth = isCodexAuthFile(account);
  const operationalState = resolveAccountOperationalState(account, usageSummary, quotaDisplay, t);
  const statusTone =
    operationalState.tone === 'positive'
      ? 'positive'
      : operationalState.tone === 'warning'
        ? 'warning'
      : resolveAccountStatusTone(account);
  const guardTone = rateLimitStateTone(rateLimitStatus);
  const quotaBlocked = hasQuotaEmptyBlock(quotaDisplay);
  const cardTone =
    guardTone === 'critical' || quotaBlocked
      ? 'critical'
      : statusTone === 'positive'
        ? 'positive'
        : statusTone === 'warning' || guardTone === 'warning'
          ? 'warning'
          : 'critical';
  const badges: AttributionCardBadge[] = [...buildAccountAttributionBadges(account, quotaDisplay), ...extraBadges];
  if (account.disabled) {
    badges.push({ label: t('accounts.rotation_disabled_badge'), tone: 'critical' });
  }
  if (rateLimitStatus?.blocked) {
    badges.push({ label: rateLimitStatus.blockReason || 'ROUTE GUARD', tone: 'critical' });
  }
  const quotaBlockBadgeLabel = buildQuotaBlockBadgeLabel(quotaDisplay, t);
  if (quotaBlockBadgeLabel) {
    badges.push({ label: quotaBlockBadgeLabel, tone: 'critical' });
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
      await writeAccountClipboardText(value);
      setCopyState('success');
    } catch (error) {
      console.warn('Account card copy failed.', error);
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

  const deleteOverlay = isPendingDelete
    ? buildAccountDeleteOverlay({
        t,
        account,
        primaryLabel,
        density,
        onCancelDelete,
        onConfirmDelete,
      })
    : undefined;

  return (
    <AttributionCard
      t={t}
      title={primaryLabel}
      subtitle={account.baseUrl || ''}
      eyebrow={operationalState.label}
      eyebrowPrefix={eyebrowPrefix}
      failureReason={failureReason}
      badges={badges}
      usageSummary={usageSummary}
      usageRefreshing={usageRefreshing}
      quotaDisplay={quotaDisplay}
      billing={billing}
      rateLimitStatus={rateLimitStatus}
      rateLimitRefreshing={rateLimitRefreshing}
      tone={cardTone}
      density={density}
      cardID={account.id}
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      interactive={!isSelectionMode && !isPendingDelete}
      overlay={deleteOverlay}
      leadingAction={
        isSelectionMode ? (
          <label className="flex cursor-pointer items-center" data-account-card-ignore-click="true">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelection(account.id)}
              className="h-4 w-4 rounded accent-[var(--gt-accent-primary)]"
            />
          </label>
        ) : null
      }
      topActions={
        !isSelectionMode && !isPendingDelete ? (
          <div className="flex shrink-0 items-center" data-account-card-ignore-click="true">
            {refreshAction.visible ? (
              <button
                type="button"
                aria-label={t(refreshAction.labelKey)}
                title={t(refreshAction.labelKey)}
                onClick={() => onRefreshQuota(account)}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--gt-surface-muted)]"
                style={{ color: 'var(--gt-ink-secondary)' }}
                disabled={!ready || refreshAction.disabled}
              >
                <RefreshCw
                  size={16}
                  strokeWidth={2}
                  className={refreshAction.disabled ? 'animate-spin' : undefined}
                />
              </button>
            ) : null}
            <div ref={actionMenuRef} className="relative">
              <button
                type="button"
                aria-label={t('accounts.card_actions')}
                aria-haspopup="menu"
                aria-expanded={isActionMenuOpen}
                onClick={() => setIsActionMenuOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--gt-surface-muted)]"
                style={{ color: 'var(--gt-ink-secondary)' }}
                title={t('accounts.card_actions')}
              >
                <MoreVertical size={16} strokeWidth={2} />
              </button>
              {isActionMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-2 w-44 rounded-lg border p-1"
                  style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)', boxShadow: 'var(--gt-elevation-raised-2)' }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void copyAccountContent()}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)]"
                  >
                    <FileText size={14} strokeWidth={2} />
                    {t('accounts.copy_account_config')}
                  </button>
                  {canMenuReauth ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (isOAuthPending) {
                          return;
                        }
                        setIsActionMenuOpen(false);
                        onStartReauth(account);
                      }}
                      disabled={isOAuthPending}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-wait disabled:opacity-50"
                    >
                      <RotateCw size={14} strokeWidth={2} />
                      {isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth')}
                    </button>
                  ) : null}
                  {localCliActions.length > 0 ? (
                    <>
                      <div className="my-1 border-t border-dashed" style={{ borderColor: 'var(--gt-border-subtle)' }} />
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
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Terminal size={14} strokeWidth={2} className="shrink-0" />
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
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-[var(--gt-surface-muted)] disabled:cursor-wait disabled:opacity-50 ${
                        account.disabled ? 'text-[var(--gt-ink-primary)]' : 'text-[var(--gt-status-danger)]'
                      }`}
                    >
                      <Power size={14} strokeWidth={2} />
                      {isStatusPending ? t('common.loading') : account.disabled ? t('common.enable') : t('common.disable')}
                    </button>
                  ) : null}
                  {showDeleteAction ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        onRequestDelete(account.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--gt-status-danger)] hover:bg-[var(--gt-surface-muted)]"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                      {t('accounts.card_delete')}
                    </button>
                  ) : null}
                  {copyState !== 'idle' ? (
                    <div
                      className={`border-t border-dashed px-3 py-2 text-xs font-medium ${
                        copyState === 'success' ? 'text-[var(--gt-status-success)]' : 'text-[var(--gt-status-danger)]'
                      }`}
                      style={{ borderColor: 'var(--gt-border-subtle)' }}
                    >
                      {copyState === 'success' ? t('accounts.copy_done') : t('accounts.copy_failed')}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null
      }
      footer={
        !showFooterActions || isPendingDelete || density === 'list' || !showFooterReauth ? undefined : (
          <div
            className="grid gap-2"
            data-account-card-ignore-click="true"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onStartReauth(account)}
              className="parchment-toolbar-action-secondary !py-1.5 text-xs"
              disabled={isOAuthPending}
            >
              {isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth')}
            </button>
          </div>
        )
      }
      onOpen={openDetails}
    />
  );
}
