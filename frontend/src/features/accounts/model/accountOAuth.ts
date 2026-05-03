import type { Translator } from './types';

export type CodexOAuthMode = 'login' | 'reauth';

export function resolveCodexOAuthMode(existingName?: string | null): CodexOAuthMode {
  return String(existingName || '').trim() ? 'reauth' : 'login';
}

export function buildCodexOAuthBannerMessage(
  t: Translator,
  phase: 'pending' | 'success',
  existingName?: string | null
) {
  const mode = resolveCodexOAuthMode(existingName);
  if (phase === 'pending') {
    return mode === 'reauth' ? t('accounts.reauth_pending_global') : t('accounts.login_chatgpt_pending');
  }
  return mode === 'reauth' ? t('accounts.reauth_success') : t('accounts.login_chatgpt_success');
}

export function buildCodexOAuthDialogTitle(t: Translator, existingName?: string | null) {
  const mode = resolveCodexOAuthMode(existingName);
  return mode === 'reauth' ? t('accounts.oauth_dialog_title_reauth') : t('accounts.oauth_dialog_title_login');
}

export function buildCodexOAuthDialogHint(t: Translator, existingName?: string | null) {
  const mode = resolveCodexOAuthMode(existingName);
  return mode === 'reauth' ? t('accounts.oauth_dialog_hint_reauth') : t('accounts.oauth_dialog_hint_login');
}
