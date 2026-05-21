import { GripVertical } from 'lucide-react';
import { type DragEvent, type MouseEvent } from 'react';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import { buildQuotaDisplay } from '../../accounts/model/accountQuota';
import AttributionCard, { type AttributionCardBadge } from '../../accounts/components/AttributionCard';
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
  type CodexRoutePolicyRowMode,
  type CodexRoutePolicyRowState,
} from '../model/codexAccountList';
import type { CodexAccountOrderDisplayMode } from '../model/codexAccountOrderSectionLayout';

function RoutePolicyModeControl({
  id,
  mode,
  t,
  onChange,
}: {
  id: string;
  mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>;
  t: (key: string) => string;
  onChange: (id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) => void;
}) {
  const options: Array<{ id: Exclude<CodexRoutePolicyRowMode, 'blocked'>; label: string }> = [
    { id: 'default', label: t('codex.account_list_policy_mode_default') },
    { id: 'allow', label: t('codex.account_list_policy_mode_allow') },
    { id: 'deny', label: t('codex.account_list_policy_mode_deny') },
  ];
  return (
    <div className="grid grid-cols-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(id, option.id)}
          className={`min-h-9 border-r-2 border-[var(--border-color)] px-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide last:border-r-0 ${
            mode === option.id
              ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AccountOrderRow({
  row,
  index,
  density,
  dragged,
  pending,
  t,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragEnd,
  onDrop,
  onOpenDetail,
  onToggle,
  probeHit,
  routePolicyState,
  quotaState,
  usageSummary,
  rateLimitStatus,
  onPolicyModeChange,
}: {
  row: CodexAccountRow;
  index: number;
  density: CodexAccountOrderDisplayMode;
  dragged: boolean;
  pending: boolean;
  t: (key: string) => string;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onOpenDetail: () => void;
  onToggle: () => void;
  probeHit: boolean;
  routePolicyState?: CodexRoutePolicyRowState;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  onPolicyModeChange: (id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) => void;
}) {
  const cardDensity = density === 'full' ? 'full' : 'compact';
  const endpointLabel = buildEndpointLabel(row);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;
  const policyMuted = Boolean(routePolicyState && !routePolicyState.participates);
  const policyRankLabel = routePolicyState?.participates
    ? t('codex.account_list_policy_rank')
    : t('codex.account_list_policy_skipped');
  const quotaDisplay = buildQuotaDisplay(buildCodexQuotaSummaryAccount(row), quotaState);
  const cardTone = row.requestable ? (probeHit ? 'positive' : policyMuted ? 'warning' : 'neutral') : 'critical';
  const listTone: AttributionCardTone = row.requestable ? (probeHit ? 'positive' : policyMuted ? 'warning' : 'positive') : 'critical';
  const listAccentBorderClass = ATTRIBUTION_CARD_TONE_BORDER_CLASS[listTone];
  const listRailFillClass = ATTRIBUTION_CARD_TONE_FILL_CLASS[listTone];
  const listStatusClass = ATTRIBUTION_CARD_BADGE_TONE_CLASS[listTone];
  const badges: AttributionCardBadge[] = [
    { label: `ORDER ${String(index + 1).padStart(2, '0')}` },
    { label: sourceKindLabel(t, row.sourceKind) },
  ];
  if (probeHit) {
    badges.push({ label: t('codex.account_list_probe_landed'), tone: 'positive' });
  } else if (!row.requestable) {
    badges.push({ label: routePolicyModeLabel(t, 'blocked'), tone: 'critical' });
  }
  if (rateLimitStatus?.blocked) {
    badges.push({ label: rateLimitStatus.blockReason || 'ROUTE GUARD', tone: 'critical' });
  }
  function handleDragHandleClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  if (density === 'list') {
    return (
      <div
        onDragOver={onDragOver}
        onDragEnter={() => onDragEnter(row.id)}
        onDrop={onDrop}
        className={`${dragged ? 'opacity-40 grayscale' : probeHit ? 'outline outline-2 outline-offset-2 outline-[var(--text-primary)]' : ''}`.trim()}
      >
        <button
          type="button"
          onClick={onOpenDetail}
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
          <span className="grid min-w-0 content-center gap-1.5 px-3 py-2">
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
          </span>
          <span className="flex min-w-0 items-center justify-end border-l-2 border-[var(--border-color)] px-3 py-2">
            <span
              className={`max-w-full truncate whitespace-nowrap border px-2 py-1 text-right font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
                listStatusClass
              }`}
            >
              {row.requestable ? policyRankLabel : routePolicyModeLabel(t, 'blocked')}
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={() => onDragEnter(row.id)}
      onDrop={onDrop}
      className={`${density === 'full' ? 'xl:row-span-6 xl:grid xl:grid-rows-[subgrid]' : ''} ${dragged ? 'opacity-40 grayscale' : probeHit ? 'outline outline-2 outline-offset-2 outline-[var(--text-primary)]' : ''}`.trim()}
    >
      <AttributionCard
        t={t}
        title={row.label}
        subtitle={row.baseUrl || ''}
        eyebrow={policyRankLabel}
        badges={badges}
        usageSummary={usageSummary}
        quotaDisplay={quotaDisplay}
        rateLimitStatus={rateLimitStatus}
        tone={cardTone}
        density={cardDensity}
        className={`${density === 'full' ? 'xl:row-span-6 xl:grid xl:grid-rows-[subgrid] xl:h-auto' : ''} ${policyMuted && !probeHit ? 'opacity-75 grayscale' : ''}`.trim()}
        leadingAction={
          <div
            draggable
            onClick={handleDragHandleClick}
            onDragStart={() => onDragStart(row.id)}
            onDragEnd={onDragEnd}
            className="flex cursor-grab items-center gap-1 text-[var(--text-muted)] active:cursor-grabbing"
            title={t('accounts.rotation_drag_badge')}
          >
            <GripVertical className="h-4 w-4" strokeWidth={3} />
            <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em]">
              {t('accounts.rotation_drag_badge')}
            </span>
          </div>
        }
        footer={
          <CodexAccountSpecialActionBar
            row={row}
            endpointLabel={endpointLabel}
            blockedLabel={blockedLabel}
            pending={pending}
            routePolicyState={routePolicyState}
            t={t}
            onToggle={onToggle}
            onPolicyModeChange={onPolicyModeChange}
          />
        }
        interactive
        onOpen={onOpenDetail}
      />
    </div>
  );
}

function CodexAccountSpecialActionBar({
  row,
  endpointLabel,
  blockedLabel,
  pending,
  routePolicyState,
  t,
  onToggle,
  onPolicyModeChange,
}: {
  row: CodexAccountRow;
  endpointLabel: string;
  blockedLabel?: string;
  pending: boolean;
  routePolicyState?: CodexRoutePolicyRowState;
  t: (key: string) => string;
  onToggle: () => void;
  onPolicyModeChange: (id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) => void;
}) {
  const runtimeLabel = row.requestable ? t('common.enable') : routePolicyModeLabel(t, 'blocked');
  const modelMappingCount = row.modelMappings.length > 0 ? String(row.modelMappings.length) : '0';

  function stopAction(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      className="grid gap-3 border-t border-dashed border-[var(--border-color)] pt-3"
      data-account-card-ignore-click="true"
      onClick={stopAction}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="grid gap-2 sm:grid-cols-2">
          <RegionHead label={t('codex.account_list_route')} value={endpointLabel || row.provider} />
          <RegionHead label={t('codex.account_list_model_mapping')} value={modelMappingCount} />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <RegionHead label={t('codex.account_list_runtime')} value={runtimeLabel} compact />
          <ToggleSwitch
            checked={!row.disabled}
            disabled={pending}
            label={row.disabled ? t('common.enable') : t('common.disable')}
            stopPropagation
            onChange={onToggle}
          />
        </div>
      </div>

      {row.modelMappings.length > 0 ? (
        <div className="grid gap-2">
          {row.modelMappings.slice(0, 2).map((mapping, mappingIndex) => (
            <div
              key={`${mapping.realModel}-${mapping.codexModel || mappingIndex}`}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1.5"
            >
              <code className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {mapping.realModel}
              </code>
              <b className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
                {mapping.codexModel || mapping.realModel}
              </b>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2">
        <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {t('codex.account_list_policy_title')}
        </span>
        {row.requestable && routePolicyState?.mode !== 'blocked' ? (
          <RoutePolicyModeControl
            id={row.id}
            mode={
              routePolicyState?.mode === 'allow' || routePolicyState?.mode === 'deny'
                ? routePolicyState.mode
                : 'default'
            }
            t={t}
            onChange={onPolicyModeChange}
          />
        ) : (
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
            {blockedLabel || routePolicyModeLabel(t, 'blocked')}
          </div>
        )}
      </div>
    </div>
  );
}

function RegionHead({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? 'grid min-w-0 gap-1' : 'grid min-w-0 gap-1.5 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2'}>
      <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <b className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
        {value}
      </b>
    </div>
  );
}
