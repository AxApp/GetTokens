import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCodexOAuthBannerMessage,
  buildCodexOAuthDialogHint,
  buildCodexOAuthDialogTitle,
  resolveCodexOAuthMode,
} from '../model/accountOAuth.ts';

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

test('codex oauth dialog copy follows login and reauth mode', () => {
  const t = (key) => key;

  assert.equal(buildCodexOAuthDialogTitle(t, ''), 'accounts.oauth_dialog_title_login');
  assert.equal(buildCodexOAuthDialogHint(t, ''), 'accounts.oauth_dialog_hint_login');
  assert.equal(buildCodexOAuthDialogTitle(t, 'expired.json'), 'accounts.oauth_dialog_title_reauth');
  assert.equal(buildCodexOAuthDialogHint(t, 'expired.json'), 'accounts.oauth_dialog_hint_reauth');
});
