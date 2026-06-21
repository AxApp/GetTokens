import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('codex oauth dialog is portaled above account detail modal', async () => {
  const dialogSource = await readFile(new URL('../components/CodexOAuthModal.tsx', import.meta.url), 'utf8');
  const modalFrameSource = await readFile(new URL('../../../components/ui/ModalFrame.tsx', import.meta.url), 'utf8');

  assert.match(dialogSource, /ModalFrame/);
  assert.match(dialogSource, /portal/);
  assert.match(dialogSource, /coverViewport/);
  assert.match(dialogSource, /zIndexClassName="z-\[70\]"/);
  assert.doesNotMatch(dialogSource, /fixed inset-0 z-50/);
  assert.match(modalFrameSource, /portal = false/);
  assert.match(modalFrameSource, /zIndexClassName = 'z-50'/);
  assert.match(modalFrameSource, /coverViewport = false/);
  assert.match(modalFrameSource, /!detailFullscreen && !coverViewport/);
  assert.match(modalFrameSource, /detailFullscreen \|\| portal/);
});

test('codex oauth dialog uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/CodexOAuthModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const codexOAuthModalHeaderClass =/);
  assert.match(source, /const codexOAuthModalButtonClass =/);
  assert.match(source, /const codexOAuthModalPrimaryButtonClass =/);
  assert.match(source, /const codexOAuthModalUrlClass =/);
  assert.match(source, /const codexOAuthModalStatusToneClass/);
  assert.match(source, /data-codex-oauth-dialog-header="quiet"/);
  assert.match(source, /data-codex-oauth-dialog-url="quiet"/);
  assert.match(source, /data-codex-oauth-dialog-copy-state=\{copyState\}/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2/);
  assert.doesNotMatch(source, /border-dashed/);
  assert.doesNotMatch(source, /bg-\[var\(--gt-surface-panel\)\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /\buppercase\b/);
  assert.doesNotMatch(source, /tracking-\[0\.18em\]|tracking-\[0\.2em\]|tracking-tight|tracking-wide/);
});
