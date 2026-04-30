import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_PAGE_STORAGE_KEY,
  ACCOUNT_WORKSPACE_STORAGE_KEY,
  USAGE_DESK_WORKSPACE_STORAGE_KEY,
  SESSION_MANAGEMENT_WORKSPACE_STORAGE_KEY,
  USAGE_DESK_SOURCE_STORAGE_KEY,
  USAGE_DESK_RANGE_STORAGE_KEY,
  buildFrameHash,
  isAccountWorkspace,
  isAppPage,
  isSessionManagementWorkspace,
  isUsageDeskRangeStorageValue,
  isUsageDeskSourceStorageValue,
  isUsageDeskWorkspace,
  persistAccountWorkspace,
  persistActivePage,
  persistSessionManagementWorkspace,
  persistUsageDeskRange,
  persistUsageDeskSource,
  persistUsageDeskWorkspace,
  readFrameHashState,
  readStoredAccountWorkspace,
  readStoredActivePage,
  readStoredSessionManagementWorkspace,
  readStoredUsageDeskRange,
  readStoredUsageDeskSource,
  readStoredUsageDeskWorkspace,
  resolveInitialAccountWorkspace,
  resolveInitialActivePage,
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
  assert.equal(isAppPage('usage-desk'), true);
  assert.equal(isAppPage('settings'), true);
  assert.equal(isAppPage('debug'), true);
  assert.equal(isAppPage('unknown'), false);
  assert.equal(isAppPage(null), false);
});

test('resolveInitialActivePage falls back to accounts for invalid values', () => {
  assert.equal(resolveInitialActivePage('settings'), 'settings');
  assert.equal(resolveInitialActivePage('session-management'), 'session-management');
  assert.equal(resolveInitialActivePage('vendor-status'), 'vendor-status');
  assert.equal(resolveInitialActivePage('proxy-pool'), 'proxy-pool');
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

  assert.equal(readStoredActivePage(storage), 'session-management');
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
  assert.deepEqual(readFrameHashState('#frame=session-management'), { page: 'session-management', sessionManagementWorkspace: 'codex' });
  assert.deepEqual(readFrameHashState('#frame=vendor-status'), { page: 'vendor-status' });
  assert.deepEqual(readFrameHashState('#frame=proxy-pool'), { page: 'proxy-pool' });
  assert.deepEqual(readFrameHashState('#frame=proxy-pool&workspace=codex'), { page: 'proxy-pool' });
  assert.deepEqual(readFrameHashState('#frame=usage-desk'), { page: 'usage-desk', usageDeskWorkspace: 'codex' });
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

test('readFrameHashState parses usage desk workspace and falls back to codex', () => {
  assert.deepEqual(readFrameHashState('#frame=usage-desk&workspace=gemini'), {
    page: 'usage-desk',
    usageDeskWorkspace: 'gemini',
  });
  assert.deepEqual(readFrameHashState('#frame=usage-desk&workspace=unknown'), {
    page: 'usage-desk',
    usageDeskWorkspace: 'codex',
  });
});

test('readFrameHashState parses session management workspace and falls back to codex', () => {
  assert.deepEqual(readFrameHashState('#frame=session-management&workspace=codex'), {
    page: 'session-management',
    sessionManagementWorkspace: 'codex',
  });
  assert.deepEqual(readFrameHashState('#frame=session-management&workspace=unknown'), {
    page: 'session-management',
    sessionManagementWorkspace: 'codex',
  });
});

test('readFrameHashState returns null for invalid hashes', () => {
  assert.equal(readFrameHashState(''), null);
  assert.equal(readFrameHashState('#workspace=codex'), null);
  assert.equal(readFrameHashState('#frame=unknown'), null);
  assert.equal(readFrameHashState(null), null);
});

test('buildFrameHash serializes page and optional accounts workspace', () => {
  assert.equal(buildFrameHash('status', 'all', 'codex', 'codex'), '#frame=status');
  assert.equal(buildFrameHash('session-management', 'all', 'codex', 'codex'), '#frame=session-management');
  assert.equal(buildFrameHash('vendor-status', 'all', 'codex', 'codex'), '#frame=vendor-status');
  assert.equal(buildFrameHash('proxy-pool', 'all', 'codex', 'codex'), '#frame=proxy-pool');
  assert.equal(buildFrameHash('usage-desk', 'all', 'codex', 'codex'), '#frame=usage-desk');
  assert.equal(buildFrameHash('usage-desk', 'all', 'codex', 'gemini'), '#frame=usage-desk&workspace=gemini');
  assert.equal(buildFrameHash('accounts', 'all', 'codex', 'codex'), '#frame=accounts');
  assert.equal(
    buildFrameHash('accounts', 'openai-compatible', 'codex', 'codex'),
    '#frame=accounts&workspace=openai-compatible',
  );
});
