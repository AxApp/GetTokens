import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_PAGE_STORAGE_KEY,
  ACCOUNT_WORKSPACE_STORAGE_KEY,
  CODEX_WORKSPACE_STORAGE_KEY,
  USAGE_DESK_WORKSPACE_STORAGE_KEY,
  SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY,
  USAGE_DESK_SOURCE_STORAGE_KEY,
  USAGE_DESK_RANGE_STORAGE_KEY,
  buildFrameHash,
  isAccountWorkspace,
  isAppPage,
  isCodexWorkspace,
  isSessionManagementWorkspace,
  isUsageDeskRangeStorageValue,
  isUsageDeskSourceStorageValue,
  isUsageDeskWorkspace,
  persistAccountWorkspace,
  persistActivePage,
  persistCodexWorkspace,
  persistSessionManagementWorkspace,
  persistUsageDeskRange,
  persistUsageDeskSource,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredAccountWorkspace,
  readStoredActivePage,
  readStoredCodexWorkspace,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskRange,
  readStoredUsageDeskSource,
  readStoredUsageDeskWorkspace,
  resolveInitialAccountWorkspace,
  resolveInitialActivePage,
  resolveInitialCodexWorkspace,
  resolveInitialSessionManagementWorkspace,
  resolveInitialUsageDeskRange,
  resolveInitialUsageDeskSource,
  resolveInitialUsageDeskWorkspace,
} from './pagePersistence.ts';

test('isAppPage only accepts known sidebar pages', () => {
  assert.equal(isAppPage('status'), true);
  assert.equal(isAppPage('accounts'), true);
  assert.equal(isAppPage('session-management'), true);
  assert.equal(isAppPage('vendor-status'), true);
  assert.equal(isAppPage('proxy-pool'), true);
  assert.equal(isAppPage('codex'), true);
  assert.equal(isAppPage('usage-desk'), true);
  assert.equal(isAppPage('settings'), true);
  assert.equal(isAppPage('debug'), true);
  assert.equal(isAppPage('unknown'), false);
  assert.equal(isAppPage(null), false);
});

test('resolveInitialActivePage falls back to accounts for invalid values', () => {
  assert.equal(resolveInitialActivePage('settings'), 'settings');
  assert.equal(resolveInitialActivePage('session-management'), 'codex');
  assert.equal(resolveInitialActivePage('vendor-status'), 'codex');
  assert.equal(resolveInitialActivePage('proxy-pool'), 'proxy-pool');
  assert.equal(resolveInitialActivePage('codex'), 'codex');
  assert.equal(resolveInitialActivePage('unknown'), 'accounts');
  assert.equal(resolveInitialActivePage(null), 'accounts');
});

test('readStoredActivePage restores the last valid page from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACTIVE_PAGE_STORAGE_KEY);
      return 'session-management';
    },
  };

  assert.equal(readStoredActivePage(storage), 'codex');
});

test('readStoredActivePage falls back when storage is unavailable or invalid', () => {
  assert.equal(readStoredActivePage(null), 'accounts');
  assert.equal(
    readStoredActivePage({
      getItem() {
        return 'invalid-page';
      },
    }),
    'accounts',
  );
});

test('persistActivePage writes the selected page to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistActivePage(storage, 'session-management');

  assert.deepEqual(writes, [[ACTIVE_PAGE_STORAGE_KEY, 'session-management']]);
});

test('isAccountWorkspace only accepts known account subpages', () => {
  assert.equal(isAccountWorkspace('all'), true);
  assert.equal(isAccountWorkspace('codex'), true);
  assert.equal(isAccountWorkspace('openai-compatible'), true);
  assert.equal(isAccountWorkspace('unknown'), false);
  assert.equal(isAccountWorkspace(null), false);
});

