import { useState } from 'react';
import type { AccountRecord } from '../../../types';

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
