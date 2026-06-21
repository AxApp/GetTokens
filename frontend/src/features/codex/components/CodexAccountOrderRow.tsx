import { type DragEvent } from 'react';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import AccountCard, { type AccountCardLocalCliAction } from '../../accounts/components/AccountCard';
import type { AttributionCardBadge } from '../../accounts/components/AttributionCard';
import { routePolicyModeLabel, sourceKindLabel } from './codexAccountPresentation';
import {
  buildCodexQuotaSummaryAccount,
  type CodexAccountRow,
  type CodexRoutePolicyRowState,
} from '../model/codexAccountList';
import type { CodexAccountOrderDisplayMode } from '../model/codexAccountOrderSectionLayout';

export function AccountOrderRow({
  row,
  index,
  density,
  dragged,
  pending,
  manualPending,
  t,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragEnd,
  onDrop,
  onOpenDetail,
  onToggle,
  onToggleManualRequestable,
  onRefreshQuota,
  probeHit,
  routePolicyState,
  quotaState,
  usageSummary,
  usageRefreshing,
  rateLimitStatus,
  rateLimitRefreshing,
}: {
  row: CodexAccountRow;
  index: number;
  density: CodexAccountOrderDisplayMode;
  dragged: boolean;
  pending: boolean;
  manualPending: boolean;
  t: (key: string) => string;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onOpenDetail: () => void;
  onToggle: () => void;
  onToggleManualRequestable: () => void;
  probeHit: boolean;
  routePolicyState?: CodexRoutePolicyRowState;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  usageRefreshing?: boolean;
  rateLimitStatus?: RateLimitState;
  rateLimitRefreshing?: boolean;
  onRefreshQuota: (row: CodexAccountRow) => void;
}) {
  const cardDensity = density === 'full' ? 'full' : 'list';
  const policyMuted = Boolean(routePolicyState && !routePolicyState.participates);
  const quotaSummaryAccount = buildCodexQuotaSummaryAccount(row);
  const manualLabel = row.manualRequestable
    ? t('codex.account_list_manual_requestable_remove')
    : t('codex.account_list_manual_requestable_add');
  const canToggleManualRequestable = row.sourceKind !== 'openai-compatible' || row.manualRequestable === true;
  const manualActions: AccountCardLocalCliAction[] = canToggleManualRequestable
    ? [
        {
          id: 'codex-manual-requestable',
          label: manualPending ? t('codex.account_list_saving') : manualLabel,
          disabled: manualPending,
          disabledReason: manualPending ? t('codex.account_list_saving') : undefined,
          onSelect: () => onToggleManualRequestable(),
        },
      ]
    : [];
  const badges: AttributionCardBadge[] = [
    { label: `ORDER ${String(index + 1).padStart(2, '0')}` },
    { label: sourceKindLabel(t, row.sourceKind) },
  ];
  if (row.manualRequestable) {
    badges.push({ label: t('codex.account_list_manual_requestable_badge'), tone: 'positive' });
  }
  if (row.blockReason === 'waiting-check') {
    badges.push({ label: t('codex.account_list_waiting_check_badge'), tone: 'warning' });
  }
  if (probeHit) {
    badges.push({ label: t('codex.account_list_probe_landed'), tone: 'positive' });
  } else if (!row.requestable) {
    badges.push({ label: routePolicyModeLabel(t, 'blocked'), tone: 'critical' });
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(row.id)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={() => onDragEnter(row.id)}
      onDrop={onDrop}
      title={t('accounts.rotation_drag_badge')}
      className={`relative cursor-grab active:cursor-grabbing ${
        dragged ? 'opacity-40 grayscale' : probeHit ? 'outline outline-2 outline-offset-2 outline-[var(--gt-ink-primary)]' : ''
      } ${policyMuted && !probeHit ? 'opacity-75 grayscale' : ''}`.trim()}
    >
      <AccountCard
        t={t}
        account={quotaSummaryAccount}
        usageSummary={usageSummary}
        quotaState={quotaState}
        rateLimitStatus={rateLimitStatus}
        usageRefreshing={usageRefreshing}
        rateLimitRefreshing={rateLimitRefreshing}
        density={cardDensity}
        ready={!pending}
        isSelectionMode={false}
        isSelected={false}
        isPendingDelete={false}
        isOAuthPending={false}
        isStatusPending={pending}
        extraBadges={badges}
        eyebrowPrefix={`#${index + 1}`}
        showDeleteAction={false}
        showFooterActions
        showFooterReauthAction={false}
        localCliActions={manualActions}
        onToggleSelection={() => undefined}
        onOpenDetails={onOpenDetail}
        onRefreshQuota={() => onRefreshQuota(row)}
        onStartReauth={() => undefined}
        onToggleDisabled={onToggle}
        onRequestDelete={() => undefined}
        onCancelDelete={() => undefined}
        onConfirmDelete={() => undefined}
      />
    </div>
  );
}
