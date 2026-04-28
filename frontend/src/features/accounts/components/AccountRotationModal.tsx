import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  GetRelayRoutingConfig,
  UpdateAccountPriority,
  UpdateRelayRoutingConfig,
} from '../../../../wailsjs/go/main/App';
import type { main } from '../../../../wailsjs/go/models';
import { useDebug } from '../../../context/DebugContext';
import { useI18n } from '../../../context/I18nContext';
import { toErrorMessage } from '../../../utils/error';
import type { ClickEventLike } from '../model/types';
import type { AccountRecord } from '../../../types';
import { buildPriorityUpdates, buildRotationQuotaSummary, buildRoutingDefaultLabel, reorderPriorityAccounts } from '../model/accountRotation';
import type { CodexQuotaState } from '../model/types';
import { compareAccountRecords, resolveAccountPrimaryLabel } from '../model/accountPresentation';

interface AccountRotationModalProps {
  accounts: AccountRecord[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  ready: boolean;
  onClose: () => void;
  onReloadAccounts: () => Promise<void>;
}

function buildOrderedAccounts(accounts: AccountRecord[]) {
  return accounts
    .slice()
    .sort((left, right) => {
      const leftPriority = Number(left.priority || 0);
      const rightPriority = Number(right.priority || 0);
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      return compareAccountRecords(left, right);
    });
}

export default function AccountRotationModal({
  accounts,
  codexQuotaByName,
  ready,
  onClose,
  onReloadAccounts,
}: AccountRotationModalProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const [orderedAccounts, setOrderedAccounts] = useState<AccountRecord[]>(() => buildOrderedAccounts(accounts));
  const [draggedAccountID, setDraggedAccountID] = useState<string | null>(null);
  const [routingConfig, setRoutingConfig] = useState<main.RelayRoutingConfig | null>(null);
  const [routingDraft, setRoutingDraft] = useState<main.RelayRoutingConfig | null>(null);
  const [routingMessage, setRoutingMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setOrderedAccounts(buildOrderedAccounts(accounts));
  }, [accounts]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoutingConfig() {
      if (!ready) {
        setRoutingConfig(null);
        setRoutingDraft(null);
        setRoutingMessage('');
        return;
      }

      try {
        const config = await trackRequest('GetRelayRoutingConfig', { args: [] }, () => GetRelayRoutingConfig());
        if (cancelled) {
          return;
        }
        setRoutingConfig(config);
        setRoutingDraft(config);
        setRoutingMessage(t('status.routing_loaded'));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRoutingConfig(null);
        setRoutingDraft(null);
        setRoutingMessage(`${t('status.routing_missing')}: ${toErrorMessage(error)}`);
      }
    }

    void loadRoutingConfig();

    return () => {
      cancelled = true;
    };
  }, [ready, t, trackRequest]);

  const orderChanged = useMemo(() => buildPriorityUpdates(orderedAccounts).length > 0, [orderedAccounts]);
  const routingChanged = useMemo(
    () => JSON.stringify(routingDraft) !== JSON.stringify(routingConfig),
    [routingConfig, routingDraft]
  );
  const routingToggleFields = useMemo(
    () =>
      [
        ['sessionAffinity', t('status.routing_session_affinity')],
        ['switchProject', t('status.routing_switch_project')],
        ['switchPreviewModel', t('status.routing_switch_preview_model')],
        ['antigravityCredits', t('status.routing_antigravity_credits')],
      ] as const,
    [t]
  );

  function handleDrop(targetID: string) {
    if (!draggedAccountID || draggedAccountID === targetID) {
      return;
    }
    setOrderedAccounts((prev) => reorderPriorityAccounts(prev, draggedAccountID, targetID));
    setDraggedAccountID(null);
  }

  async function saveChanges() {
    if (!ready) {
      return;
    }

    setIsSaving(true);
    setSaveMessage('');
    try {
      const priorityUpdates = buildPriorityUpdates(orderedAccounts);
      for (const update of priorityUpdates) {
        await trackRequest('UpdateAccountPriority', update, () => UpdateAccountPriority(update));
      }

      let nextRoutingConfig = routingConfig;
      if (routingDraft && routingChanged) {
        nextRoutingConfig = await trackRequest('UpdateRelayRoutingConfig', routingDraft, () =>
          UpdateRelayRoutingConfig(routingDraft)
        );
        setRoutingConfig(nextRoutingConfig);
        setRoutingDraft(nextRoutingConfig);
      }

      if (priorityUpdates.length > 0) {
        await onReloadAccounts();
      }
      setSaveMessage(t('accounts.rotation_save_success'));
      if (!nextRoutingConfig && !routingDraft) {
        setRoutingMessage(t('status.routing_missing'));
      }
    } catch (error) {
      console.error(error);
      setSaveMessage(`${t('accounts.rotation_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b-2 border-[var(--border-color)] px-6 py-4">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('accounts.rotation_settings')}
            </div>
            <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
              {t('accounts.rotation_modal_title')}
            </h3>
          </div>
          <button onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.rotation_order_section')}
                </div>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('accounts.rotation_drag_hint')}
                </p>
              </div>
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {orderChanged ? t('accounts.rotation_unsaved') : t('accounts.rotation_synced')}
              </div>
            </div>

            {orderedAccounts.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {orderedAccounts.map((account, index) => (
                  <button
                    key={account.id}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedAccountID(account.id)}
                    onDragEnd={() => setDraggedAccountID(null)}
                    onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
                    onDrop={() => handleDrop(account.id)}
                    className={`flex items-center justify-between gap-4 border-2 px-4 py-4 text-left ${
                      draggedAccountID === account.id
                        ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] opacity-60'
                        : 'border-[var(--border-color)] bg-[var(--bg-main)]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--bg-surface)] font-mono text-sm font-black text-[var(--text-primary)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                          {resolveAccountPrimaryLabel(account)}
                        </div>
                        <div className="mt-1 font-mono text-[10px] font-bold uppercase text-[var(--text-muted)]">
                          {account.credentialSource} · P{account.priority ?? 0} · {account.baseUrl || account.name || '--'}
                        </div>
                        <div className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]/75">
                          {buildRotationQuotaSummary(account, codexQuotaByName[account.quotaKey || ''], t)}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      {t('accounts.rotation_drag_badge')}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-8 text-center text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {t('accounts.rotation_empty_accounts')}
              </div>
            )}
          </section>

          <section className="space-y-5 border-t-2 border-dashed border-[var(--border-color)] pt-8">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
                {t('status.routing_title')}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{routingMessage}</div>
            </div>

            {routingDraft ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {t('status.routing_strategy')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]/70">
                      {buildRoutingDefaultLabel(t, 'strategy')}
                    </span>
                    <div className="relative">
                      <select
                        value={routingDraft.strategy}
                        onChange={(event) =>
                          setRoutingDraft((prev) => (prev ? { ...prev, strategy: event.target.value } : prev))
                        }
                        className="select-swiss"
                      >
                        <option value="round-robin">{t('status.routing_strategy_round_robin')}</option>
                        <option value="fill-first">{t('status.routing_strategy_fill_first')}</option>
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                        ▼
                      </span>
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {t('status.routing_session_affinity_ttl')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]/70">
                      {buildRoutingDefaultLabel(t, 'sessionAffinityTTL')}
                    </span>
                    <input
                      value={routingDraft.sessionAffinityTTL}
                      onChange={(event) =>
                        setRoutingDraft((prev) => (prev ? { ...prev, sessionAffinityTTL: event.target.value } : prev))
                      }
                      className="input-swiss w-full"
                      placeholder="1h"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {t('status.routing_request_retry')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]/70">
                      {buildRoutingDefaultLabel(t, 'requestRetry')}
                    </span>
                    <input
                      value={String(routingDraft.requestRetry)}
                      onChange={(event) =>
                        setRoutingDraft((prev) =>
                          prev ? { ...prev, requestRetry: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                        )
                      }
                      className="input-swiss w-full"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {t('status.routing_max_retry_credentials')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]/70">
                      {buildRoutingDefaultLabel(t, 'maxRetryCredentials')}
                    </span>
                    <input
                      value={String(routingDraft.maxRetryCredentials)}
                      onChange={(event) =>
                        setRoutingDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                maxRetryCredentials: Number.parseInt(event.target.value || '0', 10) || 0,
                              }
                            : prev
                        )
                      }
                      className="input-swiss w-full"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {t('status.routing_max_retry_interval')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]/70">
                      {buildRoutingDefaultLabel(t, 'maxRetryInterval')}
                    </span>
                    <input
                      value={String(routingDraft.maxRetryInterval)}
                      onChange={(event) =>
                        setRoutingDraft((prev) =>
                          prev ? { ...prev, maxRetryInterval: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                        )
                      }
                      className="input-swiss w-full"
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {routingToggleFields.map(([field, label]) => (
                    <label
                      key={field}
                      className="flex items-center gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(routingDraft[field as keyof main.RelayRoutingConfig])}
                        onChange={(event) =>
                          setRoutingDraft((prev) =>
                            prev ? { ...prev, [field]: event.target.checked } : prev
                          )
                        }
                      />
                      <div className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                          {label}
                        </span>
                        <span className="block text-[9px] font-bold uppercase tracking-wide text-[var(--text-primary)]/70">
                          {buildRoutingDefaultLabel(t, field)}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {t('status.routing_missing')}
              </div>
            )}
          </section>

          {saveMessage ? (
            <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]">
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
