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
