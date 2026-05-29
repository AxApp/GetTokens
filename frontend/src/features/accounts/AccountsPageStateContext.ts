import { createContext, useContext, type MutableRefObject } from 'react';
import type { SidecarStatus } from '../../types';
import type { AccountsPageState } from './hooks/useAccountsPageState';

export interface AccountsPageStateContextValue extends AccountsPageState {
  ready: boolean;
  sidecarStatus: SidecarStatus;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
}

export const AccountsPageStateContext = createContext<AccountsPageStateContextValue | null>(null);

export function useAccountsPageStateContext() {
  const context = useContext(AccountsPageStateContext);
  if (!context) {
    throw new Error('useAccountsPageStateContext must be used within AccountsPageStateProvider');
  }
  return context;
}
