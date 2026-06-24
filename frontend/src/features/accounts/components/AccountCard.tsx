import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
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
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelection(account.id)}
              className="h-4 w-4 rounded accent-[var(--gt-accent-primary)]"
            />
          </label>
        ) : null
      }
      topActions={
        !isSelectionMode && !isPendingDelete ? (
          <div className="flex shrink-0 items-center gap-1" data-account-card-ignore-click="true">
            {refreshAction.visible ? (
              <Tooltip title={t(refreshAction.labelKey)}>
                <Button
                  type="text"
                  size="small"
                  icon={<RefreshCw
                    size={16}
                    strokeWidth={2}
                  />}
                  aria-label={t(refreshAction.labelKey)}
                  onClick={() => onRefreshQuota(account)}
                  disabled={!ready || refreshAction.disabled}
                />
              </Tooltip>
            ) : null}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'copy',
                    icon: <FileText size={14} />,
                    label: t('accounts.copy_account_config'),
                    onClick: () => void copyAccountContent(),
                  },
                  ...(canMenuReauth ? [{
                    key: 'reauth',
                    icon: <RotateCw size={14} />,
                    label: isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth'),
                    disabled: isOAuthPending,
                    onClick: () => {
                      if (!isOAuthPending) onStartReauth(account);
                    },
                  }] : []),
                  ...(localCliActions.length > 0 ? [
                    { type: 'divider' as const },
                    ...localCliActions.map((action) => ({
                      key: action.id,
                      icon: <Terminal size={14} />,
                      label: action.label,
                      disabled: action.disabled,
                      title: action.disabledReason || action.detail || action.label,
                      onClick: () => {
                        if (!action.disabled) action.onSelect(account);
                      },
                    })),
                  ] : []),
                  ...(canToggleDisabled ? [{
                    key: 'toggle',
                    icon: <Power size={14} />,
                    label: isStatusPending ? t('common.loading') : account.disabled ? t('common.enable') : t('common.disable'),
                    disabled: !ready || isStatusPending,
                    danger: !account.disabled,
                    onClick: () => onToggleDisabled(account),
                  }] : []),
                  ...(showDeleteAction ? [{
                    key: 'delete',
                    icon: <Trash2 size={14} />,
                    label: t('accounts.card_delete'),
                    danger: true,
                    onClick: () => onRequestDelete(account.id),
                  }] : []),
                ],
                onClick: () => setIsActionMenuOpen(false),
              }}
              trigger={['click']}
              open={isActionMenuOpen}
              onOpenChange={setIsActionMenuOpen}
            >
              <Tooltip title={t('accounts.card_actions')}>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreVertical size={16} strokeWidth={2} />}
                  aria-label={t('accounts.card_actions')}
                />
              </Tooltip>
            </Dropdown>
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
            <Button
              type="text"
              size="small"
              onClick={() => onStartReauth(account)}
              disabled={isOAuthPending}
            >
              {isOAuthPending ? t('accounts.reauth_pending') : t('accounts.reauth')}
            </Button>
          </div>
        )
      }
      onOpen={openDetails}
    />
  );
}
