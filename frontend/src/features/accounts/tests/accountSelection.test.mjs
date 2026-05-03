import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterSelectedAccountIDs,
  toggleAccountIDSelection,
  toggleAllFilteredAccountIDs,
} from '../model/accountSelection.ts';

test('filterSelectedAccountIDs drops ids that no longer exist', () => {
  assert.deepEqual(
    filterSelectedAccountIDs(['a', 'b', 'c'], ['b', 'c', 'd']),
    ['b', 'c']
  );
});

test('toggleAccountIDSelection removes existing id and appends missing id', () => {
  assert.deepEqual(toggleAccountIDSelection(['a', 'b'], 'b'), ['a']);
  assert.deepEqual(toggleAccountIDSelection(['a'], 'b'), ['a', 'b']);
});

test('toggleAllFilteredAccountIDs selects or clears only filtered items', () => {
  const filteredAccounts = [{ id: 'a' }, { id: 'b' }];

  assert.deepEqual(toggleAllFilteredAccountIDs(['x'], filteredAccounts, false), ['x', 'a', 'b']);
  assert.deepEqual(toggleAllFilteredAccountIDs(['x', 'a', 'b'], filteredAccounts, true), ['x']);
});
