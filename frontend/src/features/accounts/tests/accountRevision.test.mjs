import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_REVISION_CONFLICT_MESSAGE,
  isAccountRevisionConflictError,
} from '../model/accountRevision.ts';

test('account revision conflicts are identified from the sidecar error contract', () => {
  assert.equal(
    isAccountRevisionConflictError(
      new Error('sidecar 请求失败 (409): {"code":"account_revision_conflict","current_revision":3}'),
    ),
    true,
  );
  assert.equal(isAccountRevisionConflictError(new Error('network timeout')), false);
  assert.match(ACCOUNT_REVISION_CONFLICT_MESSAGE, /重新载入最新详情/);
});
