import { type DragEvent } from 'react';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord } from '../../../types';
import type { CodexQuotaState } from '../model/types';
import { useAccountRotation } from '../hooks/useAccountRotation';
import { RotationPriorityItem } from './account-rotation/RotationPriorityItem';
import { RotationConfigSection } from './account-rotation/RotationConfigSection';

interface AccountRotationModalProps {
  accounts: AccountRecord[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  ready: boolean;
  onClose: () => void;
  onReloadAccounts: () => Promise<void>;
}

export default function AccountRotationModal({
  accounts,
  codexQuotaByName,
  ready,
  onClose,
  onReloadAccounts,
}: AccountRotationModalProps) {
  const { t } = useI18n();
  const {
    orderedAccounts,
    draggedAccountID,
    setDraggedAccountID,
    routingDraft,
    setRoutingDraft,
    routingMessage,
    saveMessage,
    isSaving,
    pendingStatusAccountID,
    isStrategyMenuOpen,
    setIsStrategyMenuOpen,
    strategyMenuRef,
    orderChanged,
    routingChanged,
    handleDrop,
    handleToggleAccountDisabled,
    saveChanges,
  } = useAccountRotation(accounts, ready, onReloadAccounts);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-main)]/80 backdrop-blur-sm"
      data-collaboration-id="MODAL_ACCOUNT_ROTATION"
    >
      <div className="flex max-h-[90vh] w-[95vw] max-w-7xl flex-col border-4 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[12px_12px_0_var(--shadow-color)]">
        <header className="flex items-center justify-between border-b-4 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-5">
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {t('accounts.rotation_title')}
            </h2>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {orderedAccounts.length} {t('accounts.rotation_subtitle')}
              </span>
              <span className="h-1 w-1 rounded-full bg-[var(--border-color)]" />
              <span className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                {routingMessage}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl font-black hover:text-[var(--accent-red)]">
            ×
          </button>
        </header>

        <div className="flex-1 space-y-10 overflow-auto p-8">
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] pb-3">
              <h3 className="text-[0.6875rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                {t('accounts.rotation_priority')}
              </h3>
              <p className="text-[0.5625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {t('accounts.rotation_priority_hint')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {orderedAccounts.map((account) => (
                <RotationPriorityItem
                  key={account.id}
                  account={account}
                  codexQuota={codexQuotaByName[account.name || '']}
                  isDragged={draggedAccountID === account.id}
                  isPending={pendingStatusAccountID === account.id}
                  ready={ready}
                  onDragStart={setDraggedAccountID}
                  onDragOver={handleDragOver}
                  onDragEnd={() => setDraggedAccountID(null)}
                  onDrop={handleDrop}
                  onToggleDisabled={handleToggleAccountDisabled}
                />
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] pb-3">
              <h3 className="text-[0.6875rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                {t('status.routing_config')}
              </h3>
            </div>

            {routingDraft ? (
              <RotationConfigSection
                routingDraft={routingDraft}
                setRoutingDraft={setRoutingDraft}
                isStrategyMenuOpen={isStrategyMenuOpen}
                setIsStrategyMenuOpen={setIsStrategyMenuOpen}
                strategyMenuRef={strategyMenuRef}
              />
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {t('status.routing_missing')}
              </div>
            )}
          </section>

          {saveMessage ? (
            <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {saveMessage}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => void saveChanges()}
            disabled={isSaving || !ready || (!orderChanged && !routingChanged)}
            className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? t('status.routing_saving') : t('accounts.rotation_save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
