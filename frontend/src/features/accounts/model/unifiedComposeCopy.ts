import type { Translator } from './types';
import type { VendorPreset } from './vendorPresets';
import type { ApiFormat } from '../../../types';

const CATEGORY_KEY_MAP: Record<VendorPreset['category'], string> = {
  official: 'accounts.unified_compose_category_official',
  cn_official: 'accounts.unified_compose_category_cn_official',
  aggregator: 'accounts.unified_compose_category_aggregator',
  third_party: 'accounts.unified_compose_category_third_party',
  cloud_provider: 'accounts.unified_compose_category_cloud_provider',
};

const FORMAT_TARGET_KEY_MAP: Record<ApiFormat, string> = {
  anthropic: 'accounts.unified_compose_format_target_claude',
  openai_chat: 'accounts.unified_compose_format_target_chat',
  openai_responses: 'accounts.unified_compose_format_target_responses',
  gemini_native: 'accounts.unified_compose_format_target_gemini',
};

const FORMAT_TITLE_KEY_MAP: Record<ApiFormat, string> = {
  anthropic: 'accounts.unified_compose_format_title_anthropic',
  openai_chat: 'accounts.unified_compose_format_title_openai_chat',
  openai_responses: 'accounts.unified_compose_format_title_openai_responses',
  gemini_native: 'accounts.unified_compose_format_title_gemini_native',
};

export function resolveUnifiedComposeCategoryLabel(t: Translator, category: VendorPreset['category']): string {
  return t(CATEGORY_KEY_MAP[category]);
}

export function resolveUnifiedComposeFormatTargetLabel(t: Translator, format: ApiFormat): string {
  return t(FORMAT_TARGET_KEY_MAP[format]);
}

export function resolveUnifiedComposeFormatTitle(t: Translator, format: ApiFormat): string {
  return t(FORMAT_TITLE_KEY_MAP[format]);
}

export function buildUnifiedComposeProviderAriaLabel(t: Translator, providerName: string): string {
  return `${t('accounts.unified_compose_provider_aria_prefix')} ${providerName}`;
}

export function resolveUnifiedComposeModalCopy(t: Translator) {
  return {
    title: t('accounts.add_account'),
    selectTitle: t('accounts.unified_compose_title_select'),
    configureTitle: t('accounts.unified_compose_title_configure'),
    searchPlaceholder: t('accounts.unified_compose_search_placeholder'),
    searchClearLabel: t('common.clear_search'),
    providerEyebrow: t('accounts.unified_compose_provider_eyebrow'),
    endpointEyebrow: t('accounts.unified_compose_endpoint_eyebrow'),
    credentialEyebrow: t('accounts.unified_compose_credential_eyebrow'),
    automationEyebrow: t('accounts.unified_compose_automation_eyebrow'),
    billingEyebrow: t('accounts.unified_compose_billing_eyebrow'),
    endpointsLabel: t('accounts.unified_compose_endpoints'),
    changeLabel: t('accounts.unified_compose_change'),
    customEntryLabel: t('accounts.unified_compose_custom_entry'),
    submitLabel: t('accounts.add_account'),
    advancedLabel: t('accounts.unified_compose_advanced'),
    billingLabel: t('accounts.unified_compose_billing'),
    credentialsLabel: t('accounts.unified_compose_credentials'),
    labelLabel: t('accounts.unified_compose_label'),
    labelPlaceholderDefault: t('accounts.unified_compose_label_placeholder_default'),
    labelPlaceholderSuffix: t('accounts.unified_compose_label_placeholder_suffix'),
    apiKeyLabel: t('accounts.ui_api_key'),
    baseUrlPrimaryLabel: t('accounts.unified_compose_base_url_primary'),
    quotaTrackingLabel: t('accounts.quota_curl_enabled'),
    quotaCurlLabel: t('accounts.quota_curl'),
    quotaCurlPlaceholder: t('accounts.unified_compose_quota_curl_placeholder'),
    billingCurlLabel: t('accounts.unified_compose_billing_curl'),
    billingEnabledLabel: t('accounts.unified_compose_billing_enabled'),
    categoryLabels: {
      official: resolveUnifiedComposeCategoryLabel(t, 'official'),
      cn_official: resolveUnifiedComposeCategoryLabel(t, 'cn_official'),
      aggregator: resolveUnifiedComposeCategoryLabel(t, 'aggregator'),
      third_party: resolveUnifiedComposeCategoryLabel(t, 'third_party'),
      cloud_provider: resolveUnifiedComposeCategoryLabel(t, 'cloud_provider'),
    } as const,
    formatTargetLabels: {
      anthropic: resolveUnifiedComposeFormatTargetLabel(t, 'anthropic'),
      openai_chat: resolveUnifiedComposeFormatTargetLabel(t, 'openai_chat'),
      openai_responses: resolveUnifiedComposeFormatTargetLabel(t, 'openai_responses'),
      gemini_native: resolveUnifiedComposeFormatTargetLabel(t, 'gemini_native'),
    } as const,
  };
}
