import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  GetRelayRoutingConfig,
  SetAccountDisabled,
  UpdateAccountPriority,
  UpdateRelayRoutingConfig,
} from '../../../../wailsjs/go/main/App';
import type { main } from '../../../../wailsjs/go/models';
import { useDebug } from '../../../context/DebugContext';
import { useI18n } from '../../../context/I18nContext';
import { toErrorMessage } from '../../../utils/error';
import type { ClickEventLike } from '../model/types';
import type { AccountRecord } from '../../../types';
import {
  buildPriorityUpdates,
  canToggleRotationAccountDisabled,
  buildRotationParticipationSummary,
  reorderPriorityAccounts,
} from '../model/accountRotation';
import type { CodexQuotaState } from '../model/types';
import { compareAccountRecords, resolveAccountPrimaryLabel, resolveAccountStatusTone } from '../model/accountPresentation';

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
  const [pendingStatusAccountID, setPendingStatusAccountID] = useState<string | null>(null);
  const [isStrategyMenuOpen, setIsStrategyMenuOpen] = useState(false);
  const strategyMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isStrategyMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!strategyMenuRef.current?.contains(event.target as Node)) {
        setIsStrategyMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isStrategyMenuOpen]);

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
  const routingStrategyOptions = useMemo(
    () => [
      { value: 'round-robin', label: t('status.routing_strategy_round_robin') },
      { value: 'fill-first', label: t('status.routing_strategy_fill_first') },
    ],
    [t]
  );

  function handleDrop(targetID: string) {
    if (!draggedAccountID || draggedAccountID === targetID) {
      return;
    }
    setOrderedAccounts((prev) => reorderPriorityAccounts(prev, draggedAccountID, targetID));
    setDraggedAccountID(null);
  }

  async function handleToggleAccountDisabled(account: AccountRecord) {
    if (!ready || !canToggleRotationAccountDisabled(account)) {
      return;
    }

    setPendingStatusAccountID(account.id);
    setSaveMessage('');
    try {
      await trackRequest('SetAccountDisabled', { id: account.id, disabled: !account.disabled }, () =>
        SetAccountDisabled(account.id, !account.disabled)
      );
      setOrderedAccounts((prev) =>
        prev.map((item) => (item.id === account.id ? { ...item, disabled: !account.disabled } : item))
      );
      await onReloadAccounts();
    } catch (error) {
      console.error(error);
      setSaveMessage(toErrorMessage(error));
    } finally {
      setPendingStatusAccountID(null);
    }
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
            <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
                <div className="text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.rotation_order_section')}
                </div>
                <p className="mt-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('accounts.rotation_drag_hint')}
                </p>
              </div>
              <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {orderChanged ? t('accounts.rotation_unsaved') : t('accounts.rotation_synced')}
              </div>
            </div>

            {orderedAccounts.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {orderedAccounts.map((account, index) => (
                  <div
                    key={account.id}
                    draggable
                    onDragStart={() => setDraggedAccountID(account.id)}
                    onDragEnd={() => setDraggedAccountID(null)}
                    onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                    onDrop={() => handleDrop(account.id)}
                    className={`card-swiss flex min-h-[188px] cursor-grab flex-col overflow-hidden bg-[var(--bg-main)] text-left transition-transform active:cursor-grabbing ${
                      draggedAccountID === account.id
                        ? 'translate-x-[-2px] translate-y-[-2px] border-[var(--text-primary)] bg-[var(--bg-surface)] opacity-60'
                        : 'hover:translate-x-[-2px] hover:translate-y-[-2px]'
                    }`}
                  >
                    <div className="flex min-h-[150px] flex-1">
                      <div className="flex w-16 shrink-0 flex-col justify-between border-r-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
                        <div className="px-2 py-3 text-center">
                          <div className="text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">#{index + 1}</div>
                          <div className="mt-2 font-mono text-3xl font-black leading-none text-[var(--text-primary)]">{index + 1}</div>
                        </div>
                        <div className="border-t border-dashed border-[var(--border-color)] px-2 py-2 text-center text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {t('accounts.rotation_drag_badge')}
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-3">
                            <h3 className="flex items-center gap-2 break-all text-[0.75rem] font-black uppercase leading-snug tracking-[0.08em] text-[var(--text-primary)]">
                              <div
                                className={`h-2 w-2 shrink-0 ${
                                  resolveAccountStatusTone(account) === 'positive'
                                    ? 'bg-green-500'
                                    : resolveAccountStatusTone(account) === 'warning'
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                }`}
                              />
                              <span className={account.credentialSource === 'auth-file' && account.email ? 'normal-case tracking-normal' : ''}>
                                {resolveAccountPrimaryLabel(account)}
                              </span>
                            </h3>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                {account.credentialSource}
                              </span>
                              <span className="border border-[var(--border-color)] px-2 py-1 font-mono text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
                                P{account.priority ?? 0}
                              </span>
                              {account.disabled ? (
                                <span className="border border-amber-600 bg-amber-500/10 px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.18em] text-amber-700">
                                  {t('accounts.rotation_disabled_badge')}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                              {t('accounts.rotation_drag_badge')}
                            </div>
                          </div>
                        </div>

                        <div className="mb-4 space-y-3 border-t border-dashed border-[var(--border-color)] pt-4">
                          <div className="truncate font-mono text-[0.625rem] font-bold text-[var(--text-muted)]">
                            {account.baseUrl || account.name || '--'}
                          </div>
                          <div className="space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[0.5rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                                {t('common.status')}
                              </div>
                              <div className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                {t('accounts.rotation_settings')}
                              </div>
                            </div>
                            <div
                              className={`text-[0.625rem] font-black uppercase leading-relaxed tracking-[0.12em] ${
                                account.disabled ? 'text-amber-700' : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {buildRotationParticipationSummary(account, codexQuotaByName[account.quotaKey || ''], t)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto grid gap-2 border-t border-dashed border-[var(--border-color)] pt-3">
                          {canToggleRotationAccountDisabled(account) ? (
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                              <div className="min-w-0">
                                <div className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                  {t('accounts.ui_base_url')}
                                </div>
                                <div className="truncate font-mono text-[0.5625rem] font-bold text-[var(--text-primary)]">
                                  {account.baseUrl || account.name || '--'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleToggleAccountDisabled(account)}
                                disabled={!ready || pendingStatusAccountID === account.id}
                                className="btn-swiss shrink-0 !px-3 !py-1.5 !text-[0.5rem] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingStatusAccountID === account.id
                                  ? t('common.loading')
                                  : account.disabled
                                    ? t('common.enable')
                                    : t('common.disable')}
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <div className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                {t('accounts.ui_base_url')}
                              </div>
                              <div className="truncate font-mono text-[0.5625rem] font-bold text-[var(--text-primary)]">
                                {account.baseUrl || account.name || '--'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-8 text-center text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {t('accounts.rotation_empty_accounts')}
              </div>
            )}
          </section>

          <section className="space-y-5 border-t-2 border-dashed border-[var(--border-color)] pt-8">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[0.625rem] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
                {t('status.routing_title')}
              </div>
              <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">{routingMessage}</div>
            </div>

            {routingDraft ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('status.routing_strategy')}
                    </span>
                    <div ref={strategyMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsStrategyMenuOpen((prev) => !prev)}
                        className="select-swiss flex items-center justify-between gap-3 text-left"
                        aria-haspopup="listbox"
                        aria-expanded={isStrategyMenuOpen}
                      >
                        <span>
                          {routingStrategyOptions.find((option) => option.value === routingDraft.strategy)?.label ||
                            routingDraft.strategy}
                        </span>
                        <span className="shrink-0 text-[0.625rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                          ▼
                        </span>
                      </button>
                      {isStrategyMenuOpen ? (
                        <div
                          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[6px_6px_0_var(--shadow-color)]"
                          role="listbox"
                        >
                          <div className="space-y-2">
                            {routingStrategyOptions.map((option) => {
                              const isSelected = routingDraft.strategy === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setRoutingDraft((prev) => (prev ? { ...prev, strategy: option.value } : prev));
                                    setIsStrategyMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between border-2 px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.12em] transition-transform ${
                                    isSelected
                                      ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                                      : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                                  }`}
                                  role="option"
                                  aria-selected={isSelected}
                                >
                                  <span>{option.label}</span>
                                  {isSelected ? <span className="text-[0.5rem] tracking-[0.18em]">ACTIVE</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </label>

                  <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('status.routing_session_affinity_ttl')}
                    </span>
                    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
                      <input
                        value={routingDraft.sessionAffinityTTL}
                        onChange={(event) =>
                          setRoutingDraft((prev) => (prev ? { ...prev, sessionAffinityTTL: event.target.value } : prev))
                        }
                        className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
                        placeholder="1h"
                      />
                    </div>
                  </label>

                  <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('status.routing_request_retry')}
                    </span>
                    <div className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
                      <input
                        value={String(routingDraft.requestRetry)}
                        onChange={(event) =>
                          setRoutingDraft((prev) =>
                            prev ? { ...prev, requestRetry: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                          )
                        }
                        className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
                        inputMode="numeric"
                        placeholder="2"
                      />
                      <span className="shrink-0 border-l-2 border-[var(--border-color)] pl-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        req
                      </span>
                    </div>
                  </label>

                  <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('status.routing_max_retry_credentials')}
                    </span>
                    <div className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
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
                        className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
                        inputMode="numeric"
                        placeholder="3"
                      />
                      <span className="shrink-0 border-l-2 border-[var(--border-color)] pl-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        keys
                      </span>
                    </div>
                  </label>

                  <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 md:col-span-2 xl:col-span-1">
                    <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('status.routing_max_retry_interval')}
                    </span>
                    <div className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
                      <input
                        value={String(routingDraft.maxRetryInterval)}
                        onChange={(event) =>
                          setRoutingDraft((prev) =>
                            prev ? { ...prev, maxRetryInterval: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                          )
                        }
                        className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
                        inputMode="numeric"
                        placeholder="30"
                      />
                      <span className="shrink-0 border-l-2 border-[var(--border-color)] pl-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        sec
                      </span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {routingToggleFields.map(([field, label]) => (
                    <label
                      key={field}
                      className="flex min-h-[76px] items-center justify-between gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
                    >
                      <div className="space-y-1">
                        <span className="block text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {t('common.status')}
                        </span>
                        <span className="block text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                          {label}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(routingDraft[field as keyof main.RelayRoutingConfig])}
                        onChange={(event) =>
                          setRoutingDraft((prev) =>
                            prev ? { ...prev, [field]: event.target.checked } : prev
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-[var(--text-primary)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
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
