import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_PAGE_STORAGE_KEY,
  ACCOUNT_WORKSPACE_STORAGE_KEY,
  isAccountWorkspace,
  isAppPage,
  persistAccountWorkspace,
  persistActivePage,
  readStoredAccountWorkspace,
  readStoredActivePage,
  resolveInitialAccountWorkspace,
  resolveInitialActivePage,
} from './pagePersistence.ts';

test('isAppPage only accepts known sidebar pages', () => {
  assert.equal(isAppPage('status'), true);
  assert.equal(isAppPage('accounts'), true);
  assert.equal(isAppPage('settings'), true);
  assert.equal(isAppPage('debug'), true);
  assert.equal(isAppPage('unknown'), false);
  assert.equal(isAppPage(null), false);
});

test('resolveInitialActivePage falls back to accounts for invalid values', () => {
  assert.equal(resolveInitialActivePage('settings'), 'settings');
  assert.equal(resolveInitialActivePage('unknown'), 'accounts');
  assert.equal(resolveInitialActivePage(null), 'accounts');
});

test('readStoredActivePage restores the last valid page from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, ACTIVE_PAGE_STORAGE_KEY);
      return 'debug';
    },
  };

  assert.equal(readStoredActivePage(storage), 'debug');
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

  persistActivePage(storage, 'status');

  assert.deepEqual(writes, [[ACTIVE_PAGE_STORAGE_KEY, 'status']]);
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