test('resolveInitialAccountWorkspace falls back to all for invalid values', () => {
  assert.equal(resolveInitialAccountWorkspace('all'), 'all');
  assert.equal(resolveInitialAccountWorkspace('openai-compatible'), 'openai-compatible');
  assert.equal(resolveInitialAccountWorkspace('unknown'), 'all');
  assert.equal(resolveInitialAccountWorkspace(null), 'all');
});

test('readStoredAccountWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACCOUNT_WORKSPACE_STORAGE_KEY);
      return 'openai-compatible';
    },
  };

  assert.equal(readStoredAccountWorkspace(storage), 'openai-compatible');
});

test('persistAccountWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistAccountWorkspace(storage, 'codex');

  assert.deepEqual(writes, [[ACCOUNT_WORKSPACE_STORAGE_KEY, 'codex']]);
});

test('isCodexWorkspace only accepts known codex subpages', () => {
  assert.equal(isCodexWorkspace('feature-config'), true);
  assert.equal(isCodexWorkspace('session-management'), true);
  assert.equal(isCodexWorkspace('vendor-status'), true);
  assert.equal(isCodexWorkspace('usage-codex'), true);
  assert.equal(isCodexWorkspace('usage-gemini'), false);
  assert.equal(isCodexWorkspace('unknown'), false);
  assert.equal(isCodexWorkspace(null), false);
});

test('resolveInitialCodexWorkspace falls back to feature config for invalid values', () => {
  assert.equal(resolveInitialCodexWorkspace('feature-config'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace('session-management'), 'session-management');
  assert.equal(resolveInitialCodexWorkspace('vendor-status'), 'vendor-status');
  assert.equal(resolveInitialCodexWorkspace('usage-codex'), 'usage-codex');
  assert.equal(resolveInitialCodexWorkspace('usage-gemini'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace('unknown'), 'feature-config');
  assert.equal(resolveInitialCodexWorkspace(null), 'feature-config');
});

test('readStoredCodexWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, CODEX_WORKSPACE_STORAGE_KEY);
      return 'feature-config';
    },
  };

  assert.equal(readStoredCodexWorkspace(storage), 'feature-config');
});

test('persistCodexWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistCodexWorkspace(storage, 'feature-config');

  assert.deepEqual(writes, [[CODEX_WORKSPACE_STORAGE_KEY, 'feature-config']]);
});

test('isSessionManagementWorkspace only accepts known session management subpages', () => {
  assert.equal(isSessionManagementWorkspace('codex'), true);
  assert.equal(isSessionManagementWorkspace('unknown'), false);
  assert.equal(isSessionManagementWorkspace(null), false);
});

test('resolveInitialSessionManagementWorkspace falls back to codex for invalid values', () => {
  assert.equal(resolveInitialSessionManagementWorkspace('codex'), 'codex');
  assert.equal(resolveInitialSessionManagementWorkspace('unknown'), 'codex');
  assert.equal(resolveInitialSessionManagementWorkspace(null), 'codex');
});

test('readStoredSessionManagementWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY);
      return 'codex';
    },
  };

  assert.equal(readStoredSessionManagementWorkspace(storage), 'codex');
});

test('persistSessionManagementWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistSessionManagementWorkspace(storage, 'codex');

  assert.deepEqual(writes, [[SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY, 'codex']]);
});

test('isUsageDeskWorkspace only accepts known usage desk subpages', () => {
  assert.equal(isUsageDeskWorkspace('codex'), true);
  assert.equal(isUsageDeskWorkspace('gemini'), true);
  assert.equal(isUsageDeskWorkspace('unknown'), false);
  assert.equal(isUsageDeskWorkspace(null), false);
});

test('resolveInitialUsageDeskWorkspace falls back to codex for invalid values', () => {
  assert.equal(resolveInitialUsageDeskWorkspace('codex'), 'codex');
  assert.equal(resolveInitialUsageDeskWorkspace('gemini'), 'gemini');
  assert.equal(resolveInitialUsageDeskWorkspace('unknown'), 'codex');
  assert.equal(resolveInitialUsageDeskWorkspace(null), 'codex');
});

