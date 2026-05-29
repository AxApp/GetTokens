import { useMemo, useRef, type ReactNode } from 'react';
import type { SidecarStatus } from '../../types';
import { useDebug } from '../../context/useDebug';
import { useI18n } from '../../context/I18nContext';
import { hasWailsAppBindings } from '../../utils/previewMode';
import useAccountsPageState from './hooks/useAccountsPageState';
import { shouldLoadAccountsData } from './model/accountRuntime';
import { AccountsPageStateContext } from './AccountsPageStateContext';

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
