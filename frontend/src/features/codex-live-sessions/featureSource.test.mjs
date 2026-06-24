import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('codex live session detail uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./components/CodexLiveSessionDetail.tsx', import.meta.url), 'utf8');

  assert.match(source, /const codexLivePanelClass =/);
  assert.match(source, /from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /data-codex-live-detail-shell/);
  assert.match(source, /data-codex-live-overview-shell/);
  assert.match(source, /data-codex-live-timeline-shell/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /card-swiss/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /badge-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--gt-shadow-panel\)\]/);
});
