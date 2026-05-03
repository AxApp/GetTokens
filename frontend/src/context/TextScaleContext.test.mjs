import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TEXT_SCALE_STORAGE_KEY,
  getTextScaleAttributeValue,
  isTextScale,
  persistTextScale,
  readStoredTextScale,
  resolveInitialTextScale,
} from './textScale.ts';

test('isTextScale only accepts supported text scale values', () => {
  assert.equal(isTextScale('default'), true);
  assert.equal(isTextScale('large'), true);
  assert.equal(isTextScale('x-large'), true);
  assert.equal(isTextScale('small'), false);
  assert.equal(isTextScale(null), false);
});

test('resolveInitialTextScale falls back to default for invalid values', () => {
  assert.equal(resolveInitialTextScale('default'), 'default');
  assert.equal(resolveInitialTextScale('large'), 'large');
  assert.equal(resolveInitialTextScale('x-large'), 'x-large');
  assert.equal(resolveInitialTextScale('small'), 'default');
  assert.equal(resolveInitialTextScale(null), 'default');
});

test('readStoredTextScale restores the last valid text scale from storage', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, TEXT_SCALE_STORAGE_KEY);
      return 'large';
    },
  };

  assert.equal(readStoredTextScale(storage), 'large');
});

test('readStoredTextScale falls back to default when storage is unavailable or invalid', () => {
  assert.equal(readStoredTextScale(null), 'default');
  assert.equal(
    readStoredTextScale({
      getItem() {
        return 'tiny';
      },
    }),
    'default'
  );
});

test('persistTextScale writes the selected text scale to storage', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistTextScale(storage, 'x-large');

  assert.deepEqual(writes, [[TEXT_SCALE_STORAGE_KEY, 'x-large']]);
});

test('getTextScaleAttributeValue uses stable attribute values for css hooks', () => {
  assert.equal(getTextScaleAttributeValue('default'), 'default');
  assert.equal(getTextScaleAttributeValue('large'), 'large');
  assert.equal(getTextScaleAttributeValue('x-large'), 'x-large');
});
