import { createContext, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { SidecarStatus } from '../../types';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import { hasWailsAppBindings } from '../../utils/previewMode';
import useAccountsPageState, { type AccountsPageState } from './hooks/useAccountsPageState';
import { shouldLoadAccountsData } from './model/accountRuntime';

interface AccountsPageStateContextValue extends AccountsPageState {
  ready: boolean;
  sidecarStatus: SidecarStatus;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
}

const AccountsPageStateContext = createContext<AccountsPageStateContextValue | null>(null);

export function AccountsPageStateProvider({
  sidecarStatus,
  children,
}: {
  sidecarStatus: SidecarStatus;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const headerActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const ready = shouldLoadAccountsData(sidecarStatus, hasWailsAppBindings());
  const accountsPageState = useAccountsPageState({
    ready,
    t,
    trackRequest,
    headerActionsMenuRef,
  });
  const value = useMemo(
    () => ({
      ...accountsPageState,
      ready,
      sidecarStatus,
      headerActionsMenuRef,
    }),
    [accountsPageState, ready, sidecarStatus],
  );

  return <AccountsPageStateContext.Provider value={value}>{children}</AccountsPageStateContext.Provider>;
}

export function useAccountsPageStateContext() {
  const context = useContext(AccountsPageStateContext);
  if (!context) {
    throw new Error('useAccountsPageStateContext must be used within AccountsPageStateProvider');
  }
  return context;
}
