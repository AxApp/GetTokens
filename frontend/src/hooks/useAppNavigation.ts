import { useEffect, useState } from 'react';
import type {
  AccountWorkspace,
  AppPage,
  SessionManagementWorkspace,
  UsageDeskWorkspace as UsageDeskWorkspaceID,
} from '../types';
import {
  buildFrameHash,
  persistAccountWorkspace,
  persistActivePage,
  persistSessionManagementWorkspace,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredAccountWorkspace,
  readStoredActivePage,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskWorkspace,
} from '../utils/pagePersistence';

export function useAppNavigation() {
  const [activePage, setActivePage] = useState<AppPage>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    return hashState?.page ?? readStoredActivePage(storage);
  });
  const [activeAccountWorkspace, setActiveAccountWorkspace] = useState<AccountWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredAccountWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'accounts') {
      return hashState.workspace ?? 'all';
    }
    return storedWorkspace;
  });
  const [activeSessionManagementWorkspace, setActiveSessionManagementWorkspace] = useState<SessionManagementWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredSessionManagementWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'session-management') {
      return hashState.sessionManagementWorkspace ?? 'codex';
    }
    return storedWorkspace;
  });
  const [activeUsageDeskWorkspace, setActiveUsageDeskWorkspace] = useState<UsageDeskWorkspaceID>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredUsageDeskWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'usage-desk') {
      return hashState.usageDeskWorkspace ?? 'codex';
    }
    return storedWorkspace;
  });

  useEffect(() => {
    persistActivePage(typeof window === 'undefined' ? null : window.localStorage, activePage);
  }, [activePage]);

  useEffect(() => {
    persistAccountWorkspace(typeof window === 'undefined' ? null : window.localStorage, activeAccountWorkspace);
  }, [activeAccountWorkspace]);

  useEffect(() => {
    persistSessionManagementWorkspace(
      typeof window === 'undefined' ? null : window.localStorage,
      activeSessionManagementWorkspace,
    );
  }, [activeSessionManagementWorkspace]);

  useEffect(() => {
    persistUsageDeskWorkspace(typeof window === 'undefined' ? null : window.localStorage, activeUsageDeskWorkspace);
  }, [activeUsageDeskWorkspace]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHash = buildFrameHash(
      activePage,
      activeAccountWorkspace,
      activeSessionManagementWorkspace,
      activeUsageDeskWorkspace,
    );
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [activeAccountWorkspace, activePage, activeSessionManagementWorkspace, activeUsageDeskWorkspace]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onHashChange = () => {
      const hashState = readFrameHashState(window.location.hash);
      if (!hashState) {
        return;
      }

      setActivePage(hashState.page);
      if (hashState.page === 'accounts') {
        setActiveAccountWorkspace(hashState.workspace ?? 'all');
      }
      if (hashState.page === 'session-management') {
        setActiveSessionManagementWorkspace(hashState.sessionManagementWorkspace ?? 'codex');
      }
      if (hashState.page === 'usage-desk') {
        setActiveUsageDeskWorkspace(hashState.usageDeskWorkspace ?? 'codex');
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return {
    activePage,
    setActivePage,
    activeAccountWorkspace,
    setActiveAccountWorkspace,
    activeSessionManagementWorkspace,
    setActiveSessionManagementWorkspace,
    activeUsageDeskWorkspace,
    setActiveUsageDeskWorkspace,
  };
}
