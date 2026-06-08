import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountDisabledActionNotice } from '../model/accountActionErrors.ts';

test('account disabled action errors keep enable and disable attribution separate from delete', () => {
  const disableNotice = buildAccountDisabledActionNotice(true, new Error('route guard write failed'));
  const enableNotice = buildAccountDisabledActionNotice(false, 'sidecar is not ready');

  assert.deepEqual(disableNotice, {
    tone: 'error',
    message: '禁用账号失败：route guard write failed',
  });
  assert.deepEqual(enableNotice, {
    tone: 'error',
    message: '启用账号失败：sidecar is not ready',
  });
  assert.doesNotMatch(disableNotice.message, /delete|DELETE|删除/);
  assert.doesNotMatch(enableNotice.message, /delete|DELETE|删除/);
});
