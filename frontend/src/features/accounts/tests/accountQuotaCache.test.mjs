import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_QUOTA_CACHE_STORAGE_KEY,
  persistAccountQuotaStates,
  readStoredAccountQuotaStates,
} from '../model/accountQuotaCache.ts';

function createMemoryStorage(initial = {}) {
  const values = { ...initial };
  const writes = [];
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
      values[key] = value;
    },
    values,
    writes,
  };
}

test('readStoredAccountQuotaStates returns cached quota states for allowed keys', () => {
  const storage = createMemoryStorage({
    [ACCOUNT_QUOTA_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      items: {
        'plus.json': {
          quota: {
            planType: 'plus',
            windows: [{ id: 'weekly', label: '7D', remainingPercent: 80, resetLabel: '-' }],
          },
        },
        'other.json': {
          quota: {
            planType: 'free',
            windows: [],
          },
        },
      },
    }),
  });

  const states = readStoredAccountQuotaStates(storage, ['plus.json']);

  assert.deepEqual(Object.keys(states), ['plus.json']);
  assert.equal(states['plus.json'].status, 'success');
  assert.equal(states['plus.json'].quota.planType, 'plus');
});

test('persistAccountQuotaStates stores only states with quota payloads', () => {
  const storage = createMemoryStorage();

  persistAccountQuotaStates(storage, {
    'plus.json': {
      status: 'success',
      quota: {
        planType: 'plus',
        windows: [{ id: 'weekly', label: '7D', remainingPercent: 80, resetLabel: '-' }],
      },
    },
    'loading.json': { status: 'loading' },
    'error.json': { status: 'error' },
  });

  const parsed = JSON.parse(storage.values[ACCOUNT_QUOTA_CACHE_STORAGE_KEY]);
  assert.deepEqual(Object.keys(parsed.items), ['plus.json']);
  assert.equal(parsed.items['plus.json'].quota.planType, 'plus');
});

test('persistAccountQuotaStates skips localStorage writes when quota payloads are unchanged', () => {
  const quota = {
    planType: 'plus',
    windows: [{ id: 'weekly', label: '7D', remainingPercent: 80, resetLabel: '-' }],
  };
  const storage = createMemoryStorage({
    [ACCOUNT_QUOTA_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      items: {
        'plus.json': {
          quota,
          updatedAt: 1781000000000,
        },
      },
    }),
  });

  persistAccountQuotaStates(storage, {
    'plus.json': {
      status: 'success',
      quota: { ...quota, windows: [...quota.windows] },
    },
  });

  assert.equal(storage.writes.length, 0);
});

test('persistAccountQuotaStates writes when quota payloads change', () => {
  const storage = createMemoryStorage({
    [ACCOUNT_QUOTA_CACHE_STORAGE_KEY]: JSON.stringify({
      version: 1,
      items: {
        'plus.json': {
          quota: {
            planType: 'plus',
            windows: [{ id: 'weekly', label: '7D', remainingPercent: 80, resetLabel: '-' }],
          },
          updatedAt: 1781000000000,
        },
      },
    }),
  });

  persistAccountQuotaStates(storage, {
    'plus.json': {
      status: 'success',
      quota: {
        planType: 'plus',
        windows: [{ id: 'weekly', label: '7D', remainingPercent: 60, resetLabel: '-' }],
      },
    },
  });

  assert.equal(storage.writes.length, 1);
  const parsed = JSON.parse(storage.values[ACCOUNT_QUOTA_CACHE_STORAGE_KEY]);
  assert.equal(parsed.items['plus.json'].quota.windows[0].remainingPercent, 60);
});
