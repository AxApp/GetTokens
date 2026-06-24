import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('SessionPluginConsolePanel uses the quiet workspace component shell', async () => {
  const source = await readFile(new URL('./components/SessionPluginConsolePanel.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-session-plugin-console-panel="true"/);
  assert.match(source, /data-session-plugin-console-plugin-list="true"/);
  assert.match(source, /data-session-plugin-console-output="true"/);
  assert.match(source, /import \{ Button, Tag \} from 'antd';/);
  assert.match(source, /<Button/);
  assert.match(source, /rounded-md border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\] shadow-sm/);
  assert.match(source, /function PanelHead/);
  assert.match(source, /rounded bg-\[var\(--gt-surface-muted\)\]/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-info/);
  assert.match(source, /--gt-status-warning/);
  assert.doesNotMatch(source, /className="btn-swiss/);
  assert.doesNotMatch(source, /border-4 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /--text-on-accent|--bg-(main|surface|subtle|warning)/);
  assert.doesNotMatch(source, /--color-status-success/);
  assert.doesNotMatch(source, /shadow-\[10px_10px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
});
