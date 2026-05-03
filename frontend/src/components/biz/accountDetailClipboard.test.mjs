import test from 'node:test';
import assert from 'node:assert/strict';

import { canCopyRawContent, copyRawContent } from './accountDetailClipboard.ts';

test('canCopyRawContent returns false while loading or when content is blank', () => {
  assert.equal(canCopyRawContent('payload', true), false);
  assert.equal(canCopyRawContent('   ', false), false);
});

test('copyRawContent writes the full raw content when it is copyable', async () => {
  let copiedValue = '';
  const status = await copyRawContent('{\n  "token": "abc"\n}', {
    loading: false,
    writeText: async (value) => {
      copiedValue = value;
    },
  });

  assert.equal(status, 'success');
  assert.equal(copiedValue, '{\n  "token": "abc"\n}');
});

test('copyRawContent does not call clipboard writer for blank content', async () => {
  let writeCalled = false;
  const status = await copyRawContent('   ', {
    loading: false,
    writeText: async () => {
      writeCalled = true;
    },
  });

  assert.equal(status, 'error');
  assert.equal(writeCalled, false);
});
