import { type DragEvent } from 'react';
import { Button } from 'antd';
import { useI18n } from '../../../../context/I18nContext';
import type { AccountRecord } from '../../../../types';
import { resolveAccountPrimaryLabel, resolveAccountStatusTone } from '../../model/accountPresentation';
import type { CodexQuotaState } from '../../model/types';
import { buildRotationParticipationSummary, canToggleRotationAccountDisabled } from '../../model/accountRotation';

const rotationPriorityItemShellClass =
  'group relative flex items-center justify-between border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]';
const rotationPriorityItemDraggedClass = 'opacity-40';
const rotationPriorityItemActionButtonClass =
  'inline-flex min-h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const rotationPriorityItemActionButtonActiveClass =
  'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)] hover:bg-[var(--gt-ink-secondary)] hover:text-[var(--gt-surface-canvas)]';
const rotationPriorityItemStatusClass =
  'text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]';
const rotationPriorityItemTitleClass =
  'text-sm font-semibold text-[var(--gt-ink-primary)]';
const rotationPriorityItemMetaClass =
  'text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]';

interface RotationPriorityItemProps {
  account: AccountRecord;
  codexQuota: CodexQuotaState | undefined;
  isDragged: boolean;
  isPending: boolean;
  ready: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  onToggleDisabled: (account: AccountRecord) => void;
}

export function RotationPriorityItem({
  account,
  codexQuota,
  isDragged,
  isPending,
  ready,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onToggleDisabled,
}: RotationPriorityItemProps) {
  const { t } = useI18n();

  return (
    <div
      draggable
      onDragStart={() => onDragStart(account.id)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(account.id)}
      className={`${rotationPriorityItemShellClass} ${isDragged ? rotationPriorityItemDraggedClass : ''}`}
      data-account-rotation-priority-item={account.id}
    >
      <div className="flex items-center gap-4">
        <div className="cursor-grab active:cursor-grabbing" data-account-rotation-drag-handle>
          <div className="grid grid-cols-2 gap-0.5 opacity-30 group-hover:opacity-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-0.5 w-0.5 bg-[var(--gt-ink-primary)]" />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className={rotationPriorityItemTitleClass}>
              {resolveAccountPrimaryLabel(account)}
            </span>
            <span
              className={`${rotationPriorityItemStatusClass} ${resolveAccountStatusTone(account)}`}
            >
              {account.disabled ? t('common.disabled') : t('common.active')}
            </span>
          </div>
          <div className={rotationPriorityItemMetaClass}>
            PRIORITY {account.priority || 0} / {buildRotationParticipationSummary(account, codexQuota, t)}
          </div>
        </div>
      </div>

      <Button
        size="small"
        onClick={() => onToggleDisabled(account)}
        disabled={isPending || !ready || !canToggleRotationAccountDisabled(account)}
        className={`${rotationPriorityItemActionButtonClass} ${account.disabled ? rotationPriorityItemActionButtonActiveClass : ''}`}
      >
        {isPending ? '...' : account.disabled ? t('common.enable') : t('common.disable')}
      </Button>
    </div>
  );
}
