import type { OpenAICompatibleProvider, ProviderVerifyState } from './openAICompatible';
import type { Translator } from './types';

export type OpenAICompatibleCardTone = 'neutral' | 'positive' | 'warning' | 'critical';

export interface OpenAICompatibleCardBadge {
  label: string;
  tone?: OpenAICompatibleCardTone;
}

export function resolveOpenAICompatibleCardTone(
  provider: OpenAICompatibleProvider,
  verifyState: ProviderVerifyState,
): OpenAICompatibleCardTone {
  if (provider.disabled) {
    return 'warning';
  }
  if (verifyState.status === 'success') {
    return 'positive';
  }
  if (verifyState.status === 'error') {
    return 'critical';
  }
  return 'neutral';
}

export function resolveOpenAICompatibleCardEyebrow(
  t: Translator,
  provider: OpenAICompatibleProvider,
  verifyState: ProviderVerifyState,
) {
  if (provider.disabled) {
    return t('accounts.rotation_disabled_badge');
  }
  if (verifyState.status === 'success') {
    return t('accounts.openai_provider_test_success');
  }
  if (verifyState.status === 'error') {
    return t('accounts.openai_provider_test_failed');
  }
  return t('accounts.openai_provider_test_idle');
}

export function buildOpenAICompatibleCardBadges(
  t: Translator,
  provider: OpenAICompatibleProvider,
): OpenAICompatibleCardBadge[] {
  const badges: OpenAICompatibleCardBadge[] = [{ label: t('accounts.ui_openai_compatible_badge') }];
  if (provider.disabled) {
    badges.push({ label: t('accounts.rotation_disabled_badge'), tone: 'warning' });
  }
  return badges;
}

export function resolveOpenAICompatibleVerifyMessage(t: Translator, verifyState: ProviderVerifyState) {
  return verifyState.message || t('accounts.openai_provider_test_idle');
}
