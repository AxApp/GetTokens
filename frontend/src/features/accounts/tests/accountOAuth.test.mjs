import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCodexOAuthBannerMessage, resolveCodexOAuthMode } from '../model/accountOAuth.ts';

test('resolveCodexOAuthMode distinguishes first login and reauth', () => {
  assert.equal(resolveCodexOAuthMode(''), 'login');
  assert.equal(resolveCodexOAuthMode('expired.json'), 'reauth');
});

test('buildCodexOAuthBannerMessage chooses login and reauth copy', () => {
  const t = (key) => key;

  assert.equal(buildCodexOAuthBannerMessage(t, 'pending', ''), 'accounts.login_chatgpt_pending');
  assert.equal(buildCodexOAuthBannerMessage(t, 'success', ''), 'accounts.login_chatgpt_success');
  assert.equal(buildCodexOAuthBannerMessage(t, 'pending', 'expired.json'), 'accounts.reauth_pending_global');
  assert.equal(buildCodexOAuthBannerMessage(t, 'success', 'expired.json'), 'accounts.reauth_success');
});
