import { GripVertical, ShieldCheck } from 'lucide-react';
import { type DragEvent } from 'react';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import AccountCard from '../../accounts/components/AccountCard';
import type { AttributionCardBadge } from '../../accounts/components/AttributionCard';
import {
  ATTRIBUTION_CARD_BADGE_TONE_CLASS,
  ATTRIBUTION_CARD_TONE_BORDER_CLASS,
  ATTRIBUTION_CARD_TONE_FILL_CLASS,
  type AttributionCardTone,
} from '../../accounts/components/attributionCardTone';
import { buildEndpointLabel, routePolicyModeLabel, sourceKindLabel } from './codexAccountPresentation';
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
  probeHit,
  routePolicyState,
  quotaState,
  usageSummary,
  rateLimitStatus,
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
  rateLimitStatus?: RateLimitState;
}) {
  const cardDensity = density === 'full' ? 'full' : 'list';
  const endpointLabel = buildEndpointLabel(row);
  const policyMuted = Boolean(routePolicyState && !routePolicyState.participates);
  const policyRankLabel = routePolicyState?.participates
    ? t('codex.account_list_policy_rank')
    : t('codex.account_list_policy_skipped');
  const quotaSummaryAccount = buildCodexQuotaSummaryAccount(row);
  const listTone: AttributionCardTone = row.requestable
    ? (probeHit ? 'positive' : policyMuted ? 'warning' : 'positive')
    : row.blockReason === 'waiting-check'
      ? 'warning'
      : 'critical';
  const listAccentBorderClass = ATTRIBUTION_CARD_TONE_BORDER_CLASS[listTone];
  const listRailFillClass = ATTRIBUTION_CARD_TONE_FILL_CLASS[listTone];
  const listStatusClass = ATTRIBUTION_CARD_BADGE_TONE_CLASS[listTone];
  const manualLabel = row.manualRequestable
    ? t('codex.account_list_manual_requestable_remove')
    : t('codex.account_list_manual_requestable_add');
  const canToggleManualRequestable = row.sourceKind !== 'openai-compatible' || row.manualRequestable === true;
  const blockedStatusLabel = row.blockReason === 'waiting-check'
    ? t('codex.account_list_waiting_check_badge')
    : routePolicyModeLabel(t, 'blocked');
  const manualButton = canToggleManualRequestable ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleManualRequestable();
      }}
      disabled={manualPending}
      draggable={false}
      className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] shadow-[2px_2px_0_var(--shadow-color)] transition disabled:cursor-wait disabled:opacity-50 ${
        row.manualRequestable
          ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'bg-[var(--bg-main)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
      }`}
      title={manualLabel}
      aria-label={manualLabel}
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
      <span className="min-w-0 truncate">{manualPending ? t('codex.account_list_saving') : manualLabel}</span>
    </button>
  ) : null;
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
  if (rateLimitStatus?.blocked) {
    badges.push({ label: rateLimitStatus.blockReason || 'ROUTE GUARD', tone: 'critical' });
  }
  if (density === 'list') {
    return (
      <div
        onDragOver={onDragOver}
        onDragEnter={() => onDragEnter(row.id)}
        onDrop={onDrop}
        className={`${dragged ? 'opacity-40 grayscale' : probeHit ? 'outline outline-2 outline-offset-2 outline-[var(--text-primary)]' : ''}`.trim()}
      >
        <div
          className={`grid min-h-[4.25rem] w-full grid-cols-[5.25rem_minmax(0,1fr)_9rem] items-stretch overflow-hidden border-2 border-l-[8px] border-[var(--border-color)] bg-[var(--bg-main)] text-left shadow-[4px_4px_0_var(--shadow-color)] transition hover:-translate-y-0.5 hover:bg-[var(--bg-surface)] active:translate-y-0 ${listAccentBorderClass} ${
            policyMuted && !probeHit ? 'opacity-75 grayscale' : ''
          }`}
        >
          <span
            draggable
            onClick={(event) => event.stopPropagation()}
            onDragStart={() => onDragStart(row.id)}
            onDragEnd={onDragEnd}
            className="grid cursor-grab grid-cols-[0.5rem_minmax(0,1fr)] border-r-2 border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] active:cursor-grabbing"
            title={t('accounts.rotation_drag_badge')}
          >
            <span className={listRailFillClass} aria-hidden="true" />
            <span className="flex min-w-0 items-center justify-center gap-2 px-2">
              <span className="font-mono text-sm font-black leading-none tracking-normal text-[var(--text-primary)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <GripVertical className="h-4 w-4 shrink-0" strokeWidth={3} />
            </span>
          </span>
          <button
            type="button"
            onClick={onOpenDetail}
            className="grid min-w-0 content-center gap-1.5 px-3 py-2 text-left"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {`ORDER ${String(index + 1).padStart(2, '0')}`}
              </span>
              <span className="min-w-0 truncate text-[length:var(--font-size-ui-lg)] font-black leading-tight text-[var(--text-primary)]">
                {row.label}
              </span>
            </span>
            <span className="grid min-w-0 grid-cols-[8.25rem_minmax(0,1fr)] items-center gap-2">
              <span className="min-w-0 truncate border border-[var(--border-color)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-center font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {sourceKindLabel(t, row.sourceKind)}
              </span>
              <span className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {endpointLabel || row.provider}
              </span>
            </span>
          </button>
          <span className="grid min-w-0 content-center gap-1.5 border-l-2 border-[var(--border-color)] px-3 py-2">
            <span
              className={`max-w-full truncate whitespace-nowrap border px-2 py-1 text-right font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
                listStatusClass
              }`}
            >
              {row.requestable ? policyRankLabel : blockedStatusLabel}
            </span>
            {manualButton}
          </span>
        </div>
      </div>
    );
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
      className={`${density === 'full' ? 'xl:row-span-6 xl:grid xl:grid-rows-[subgrid]' : ''} relative cursor-grab active:cursor-grabbing ${dragged ? 'opacity-40 grayscale' : probeHit ? 'outline outline-2 outline-offset-2 outline-[var(--text-primary)]' : ''}`.trim()}
    >
      <div
        className="absolute bottom-2 right-2 z-10 max-w-[11rem]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {manualButton}
      </div>
      <AccountCard
        t={t}
        account={quotaSummaryAccount}
        usageSummary={usageSummary}
        quotaState={quotaState}
        rateLimitStatus={rateLimitStatus}
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
        showFooterActions={false}
        onToggleSelection={() => undefined}
        onOpenDetails={onOpenDetail}
        onRefreshQuota={() => undefined}
        onStartReauth={() => undefined}
        onToggleDisabled={onToggle}
        onRequestDelete={() => undefined}
        onCancelDelete={() => undefined}
        onConfirmDelete={() => undefined}
      />
    </div>
  );
}
