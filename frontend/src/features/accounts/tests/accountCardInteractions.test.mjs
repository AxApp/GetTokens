import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions.ts';

function node(tagName, parentElement = null, dataset) {
  return { tagName, parentElement, dataset };
}

test('shouldOpenAccountDetailsFromTarget allows plain card body clicks', () => {
  const card = node('div');
  const content = node('div', card);

  assert.equal(shouldOpenAccountDetailsFromTarget(content, card), true);
});

test('shouldOpenAccountDetailsFromTarget ignores direct interactive elements', () => {
  const card = node('div');
  const button = node('button', card);

  assert.equal(shouldOpenAccountDetailsFromTarget(button, card), false);
});

test('shouldOpenAccountDetailsFromTarget ignores nested elements inside buttons', () => {
  const card = node('div');
  const button = node('button', card);
  const icon = node('span', button);

  assert.equal(shouldOpenAccountDetailsFromTarget(icon, card), false);
});

test('shouldOpenAccountDetailsFromTarget respects explicit ignore markers', () => {
  const card = node('div');
  const wrapper = node('div', card, { accountCardIgnoreClick: 'true' });
  const inner = node('span', wrapper);

  assert.equal(shouldOpenAccountDetailsFromTarget(inner, card), false);
});
