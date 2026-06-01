import { useEffect, useState } from 'react';
import type {
  AppPage,
  ClaudeWorkspace,
  CodexWorkspace,
  SessionManagementWorkspace,
  UsageDeskWorkspace as UsageDeskWorkspaceID,
} from '../types';
import {
  ACTIVE_PAGE_STORAGE_KEY,
  CODEX_WORKSPACE_STORAGE_KEY,
  buildFrameHash,
  codexWorkspaceFromUsageDeskWorkspace,
  isLegacyClaudeCodexWorkspace,
  persistActivePage,
  persistClaudeWorkspace,
  persistCodexWorkspace,
  persistSessionManagementWorkspace,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredActivePage,
  readStoredClaudeWorkspace,
  readStoredCodexWorkspace,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskWorkspace,
} from '../utils/pagePersistence';

export function useAppNavigation() {
  const pageAvailabilityOptions = { includeDeveloperPages: import.meta.env.DEV };
  const [activePage, setActivePage] = useState<AppPage>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash, pageAvailabilityOptions);
    if (!hashState && isLegacyClaudeCodexWorkspace(storage?.getItem(CODEX_WORKSPACE_STORAGE_KEY))) {
      return 'claude';
    }
    return hashState?.page ?? readStoredActivePage(storage, pageAvailabilityOptions);
  });
  const [activeCodexWorkspace, setActiveCodexWorkspace] = useState<CodexWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredCodexWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash, pageAvailabilityOptions);
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
  const [activeClaudeWorkspace, setActiveClaudeWorkspace] = useState<ClaudeWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredClaudeWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash, pageAvailabilityOptions);
    if (hashState?.page === 'claude') {
      return hashState.claudeWorkspace ?? 'account-list';
    }
    return storedWorkspace;
  });
  const [activeSessionManagementWorkspace, setActiveSessionManagementWorkspace] = useState<SessionManagementWorkspace>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredSessionManagementWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash, pageAvailabilityOptions);
    if (hashState?.page === 'session-management') {
      return hashState.sessionManagementWorkspace ?? 'codex';
    }
    return storedWorkspace;
  });
  const [activeUsageDeskWorkspace, setActiveUsageDeskWorkspace] = useState<UsageDeskWorkspaceID>(() => {
    const storage = typeof window === 'undefined' ? null : window.localStorage;
    const storedWorkspace = readStoredUsageDeskWorkspace(storage);
    const hashState = typeof window === 'undefined' ? null : readFrameHashState(window.location.hash, pageAvailabilityOptions);
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
    persistClaudeWorkspace(typeof window === 'undefined' ? null : window.localStorage, activeClaudeWorkspace);
  }, [activeClaudeWorkspace]);

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

    const hashState = readFrameHashState(window.location.hash, pageAvailabilityOptions);
    let detailID: string | null = null;
    if (shouldPreserveDetailHash(
      hashState,
      activePage,
      activeCodexWorkspace,
      activeClaudeWorkspace,
    )) {
      detailID = hashState?.accountDetailID ?? null;
    }
    const modal = shouldPreserveModalHash(hashState, activePage, activeCodexWorkspace, activeClaudeWorkspace)
      ? hashState?.modal ?? null
      : null;
    const nextHash = buildFrameHash(
      activePage,
      'all' as const,
      activeCodexWorkspace,
      activeSessionManagementWorkspace,
      activeUsageDeskWorkspace,
      detailID,
      {
        accountDetailScript: hashState?.accountDetailScript ?? null,
        claudeWorkspace: activeClaudeWorkspace,
        density: activePage === 'accounts' ? readCurrentHashParam('density') : null,
        group: activePage === 'accounts' ? readCurrentHashParam('group') : null,
        modal,
        sort: activePage === 'accounts' ? readCurrentHashParam('sort') : null,
      },
    );
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [
    activeClaudeWorkspace,
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
      const hashState = readFrameHashState(window.location.hash, pageAvailabilityOptions);
      if (!hashState) {
        return;
      }

      const canonicalHash = buildCanonicalFrameHashFromState(hashState);
      if (window.location.hash !== canonicalHash) {
        window.location.hash = canonicalHash;
      }

      setActivePage(hashState.page);
      if (hashState.page === 'codex') {
        setActiveCodexWorkspace(hashState.codexWorkspace ?? 'feature-config');
      }
      if (hashState.page === 'claude') {
        setActiveClaudeWorkspace(hashState.claudeWorkspace ?? 'account-list');
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
    activeClaudeWorkspace,
    setActiveClaudeWorkspace,
    activeSessionManagementWorkspace,
    setActiveSessionManagementWorkspace,
    activeUsageDeskWorkspace,
    setActiveUsageDeskWorkspace,
  };
}

function buildCanonicalFrameHashFromState(hashState: NonNullable<ReturnType<typeof readFrameHashState>>): string {
  return buildFrameHash(
    hashState.page,
    hashState.workspace ?? 'all',
    hashState.codexWorkspace ?? 'feature-config',
    hashState.sessionManagementWorkspace ?? 'codex',
    hashState.usageDeskWorkspace ?? 'codex',
    hashState.accountDetailID ?? null,
    {
      accountDetailScript: hashState.accountDetailScript ?? null,
      claudeWorkspace: hashState.claudeWorkspace ?? 'account-list',
      density: hashState.page === 'accounts' ? readCurrentHashParam('density') : null,
      group: hashState.page === 'accounts' ? readCurrentHashParam('group') : null,
      modal: hashState.modal ?? null,
      sort: hashState.page === 'accounts' ? readCurrentHashParam('sort') : null,
    },
  );
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
  activeClaudeWorkspace: ClaudeWorkspace,
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
  if (activePage === 'claude') {
    return (hashState.claudeWorkspace ?? 'account-list') === activeClaudeWorkspace;
  }
  return false;
}

function shouldPreserveModalHash(
  hashState: ReturnType<typeof readFrameHashState>,
  activePage: AppPage,
  activeCodexWorkspace: CodexWorkspace,
  activeClaudeWorkspace: ClaudeWorkspace,
) {
  if (!hashState?.modal || hashState.page !== activePage) {
    return false;
  }
  if (activePage === 'codex') {
    return (hashState.codexWorkspace ?? 'feature-config') === activeCodexWorkspace;
  }
  if (activePage === 'claude') {
    return (hashState.claudeWorkspace ?? 'account-list') === activeClaudeWorkspace;
  }
  return false;
}
