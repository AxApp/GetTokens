import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyTextScaleVariables,
  textScaleOptionIDs,
  textScaleVariablesById,
} from './settingsTextScale.ts';

test('textScaleOptionIDs keep expected order', () => {
  assert.deepEqual(textScaleOptionIDs, ['default', 'large', 'x-large']);
});

test('applyTextScaleVariables writes first-batch segmented control tokens', () => {
  const applied = new Map();
  const style = {
    setProperty(name, value) {
      applied.set(name, value);
    },
  };

  applyTextScaleVariables(style, 'x-large');

  assert.deepEqual(Object.fromEntries(applied), textScaleVariablesById['x-large']);
});
