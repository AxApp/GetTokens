import test from 'node:test';
import assert from 'node:assert/strict';

import { readFrameHashState, resolveMenuBarNavigationHash } from '../utils/pagePersistence.ts';

test('menu bar navigation resolver opens supported operational frames', () => {
  assert.equal(resolveMenuBarNavigationHash({ page: 'accounts' }), '#frame=accounts');
  assert.equal(resolveMenuBarNavigationHash({ page: 'accounts', workspace: 'all', filter: 'risk' }), '#frame=accounts&workspace=all&filter=risk');
  assert.equal(
    resolveMenuBarNavigationHash({ page: 'codex', workspace: 'live-sessions', view: 'project' }),
    '#frame=codex&workspace=live-sessions&view=project',
  );
  assert.equal(
    resolveMenuBarNavigationHash({ page: 'codex', workspace: 'usage-codex' }),
    '#frame=codex&workspace=usage-codex',
  );
});

test('menu bar account risk hash is parsed for accounts feature consumption', () => {
  assert.deepEqual(readFrameHashState('#frame=accounts&workspace=all&filter=risk'), {
    page: 'accounts',
    workspace: 'all',
    accountFilter: 'risk',
  });
});

test('menu bar navigation resolver ignores unsupported payloads', () => {
  assert.equal(resolveMenuBarNavigationHash(), null);
  assert.equal(resolveMenuBarNavigationHash({ page: 'debug' }), null);
  assert.equal(
    resolveMenuBarNavigationHash({ page: 'codex', workspace: 'not-a-workspace' }),
    '#frame=codex',
  );
});