test('readStoredUsageDeskWorkspace restores the last valid workspace from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, USAGE_DESK_WORKSPACE_STORAGE_KEY);
      return 'gemini';
    },
  };

  assert.equal(readStoredUsageDeskWorkspace(storage), 'gemini');
});

test('persistUsageDeskWorkspace writes the selected workspace to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistUsageDeskWorkspace(storage, 'gemini');

  assert.deepEqual(writes, [[USAGE_DESK_WORKSPACE_STORAGE_KEY, 'gemini']]);
});

test('isUsageDeskSourceStorageValue only accepts known usage desk source values', () => {
  assert.equal(isUsageDeskSourceStorageValue('observed'), true);
  assert.equal(isUsageDeskSourceStorageValue('projected'), true);
  assert.equal(isUsageDeskSourceStorageValue('unknown'), false);
  assert.equal(isUsageDeskSourceStorageValue(null), false);
});

test('resolveInitialUsageDeskSource falls back to observed for invalid values', () => {
  assert.equal(resolveInitialUsageDeskSource('observed'), 'observed');
  assert.equal(resolveInitialUsageDeskSource('projected'), 'projected');
  assert.equal(resolveInitialUsageDeskSource('unknown'), 'observed');
  assert.equal(resolveInitialUsageDeskSource(null), 'observed');
});

test('readStoredUsageDeskSource restores the last valid source from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, USAGE_DESK_SOURCE_STORAGE_KEY);
      return 'projected';
    },
  };

  assert.equal(readStoredUsageDeskSource(storage), 'projected');
});

test('persistUsageDeskSource writes the selected source to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistUsageDeskSource(storage, 'projected');

  assert.deepEqual(writes, [[USAGE_DESK_SOURCE_STORAGE_KEY, 'projected']]);
});

test('isUsageDeskRangeStorageValue only accepts known usage desk range values', () => {
  assert.equal(isUsageDeskRangeStorageValue('TODAY'), true);
  assert.equal(isUsageDeskRangeStorageValue('7D'), true);
  assert.equal(isUsageDeskRangeStorageValue('14D'), true);
  assert.equal(isUsageDeskRangeStorageValue('30D'), true);
  assert.equal(isUsageDeskRangeStorageValue('全部'), true);
  assert.equal(isUsageDeskRangeStorageValue('unknown'), false);
  assert.equal(isUsageDeskRangeStorageValue(null), false);
});

test('resolveInitialUsageDeskRange falls back to 7D for invalid values', () => {
  assert.equal(resolveInitialUsageDeskRange('TODAY'), 'TODAY');
  assert.equal(resolveInitialUsageDeskRange('全部'), '全部');
  assert.equal(resolveInitialUsageDeskRange('unknown'), '7D');
  assert.equal(resolveInitialUsageDeskRange(null), '7D');
});

test('readStoredUsageDeskRange restores the last valid range from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, USAGE_DESK_RANGE_STORAGE_KEY);
      return '30D';
    },
  };

  assert.equal(readStoredUsageDeskRange(storage), '30D');
});

test('persistUsageDeskRange writes the selected range to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistUsageDeskRange(storage, 'TODAY');

  assert.deepEqual(writes, [[USAGE_DESK_RANGE_STORAGE_KEY, 'TODAY']]);
});

test('readFrameHashState parses top-level frame pages', () => {
  assert.deepEqual(readFrameHashState('#frame=status'), { page: 'status' });
  assert.deepEqual(readFrameHashState('#frame=session-management'), { page: 'codex', codexWorkspace: 'session-management' });
  assert.deepEqual(readFrameHashState('#frame=vendor-status'), { page: 'codex', codexWorkspace: 'vendor-status' });
  assert.deepEqual(readFrameHashState('#frame=proxy-pool'), { page: 'proxy-pool' });
  assert.deepEqual(readFrameHashState('#frame=proxy-pool&workspace=codex'), { page: 'proxy-pool' });
  assert.deepEqual(readFrameHashState('#frame=codex'), { page: 'codex', codexWorkspace: 'feature-config' });
  assert.deepEqual(readFrameHashState('#frame=usage-desk'), { page: 'codex', codexWorkspace: 'usage-codex' });
  assert.deepEqual(readFrameHashState('#frame=settings'), { page: 'settings' });
});

