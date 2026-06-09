import { useState } from 'react';
import type { AccountRecord } from '../../../types';
import { supportsQuota } from './accountQuota.ts';
import { canToggleRotationAccountDisabled } from './accountRotation.ts';

export type AccountBulkActionID = 'refresh' | 'enable' | 'disable' | 'delete';

export interface BulkAccountTargetResolution {
  targets: AccountRecord[];
  skipped: AccountRecord[];
}

export function filterSelectedAccountIDs(selectedAccountIDs: string[], validAccountIDs: Iterable<string>) {
  const validIDs = new Set(validAccountIDs);
  return selectedAccountIDs.filter((id) => validIDs.has(id));
}

export function toggleAccountIDSelection(selectedAccountIDs: string[], accountID: string) {
  return selectedAccountIDs.includes(accountID)
    ? selectedAccountIDs.filter((id) => id !== accountID)
    : [...selectedAccountIDs, accountID];
}

export function toggleAllFilteredAccountIDs(
  selectedAccountIDs: string[],
  filteredAccounts: AccountRecord[],
  allFilteredSelected: boolean
) {
  const next = new Set(selectedAccountIDs);
  if (allFilteredSelected) {
    filteredAccounts.forEach((account) => next.delete(account.id));
  } else {
    filteredAccounts.forEach((account) => next.add(account.id));
  }
  return [...next];
}

export function areAllAccountIDsSelected(selectedAccountIDs: string[], accounts: AccountRecord[]) {
  return accounts.length > 0 && accounts.every((account) => selectedAccountIDs.includes(account.id));
}

export function toggleAccountGroupSelection(selectedAccountIDs: string[], accounts: AccountRecord[]) {
  return toggleAllFilteredAccountIDs(
    selectedAccountIDs,
    accounts,
    areAllAccountIDsSelected(selectedAccountIDs, accounts),
  );
}

export function resolveBulkQuotaRefreshTargets(selectedAccounts: AccountRecord[]): BulkAccountTargetResolution {
  const targets: AccountRecord[] = [];
  const skipped: AccountRecord[] = [];

  selectedAccounts.forEach((account) => {
    if (supportsQuota(account) && Boolean(String(account.quotaKey || '').trim())) {
      targets.push(account);
      return;
    }
    skipped.push(account);
  });

  return { targets, skipped };
}

export function resolveBulkSetDisabledTargets(
  selectedAccounts: AccountRecord[],
  nextDisabled: boolean,
): BulkAccountTargetResolution {
  const targets: AccountRecord[] = [];
  const skipped: AccountRecord[] = [];

  selectedAccounts.forEach((account) => {
    const canToggle = canToggleRotationAccountDisabled(account);
    const alreadyMatches = Boolean(account.disabled) === nextDisabled;
    if (canToggle && !alreadyMatches) {
      targets.push(account);
      return;
    }
    skipped.push(account);
  });

  return { targets, skipped };
}

export function resolveBulkDeleteTargets(selectedAccounts: AccountRecord[]): BulkAccountTargetResolution {
  const targets: AccountRecord[] = [];
  const skipped: AccountRecord[] = [];

  selectedAccounts.forEach((account) => {
    const accountID = String(account.id || '').trim();
    if (accountID.startsWith('acct_')) {
      targets.push(account);
      return;
    }
    skipped.push(account);
  });

  return { targets, skipped };
}

export function useAccountSelectionState() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAccountIDs, setSelectedAccountIDs] = useState<string[]>([]);

  function toggleAccountSelection(accountID: string) {
    setSelectedAccountIDs((prev) => toggleAccountIDSelection(prev, accountID));
  }

  function toggleSelectAllFiltered(filteredAccounts: AccountRecord[], allFilteredSelected: boolean) {
    setSelectedAccountIDs((prev) => toggleAllFilteredAccountIDs(prev, filteredAccounts, allFilteredSelected));
  }

  function toggleSelectionMode() {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedAccountIDs([]);
      }
      return !prev;
    });
  }

  return {
    isSelectionMode,
    selectedAccountIDs,
    setSelectedAccountIDs,
    toggleAccountSelection,
    toggleSelectAllFiltered,
    toggleSelectionMode,
  };
}
