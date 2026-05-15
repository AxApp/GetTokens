import type { OpenAICompatibleProvider, ProviderVerifyState } from './openAICompatible';
import type { Translator } from './types';

export type OpenAICompatibleCardTone = 'neutral' | 'positive' | 'warning' | 'critical';

export interface OpenAICompatibleCardBadge {
  label: string;
  tone?: OpenAICompatibleCardTone;
}

export interface OpenAICompatibleCardEvidenceRow {
  label: string;
  value: string;
  title?: string;
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

export function buildOpenAICompatibleCardEvidenceRows(
  t: Translator,
  provider: OpenAICompatibleProvider,
  verifyState: ProviderVerifyState,
  effectiveModelCount: number,
): OpenAICompatibleCardEvidenceRow[] {
  return [
    {
      label: t('accounts.card_asset'),
      value: `openai-compatible:${provider.name}`,
      title: `openai-compatible:${provider.name}`,
    },
    {
      label: t('accounts.card_source_type'),
      value: 'OPENAI-COMPATIBLE',
    },
    {
      label: t('accounts.ui_models'),
      value: String(effectiveModelCount),
    },
    {
      label: t('accounts.openai_provider_last_verified'),
      value: formatProviderLastVerified(verifyState.lastVerifiedAt),
    },
  ];
}

export function resolveOpenAICompatibleVerifyMessage(t: Translator, verifyState: ProviderVerifyState) {
  return verifyState.message || t('accounts.openai_provider_test_idle');
}

export function formatProviderLastVerified(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
}
