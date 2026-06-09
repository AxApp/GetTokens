import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldEnsureAccountSnapshot,
  shouldShowAccountSkeletons,
} from '../model/accountSnapshot.ts';

test('shouldEnsureAccountSnapshot loads once when app data is ready and empty', () => {
  assert.equal(shouldEnsureAccountSnapshot({ ready: true, loaded: false, loading: false }), true);
});

test('shouldEnsureAccountSnapshot reuses app-level snapshot after accounts page remount', () => {
  assert.equal(shouldEnsureAccountSnapshot({ ready: true, loaded: true, loading: false }), false);
});

test('shouldEnsureAccountSnapshot avoids duplicate loads while a request is already pending', () => {
  assert.equal(shouldEnsureAccountSnapshot({ ready: true, loaded: false, loading: true }), false);
});

test('shouldEnsureAccountSnapshot waits until the app data source is ready', () => {
  assert.equal(shouldEnsureAccountSnapshot({ ready: false, loaded: false, loading: false }), false);
});

test('shouldShowAccountSkeletons only blocks the first empty snapshot', () => {
  assert.equal(shouldShowAccountSkeletons({ ready: false, loaded: false, accountCount: 0 }), true);
  assert.equal(shouldShowAccountSkeletons({ ready: false, loaded: false, accountCount: 2 }), false);
  assert.equal(shouldShowAccountSkeletons({ ready: true, loaded: false, accountCount: 0 }), true);
  assert.equal(shouldShowAccountSkeletons({ ready: true, loaded: false, accountCount: 2 }), false);
  assert.equal(shouldShowAccountSkeletons({ ready: true, loaded: true, accountCount: 2 }), false);
  assert.equal(shouldShowAccountSkeletons({ ready: true, loaded: true, accountCount: 0 }), false);
});
