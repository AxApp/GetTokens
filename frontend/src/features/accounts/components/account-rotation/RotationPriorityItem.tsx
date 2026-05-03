import { type DragEvent } from 'react';
import { useI18n } from '../../../../context/I18nContext';
import type { AccountRecord } from '../../../../types';
import { resolveAccountPrimaryLabel, resolveAccountStatusTone } from '../../model/accountPresentation';
import type { CodexQuotaState } from '../../model/types';
import { buildRotationParticipationSummary, canToggleRotationAccountDisabled } from '../../model/accountRotation';

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
      className={`group relative flex items-center justify-between border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 transition-all ${
        isDragged ? 'opacity-40 grayscale' : 'hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_var(--shadow-color)]'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="cursor-grab active:cursor-grabbing">
          <div className="grid grid-cols-2 gap-0.5 opacity-30 group-hover:opacity-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-0.5 w-0.5 bg-[var(--text-primary)]" />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {resolveAccountPrimaryLabel(account)}
            </span>
            <span
              className={`text-[0.5rem] font-black uppercase tracking-[0.18em] ${resolveAccountStatusTone(account)}`}
            >
              {account.disabled ? t('common.disabled') : t('common.active')}
            </span>
          </div>
          <div className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            PRIORITY {account.priority || 0} / {buildRotationParticipationSummary(account, codexQuota, t)}
          </div>
        </div>
      </div>

      <button
        onClick={() => onToggleDisabled(account)}
        disabled={isPending || !ready || !canToggleRotationAccountDisabled(account)}
        className={`btn-swiss !px-3 !py-1 text-[0.625rem] ${
          account.disabled ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''
        }`}
      >
        {isPending ? '...' : account.disabled ? t('common.enable') : t('common.disable')}
      </button>
    </div>
  );
}
