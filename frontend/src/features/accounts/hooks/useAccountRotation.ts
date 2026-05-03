import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { AccountRecord } from '../../../types';
import {
  buildPriorityUpdates,
  canToggleRotationAccountDisabled,
  reorderPriorityAccounts,
} from '../model/accountRotation';
import { compareAccountRecords } from '../model/accountPresentation';

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

export function useAccountRotation(
  accounts: AccountRecord[],
  ready: boolean,
  onReloadAccounts: () => Promise<void>,
) {
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

  function handleDrop(targetID: string) {
    if (!draggedAccountID) {
      return;
    }
    if (draggedAccountID !== targetID) {
      setOrderedAccounts((prev) => reorderPriorityAccounts(prev, draggedAccountID, targetID));
    }
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
    } catch (error) {
      console.error(error);
      setSaveMessage(toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return {
    orderedAccounts,
    draggedAccountID,
    setDraggedAccountID,
    routingConfig,
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
  };
}
