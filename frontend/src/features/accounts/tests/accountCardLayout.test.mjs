import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countRenderedGridColumns,
  shouldEqualizeAccountCardGrid,
} from '../model/accountCardLayout.ts';

test('countRenderedGridColumns counts expanded CSS grid tracks', () => {
  assert.equal(countRenderedGridColumns('556px'), 1);
  assert.equal(countRenderedGridColumns('348px 348px 348px'), 3);
  assert.equal(countRenderedGridColumns('minmax(0px, 1fr) minmax(0px, 1fr)'), 2);
  assert.equal(countRenderedGridColumns('none'), 0);
});

test('shouldEqualizeAccountCardGrid only equalizes actual multi-column card grids', () => {
  assert.equal(shouldEqualizeAccountCardGrid('556px', 6), false);
  assert.equal(shouldEqualizeAccountCardGrid('348px 348px 348px', 6), true);
  assert.equal(shouldEqualizeAccountCardGrid('348px 348px 348px', 1), false);
});
