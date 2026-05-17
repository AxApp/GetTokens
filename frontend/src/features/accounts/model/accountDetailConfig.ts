import type { AccountRecord } from '../../../types';
import { buildDefaultCodexQuotaCurl } from './accountConfig.ts';
import { getVendorPreset } from './vendorPresets.ts';
import { resolveVendorPresetID } from './vendorPresetHelpers.ts';

export interface ApiKeyConfigDraft {
  apiKey: string;
  baseUrl: string;
  prefix: string;
  quotaCurl: string;
  quotaEnabled: boolean;
  billingCurl: string;
  billingEnabled: boolean;
}

type ConfigSource = Pick<
  AccountRecord,
  'displayName' | 'provider' | 'apiKey' | 'baseUrl' | 'prefix' | 'quotaCurl' | 'quotaEnabled' | 'billingCurl' | 'billingEnabled'
>;

export function buildApiKeyConfigDraft(account: ConfigSource): ApiKeyConfigDraft {
  return {
    apiKey: account.apiKey ?? '',
    baseUrl: account.baseUrl ?? '',
    prefix: account.prefix ?? '',
    quotaCurl: account.quotaCurl ?? '',
    quotaEnabled: account.quotaEnabled ?? false,
    billingCurl: account.billingCurl ?? '',
    billingEnabled: account.billingEnabled ?? false,
  };
}

export function hasApiKeyConfigChanges(account: ConfigSource, draft: ApiKeyConfigDraft) {
  const current = buildApiKeyConfigDraft(account);
  return current.apiKey !== draft.apiKey
    || current.baseUrl !== draft.baseUrl
    || current.prefix !== draft.prefix
    || current.quotaCurl !== draft.quotaCurl
    || current.quotaEnabled !== draft.quotaEnabled
    || current.billingCurl !== draft.billingCurl
    || current.billingEnabled !== draft.billingEnabled;
}

export function listApiKeyConfigMissingFields(draft: ApiKeyConfigDraft) {
  const fields: string[] = [];
  if (!draft.apiKey.trim()) {
    fields.push('API Key');
  }
  if (!draft.baseUrl.trim()) {
    fields.push('Base URL');
  }
  return fields;
}

export function buildQuotaCurlTemplate(account: Pick<ConfigSource, 'displayName' | 'provider' | 'baseUrl'>) {
  const preset = resolveVendorPreset(account);
  if (preset?.quotaCurlTemplate) {
    return preset.quotaCurlTemplate;
  }
  return buildDefaultCodexQuotaCurl(account.baseUrl);
}

export function buildBillingCurlTemplate(account: Pick<ConfigSource, 'displayName' | 'provider' | 'baseUrl'>) {
  const preset = resolveVendorPreset(account);
  return preset?.billingCurlTemplate ?? '';
}

function resolveVendorPreset(account: Pick<ConfigSource, 'displayName' | 'provider' | 'baseUrl'>) {
  const presetID = resolveVendorPresetID(account.displayName || account.provider || '', account.baseUrl || '');
  return presetID ? getVendorPreset(presetID) : undefined;
}