test('readFrameHashState parses accounts workspace and falls back to all', () => {
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=codex'), {
    page: 'accounts',
    workspace: 'codex',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts'), {
    page: 'accounts',
    workspace: 'all',
  });
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=unknown'), {
    page: 'accounts',
    workspace: 'all',
  });
});

test('readFrameHashState parses codex workspace and falls back to feature config', () => {
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=feature-config'), {
    page: 'codex',
    codexWorkspace: 'feature-config',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=session-management'), {
    page: 'codex',
    codexWorkspace: 'session-management',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=vendor-status'), {
    page: 'codex',
    codexWorkspace: 'vendor-status',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=usage-codex'), {
    page: 'codex',
    codexWorkspace: 'usage-codex',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=usage-gemini'), {
    page: 'codex',
    codexWorkspace: 'feature-config',
  });
  assert.deepEqual(readFrameHashState('#frame=codex&workspace=unknown'), {
    page: 'codex',
    codexWorkspace: 'feature-config',
  });
});

test('readFrameHashState migrates legacy usage desk routes to codex usage', () => {
  assert.deepEqual(readFrameHashState('#frame=usage-desk&workspace=gemini'), {
    page: 'codex',
    codexWorkspace: 'usage-codex',
  });
  assert.deepEqual(readFrameHashState('#frame=usage-desk&workspace=unknown'), {
    page: 'codex',
    codexWorkspace: 'usage-codex',
  });
});

test('readFrameHashState parses session management workspace and falls back to codex', () => {
  assert.deepEqual(readFrameHashState('#frame=session-management&workspace=codex'), {
    page: 'codex',
    codexWorkspace: 'session-management',
  });
  assert.deepEqual(readFrameHashState('#frame=session-management&workspace=unknown'), {
    page: 'codex',
    codexWorkspace: 'session-management',
  });
});

test('readFrameHashState returns null for invalid hashes', () => {
  assert.equal(readFrameHashState(''), null);
  assert.equal(readFrameHashState('#workspace=codex'), null);
  assert.equal(readFrameHashState('#frame=unknown'), null);
  assert.equal(readFrameHashState(null), null);
});

test('buildFrameHash serializes page and optional accounts workspace', () => {
  assert.equal(buildFrameHash('status', 'all', 'feature-config', 'codex', 'codex'), '#frame=status');
  assert.equal(
    buildFrameHash('codex', 'all', 'session-management', 'codex', 'codex'),
    '#frame=codex&workspace=session-management',
  );
  assert.equal(
    buildFrameHash('codex', 'all', 'vendor-status', 'codex', 'codex'),
    '#frame=codex&workspace=vendor-status',
  );
  assert.equal(buildFrameHash('vendor-status', 'all', 'feature-config', 'codex', 'codex'), '#frame=vendor-status');
  assert.equal(buildFrameHash('proxy-pool', 'all', 'feature-config', 'codex', 'codex'), '#frame=proxy-pool');
  assert.equal(buildFrameHash('codex', 'all', 'feature-config', 'codex', 'codex'), '#frame=codex');
  assert.equal(
    buildFrameHash('codex', 'all', 'usage-codex', 'codex', 'codex'),
    '#frame=codex&workspace=usage-codex',
  );
  assert.equal(buildFrameHash('accounts', 'all', 'feature-config', 'codex', 'codex'), '#frame=accounts');
  assert.equal(
    buildFrameHash('accounts', 'openai-compatible', 'feature-config', 'codex', 'codex'),
    '#frame=accounts&workspace=openai-compatible',
  );
});
