import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  cleanupSessionManagementSnapshotStorage,
  persistSessionManagementSnapshot,
  readStoredSessionManagementSnapshot,
} from './cache.ts';

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test('session management snapshot cache roundtrips a valid snapshot', () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createStorage();

  persistSessionManagementSnapshot('codex', {
    stats: {
      projectCount: 1,
      sessionCount: 2,
      activeSessionCount: 1,
      archivedSessionCount: 1,
      lastScanAt: '2026-04-30 23:41',
      providerSummary: 'openai 2',
    },
    projects: [
      {
        id: 'gettokens',
        name: 'GetTokens',
        sessionCount: 2,
        activeSessionCount: 1,
        archivedSessionCount: 1,
        lastActiveAt: '2026-04-30 23:40',
        providerSummary: 'openai 2',
        sessions: [],
      },
    ],
  });

  const snapshot = readStoredSessionManagementSnapshot('codex');
  assert.equal(snapshot?.stats.projectCount, 1);
  assert.equal(snapshot?.projects[0].name, 'GetTokens');
  assert.equal(readStoredSessionManagementSnapshot('claude'), null);

  globalThis.localStorage = originalLocalStorage;
});

test('session management snapshot hook disables WebView storage cache in Wails runtime', async () => {
  const source = await readFile(new URL('./useSessionManagementSnapshot.ts', import.meta.url), 'utf8');

  assert.match(source, /hasWailsAppBindings/);
  assert.match(source, /const browserSnapshotCacheEnabled = !hasWailsAppBindings\(\)/);
  assert.match(source, /cleanupSessionManagementSnapshotStorage\(\)/);
  assert.match(source, /readStoredSessionManagementSnapshot\(workspace, \{ enabled: browserSnapshotCacheEnabled \}\)/);
  assert.match(source, /persistSessionManagementSnapshot\(workspace, nextSnapshot, \{ enabled: browserSnapshotCacheEnabled \}\)/);
});

test('session management snapshot cache ignores invalid payloads', () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createStorage();
  globalThis.localStorage.setItem('gettokens.sessionManagement.snapshot.codex', '{invalid json');

  assert.equal(readStoredSessionManagementSnapshot('codex'), null);

  globalThis.localStorage = originalLocalStorage;
});

test('session management snapshot cache can be disabled for Wails runtime storage pressure', () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createStorage();

  persistSessionManagementSnapshot('codex', {
    stats: {
      projectCount: 1,
      sessionCount: 1,
      activeSessionCount: 1,
      archivedSessionCount: 0,
      lastScanAt: '2026-07-07 16:10',
      providerSummary: 'codex 1',
    },
    projects: [],
  }, { enabled: false });

  assert.equal(globalThis.localStorage.getItem('gettokens.sessionManagement.snapshot.codex'), null);
  assert.equal(readStoredSessionManagementSnapshot('codex', { enabled: false }), null);

  globalThis.localStorage.setItem('gettokens.sessionManagement.snapshot', 'legacy snapshot');
  globalThis.localStorage.setItem('gettokens.sessionManagement.snapshot.codex', 'codex snapshot');
  globalThis.localStorage.setItem('gettokens.sessionManagement.snapshot.claude', 'claude snapshot');

  cleanupSessionManagementSnapshotStorage(globalThis.localStorage);

  assert.equal(globalThis.localStorage.getItem('gettokens.sessionManagement.snapshot'), null);
  assert.equal(globalThis.localStorage.getItem('gettokens.sessionManagement.snapshot.codex'), null);
  assert.equal(globalThis.localStorage.getItem('gettokens.sessionManagement.snapshot.claude'), null);

  globalThis.localStorage = originalLocalStorage;
});
