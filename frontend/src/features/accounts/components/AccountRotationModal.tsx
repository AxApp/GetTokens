import { type DragEvent } from 'react';
import { Button } from 'antd';
import { X } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord } from '../../../types';
import type { CodexQuotaState } from '../model/types';
import { useAccountRotation } from '../hooks/useAccountRotation';
import { RotationPriorityItem } from './account-rotation/RotationPriorityItem';
import { RotationConfigSection } from './account-rotation/RotationConfigSection';

const accountRotationModalOverlayClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm';
const accountRotationModalPanelClass =
  'flex max-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-lg';
const accountRotationModalHeaderClass =
  'flex items-start justify-between gap-4 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-6 py-5';
const accountRotationModalBodyClass = 'flex-1 space-y-8 overflow-auto p-6';
const accountRotationModalFooterClass =
  'flex items-center justify-between border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';
const accountRotationModalSectionHeaderClass =
  'flex flex-wrap items-end justify-between gap-3 border-b border-[var(--gt-border-subtle)] pb-3';
const accountRotationModalEyebrowClass =
  'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const accountRotationModalTitleClass = 'mt-1 text-lg font-semibold text-[var(--gt-ink-primary)]';
const accountRotationModalSectionTitleClass =
  'text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-primary)]';
const accountRotationModalMetaClass =
  'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const accountRotationModalNoticeClass =
  'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]';

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
      className={accountRotationModalOverlayClass}
      data-collaboration-id="MODAL_ACCOUNT_ROTATION"
      data-account-rotation-modal
    >
      <div className={accountRotationModalPanelClass}>
        <header className={accountRotationModalHeaderClass} data-account-rotation-modal-header>
          <div>
            <div className={accountRotationModalEyebrowClass}>
              {orderedAccounts.length} {t('accounts.rotation_subtitle')}
            </div>
            <h2 className={accountRotationModalTitleClass}>
              {t('accounts.rotation_title')}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gt-border-subtle)]" />
              <span className={accountRotationModalMetaClass}>{routingMessage}</span>
            </div>
          </div>
          <Button
            onClick={onClose}
            aria-label={t('common.close')}
            icon={<X size={14} />}
            className="!absolute right-4 top-4 !z-10"
          />
        </header>

        <div className={accountRotationModalBodyClass} data-account-rotation-modal-body>
          <section className="space-y-5" data-account-rotation-modal-priority>
            <div className={accountRotationModalSectionHeaderClass}>
              <h3 className={accountRotationModalSectionTitleClass}>
                {t('accounts.rotation_priority')}
              </h3>
              <p className={accountRotationModalMetaClass}>
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

          <section className="space-y-5" data-account-rotation-modal-config>
            <div className={accountRotationModalSectionHeaderClass}>
              <h3 className={accountRotationModalSectionTitleClass}>
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
              <div className={accountRotationModalNoticeClass}>
                {t('status.routing_missing')}
              </div>
            )}
          </section>

          {saveMessage ? (
            <div className={accountRotationModalNoticeClass}>
              {saveMessage}
            </div>
          ) : null}
        </div>

        <footer className={accountRotationModalFooterClass} data-account-rotation-modal-footer>
          <Button onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            onClick={() => void saveChanges()}
            disabled={isSaving || !ready || (!orderChanged && !routingChanged)}
          >
            {isSaving ? t('status.routing_saving') : t('accounts.rotation_save')}
          </Button>
        </footer>
      </div>
    </div>
  );
}
