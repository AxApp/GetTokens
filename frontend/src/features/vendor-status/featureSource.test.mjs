import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('vendor status feature uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./VendorStatusFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /const vendorStatusPanelClass =/);
  assert.match(source, /const vendorStatusPrimaryButtonClass =/);
  assert.match(source, /data-vendor-status-shell/);
  assert.match(source, /data-vendor-status-hero/);
  assert.match(source, /data-vendor-status-matrix/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.match(source, /shadow-sm/);
  assert.doesNotMatch(source, /card-swiss/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-(wide|wider|widest|tight|tighter|tightest|normal|\[)/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--shadow-color\)\]/);
});
