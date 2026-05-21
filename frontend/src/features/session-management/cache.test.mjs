import test from 'node:test';
import assert from 'node:assert/strict';

import {
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

test('session management snapshot cache ignores invalid payloads', () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createStorage();
  globalThis.localStorage.setItem('gettokens.sessionManagement.snapshot.codex', '{invalid json');

  assert.equal(readStoredSessionManagementSnapshot('codex'), null);

  globalThis.localStorage = originalLocalStorage;
});
