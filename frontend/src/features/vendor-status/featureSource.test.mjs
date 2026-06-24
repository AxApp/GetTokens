import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('vendor status feature uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./VendorStatusFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /const vendorStatusPanelClass =/);
  assert.match(source, /const vendorStatusPrimaryButtonClass =/);
  assert.match(source, /data-vendor-status-shell/);
  assert.match(source, /data-vendor-status-summary/);
  assert.match(source, /data-vendor-status-matrix/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.match(source, /shadow-sm/);
  assert.doesNotMatch(source, /card-swiss/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /\btransition(?![-\[])/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-(wide|wider|widest|tight|tighter|tightest|normal|\[)/);
  assert.match(source, /text-\[length:var\(--gt-font-size-sm\)\]/);
  assert.doesNotMatch(source, /!?text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--gt-shadow-panel\)\]/);
});
