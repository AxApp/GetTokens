import { GripVertical } from 'lucide-react';
import { type DragEvent, type MouseEvent } from 'react';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import { buildEndpointLabel, routePolicyModeLabel, sourceKindLabel } from './codexAccountPresentation';
import {
  type CodexAccountRow,
  type CodexRoutePolicyRowMode,
  type CodexRoutePolicyRowState,
} from '../model/codexAccountList';

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
          className={`min-h-9 border-r-2 border-[var(--border-color)] px-2 text-[0.5625rem] font-black uppercase tracking-wide last:border-r-0 ${
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
  onPolicyModeChange,
}: {
  row: CodexAccountRow;
  index: number;
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
  onPolicyModeChange: (id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) => void;
}) {
  const endpointLabel = buildEndpointLabel(row);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;
  const policyMuted = Boolean(routePolicyState && !routePolicyState.participates);
  const policyRankLabel = routePolicyState?.participates
    ? `${t('codex.account_list_policy_rank')} ${String(routePolicyState.previewRank).padStart(2, '0')}`
    : t('codex.account_list_policy_skipped');

  function handleDragHandleClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function stopRowAction(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <article
      onDragOver={onDragOver}
      onDragEnter={() => onDragEnter(row.id)}
      onDrop={onDrop}
      onClick={onOpenDetail}
      className={`group relative grid cursor-pointer grid-cols-[3.75rem_minmax(0,1fr)_4.25rem] border-l-4 bg-[var(--bg-main)] transition-all xl:grid-cols-[3.75rem_minmax(0,1fr)_19rem_4.25rem] ${
        row.requestable ? 'border-l-green-600' : 'border-l-[var(--accent-red)]'
      } ${
        dragged ? 'opacity-40 grayscale' : 'hover:bg-[var(--bg-surface)]'
      } ${
        probeHit ? 'outline outline-2 outline-offset-[-2px] outline-[var(--text-primary)]' : ''
      } ${
        policyMuted && !probeHit ? 'opacity-70 grayscale' : ''
      }`}
    >
      <div
        draggable
        onClick={handleDragHandleClick}
        onDragStart={() => onDragStart(row.id)}
        onDragEnd={onDragEnd}
        className="flex cursor-grab items-stretch justify-center border-r-2 border-[var(--border-color)] bg-[var(--bg-main)] transition-colors active:cursor-grabbing group-hover:bg-[var(--bg-surface)]"
        title={t('accounts.rotation_drag_badge')}
      >
        <div className="flex min-h-20 flex-col items-center justify-center gap-1 px-2 py-3">
          <div
            className="flex items-center text-[var(--text-muted)] opacity-55 transition-opacity group-hover:opacity-100"
            title={t('accounts.rotation_drag_badge')}
          >
            <GripVertical className="h-4 w-4" strokeWidth={3} />
          </div>
          <div className="font-mono text-xl font-black leading-none text-[var(--text-primary)]">
            {String(index + 1).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="min-w-0 self-stretch px-3 py-3 xl:border-r-2 xl:border-[var(--border-color)]">
        <div className="grid h-full min-w-0 gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(12rem,0.95fr)] md:items-center">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <span className="max-w-full truncate font-mono text-[0.9375rem] font-black leading-tight text-[var(--text-primary)]">
                {row.label}
              </span>
              <div className="flex max-w-full flex-wrap gap-1.5">
                <span className="shrink-0 border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {sourceKindLabel(t, row.sourceKind)}
                </span>
                {!row.requestable ? (
                  <span className="shrink-0 border border-[var(--accent-red)] bg-[var(--bg-main)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--accent-red)]">
                    {routePolicyModeLabel(t, 'blocked')}
                  </span>
                ) : null}
                {probeHit ? (
                  <span className="shrink-0 border border-green-600 bg-green-600/10 px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-green-700">
                    {t('codex.account_list_probe_landed')}
                  </span>
                ) : null}
              </div>
            </div>
            {!row.requestable ? (
              <div className="mt-2 border-l-2 border-[var(--accent-red)] pl-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
                {blockedLabel}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 border-t-2 border-dashed border-[var(--border-color)] pt-2 md:border-l-2 md:border-t-0 md:pl-3 md:pt-0">
            <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t('codex.account_list_route')}
            </div>
            <div className="mt-1 break-all font-mono text-[0.6875rem] font-bold leading-snug text-[var(--text-primary)]">
              {endpointLabel}
            </div>
          </div>
        </div>
      </div>

      <div
        className="col-span-3 grid gap-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3 xl:col-span-1 xl:border-t-0 xl:bg-[var(--bg-main)]"
        onClick={stopRowAction}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('codex.account_list_policy_title')}
          </span>
          <span
            className={`shrink-0 border px-2 py-1 font-mono text-[0.5rem] font-black uppercase tracking-[0.12em] ${
              routePolicyState?.participates
                ? 'border-green-600 bg-green-600/10 text-green-700'
                : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]'
            }`}
          >
            {policyRankLabel}
          </span>
        </div>
        <div className="grid gap-2">
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
            <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[0.5625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {routePolicyModeLabel(t, 'blocked')}
            </div>
          )}
        </div>
      </div>

      <div className="col-start-3 row-start-1 flex items-center justify-center border-l-2 border-[var(--border-color)] px-2 py-3 xl:col-start-auto xl:row-start-auto">
        <ToggleSwitch
          checked={!row.disabled}
          disabled={pending}
          label={row.disabled ? t('common.enable') : t('common.disable')}
          stopPropagation
          onChange={onToggle}
        />
      </div>
    </article>
  );
}
