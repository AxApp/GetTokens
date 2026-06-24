import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { canCopyRawContent, copyRawContent } from './accountDetailClipboard.ts';

test('legacy account detail modal uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./AccountDetailModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const accountDetailModalOverlayClass =/);
  assert.match(source, /const accountDetailModalPanelClass =/);
  assert.match(source, /const accountDetailModalHeaderClass =/);
  assert.match(source, /import \{ Button \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /const accountDetailModalFieldLabelClass =/);
  assert.match(source, /const accountDetailModalRawContentClass =/);
  assert.match(source, /data-account-detail-modal="quiet"/);
  assert.match(source, /data-account-detail-modal-raw-content="quiet"/);
  assert.match(source, /text-\[length:var\(--gt-font-size-sm\)\]/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.doesNotMatch(source, /shadow-(?:lg|xl|2xl)|drop-shadow/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2/);
  assert.doesNotMatch(source, /border-b-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /\btext-sm\b/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[/);
  assert.doesNotMatch(source, /shadow-hard/);
});

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
