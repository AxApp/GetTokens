import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountStoreDiagnosticsView } from '../model/accountStoreDiagnostics.ts';

test('buildAccountStoreDiagnosticsView summarizes healthy account store with no recoveries', () => {
  const view = buildAccountStoreDiagnosticsView({
    pathBasename: 'accounts-v1.sqlite',
    configured: true,
    open: true,
    readRecovery: { count: 0, lastEndpoint: '', lastRecovered: false, lastError: '', lastRecoveredAtUnixMs: 0 },
  });

  assert.equal(view.tone, 'success');
  assert.equal(view.headline, 'OPEN · accounts-v1.sqlite');
  assert.equal(view.recoveryLine, 'NO RECOVERY EVENTS');
});

test('buildAccountStoreDiagnosticsView exposes recovered IOERR without full DB path', () => {
  const view = buildAccountStoreDiagnosticsView({
    pathBasename: '/Users/linhey/.config/gettokens/accounts-v1.sqlite',
    configured: true,
    open: true,
    readRecovery: {
      count: 2,
      lastEndpoint: 'accounts',
      lastRecovered: true,
      lastError: 'query accounts: disk I/O error (522)',
      lastRecoveredAtUnixMs: 1780460000000,
    },
  });

  assert.equal(view.tone, 'warning');
  assert.equal(view.headline, 'OPEN · accounts-v1.sqlite');
  assert.equal(view.recoveryLine, 'RECOVERED · accounts · #2');
  assert.equal(view.errorSummary, 'query accounts: disk I/O error (522)');
  assert.doesNotMatch(view.headline, /Users/);
});

test('buildAccountStoreDiagnosticsView marks failed recovery as critical and summarizes long errors', () => {
  const view = buildAccountStoreDiagnosticsView({
    pathBasename: 'accounts-v1.sqlite',
    configured: true,
    open: false,
    readRecovery: {
      count: 1,
      lastEndpoint: 'accounts/:account_key',
      lastRecovered: false,
      lastError: 'sidecar 请求失败 (500): {"error":"query accounts: disk I/O error (522)","trace":"abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz"}',
      lastRecoveredAtUnixMs: 0,
    },
  });

  assert.equal(view.tone, 'critical');
  assert.equal(view.recoveryLine, 'FAILED · accounts/:account_key · #1');
  assert.ok(view.errorSummary.length <= 96, view.errorSummary);
  assert.match(view.errorSummary, /disk I\/O error/);
  assert.match(view.errorSummary, /…$/);
});
