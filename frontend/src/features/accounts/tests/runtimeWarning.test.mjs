import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRuntimeWarningDisplay } from '../model/runtimeWarning.ts';

test('buildRuntimeWarningDisplay keeps full reason in title and shortens card text', () => {
  const reason = 'sidecar 请求失败 (500): {"error":"quota refresh timeout while contacting upstream","trace":"abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789"}';

  const display = buildRuntimeWarningDisplay(reason);

  assert.equal(display.full, reason);
  assert.ok(display.summary.length <= 96, display.summary);
  assert.match(display.summary, /sidecar 请求失败/);
  assert.match(display.summary, /quota refresh timeout/);
  assert.match(display.summary, /…$/);
});

test('buildRuntimeWarningDisplay returns empty values for blank reasons', () => {
  assert.deepEqual(buildRuntimeWarningDisplay('   '), { summary: '', full: '' });
});

test('buildRuntimeWarningDisplay normalizes repeated whitespace in summary only', () => {
  const reason = 'sidecar 请求失败   (500):\n {"error":"quota refresh timeout while contacting upstream"}';

  const display = buildRuntimeWarningDisplay(reason, 64);

  assert.equal(display.full, reason);
  assert.equal(display.summary, 'sidecar 请求失败 (500): {"error":"quota refresh timeout while conta…');
});


test('buildRuntimeWarningDisplay maps account-store IOERR to readable stale summary', () => {
  const reason = 'sidecar 请求失败 (500): {"error":"query accounts: disk I/O error (522)","code":"account_store_io_error","recoverable":true}';

  const display = buildRuntimeWarningDisplay(reason);

  assert.equal(display.full, reason);
  assert.equal(display.summary, '账号库读取异常，正在使用上次额度快照');
});
