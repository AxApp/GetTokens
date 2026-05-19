import { useEffect, useState } from 'react';
import type {
  AppPage,
  CodexWorkspace,
  SessionManagementWorkspace,
  UsageDeskWorkspace as UsageDeskWorkspaceID,
} from '../types';
import {
  ACTIVE_PAGE_STORAGE_KEY,
  buildFrameHash,
  codexWorkspaceFromUsageDeskWorkspace,
  persistActivePage,
  persistCodexWorkspace,
  persistSessionManagementWorkspace,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredActivePage,
  readStoredCodexWorkspace,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskWorkspace,
} from '../utils/pagePersistence';

export function useAppNavigation() {
  const [activePage, setActivePage] = useState<AppPage>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    return hashState?.page ?? readStoredActivePage(storage);
  });
  const [activeCodexWorkspace, setActiveCodexWorkspace] = useState<CodexWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredCodexWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash);
    if (hashState?.page === 'codex') {
      return hashState.codexWorkspace ?? 'feature-config';
    }
    if (storage?.getItem(ACTIVE_PAGE_STORAGE_KEY) === 'session-management') {
      return 'session-management';
    }
    if (storage?.getItem(ACTIVE_PAGE_STORAGE_KEY) === 'vendor-status') {
      return 'vendor-status';
    }
    if (storage?.getItem(ACTIVE_PAGE_STORAGE_KEY) === 'usage-desk') {
      return codexWorkspaceFromUsageDeskWorkspace(readStoredUsageDeskWorkspace(storage));
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
    persistCodexWorkspace(typeof window === 'undefined' ? null : window.localStorage, activeCodexWorkspace);
  }, [activeCodexWorkspace]);

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

    const hashState = readFrameHashState(window.location.hash);
    let detailID: string | null = null;
    if (shouldPreserveDetailHash(
      hashState,
      activePage,
      activeCodexWorkspace,
    )) {
      detailID = hashState?.accountDetailID ?? null;
    }
    const nextHash = buildFrameHash(
      activePage,
      'all' as const,
      activeCodexWorkspace,
      activeSessionManagementWorkspace,
      activeUsageDeskWorkspace,
      detailID,
      { density: activePage === 'accounts' ? readCurrentHashParam('density') : null },
    );
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [
    activeCodexWorkspace,
    activePage,
    activeSessionManagementWorkspace,
    activeUsageDeskWorkspace,
  ]);

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
      if (hashState.page === 'codex') {
        setActiveCodexWorkspace(hashState.codexWorkspace ?? 'feature-config');
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
    activeCodexWorkspace,
    setActiveCodexWorkspace,
    activeSessionManagementWorkspace,
    setActiveSessionManagementWorkspace,
    activeUsageDeskWorkspace,
    setActiveUsageDeskWorkspace,
  };
}

function readCurrentHashParam(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const normalized = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(normalized).get(key);
}

function shouldPreserveDetailHash(
  hashState: ReturnType<typeof readFrameHashState>,
  activePage: AppPage,
  activeCodexWorkspace: CodexWorkspace,
) {
  if (!hashState?.accountDetailID || hashState.page !== activePage) {
    return false;
  }
  if (activePage === 'accounts') {
    return true;
  }
  if (activePage === 'codex') {
    return (hashState.codexWorkspace ?? 'feature-config') === activeCodexWorkspace;
  }
  return false;
}
