import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('SessionPluginConsolePanel uses the quiet workspace component shell', async () => {
  const source = await readFile(new URL('./components/SessionPluginConsolePanel.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-session-plugin-console-panel="true"/);
  assert.match(source, /data-session-plugin-console-plugin-list="true"/);
  assert.match(source, /data-session-plugin-console-output="true"/);
  assert.match(source, /const sessionPluginConsoleButtonClass = 'inline-flex h-9 items-center justify-center rounded border border-\[var\(--gt-border-subtle\)\]/);
  assert.match(source, /rounded-md border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\] shadow-\[var\(--gt-elevation-raised-2\)\]/);
  assert.match(source, /function PanelHead/);
  assert.match(source, /rounded bg-\[var\(--gt-surface-muted\)\]/);
  assert.doesNotMatch(source, /className="btn-swiss/);
  assert.doesNotMatch(source, /border-4 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /shadow-\[10px_10px_0_var\(--shadow-color\)\]/);
  assert.doesNotMatch(source, /font-black uppercase/);
});
