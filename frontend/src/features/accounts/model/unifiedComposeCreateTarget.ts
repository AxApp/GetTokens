import { normalizeBaseUrl } from './accountConfig.ts';
import type { VendorPreset } from './vendorPresets.ts';

export interface UnifiedComposeModelInput {
  name?: string;
  alias?: string;
}

export interface UnifiedComposeCodexAPIKeyInputSource {
  providerName: string;
  apiKey: string;
  baseUrl: string;
  formatBaseUrls?: Partial<Record<string, string>>;
  models?: UnifiedComposeModelInput[];
  quotaCurl?: string;
  quotaEnabled?: boolean;
  billingCurl?: string;
  billingEnabled?: boolean;
  platformCookie?: string;
  curlVariables?: Record<string, string>;
}

export interface UnifiedComposeCodexAPIKeyInput {
  label: string;
  apiKey: string;
  baseUrl: string;
  prefix: string;
  formatBaseUrls?: Record<string, string>;
  models?: Array<{ name: string; alias: string }>;
  quotaCurl: string;
  quotaEnabled: boolean;
  billingCurl: string;
  billingEnabled: boolean;
  platformCookie?: string;
  curlVariables?: Record<string, string>;
}

export function shouldCreateUnifiedComposeAsCodexAPIKey(preset?: Pick<VendorPreset, 'quotaCurlTemplate' | 'billingCurlTemplate'> | null) {
  return Boolean(String(preset?.quotaCurlTemplate || '').trim() || String(preset?.billingCurlTemplate || '').trim());
}

export function normalizeUnifiedComposeCurlVariables(values?: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values || {})) {
    const trimmedKey = key.trim();
    const trimmedValue = String(value || '').trim();
    if (!trimmedKey || !trimmedValue) {
      continue;
    }
    out[trimmedKey] = trimmedValue;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeUnifiedComposeFormatBaseUrls(values?: Partial<Record<string, string>>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values || {})) {
    const trimmedKey = key.trim();
    const normalized = normalizeBaseUrl(String(value || ''));
    if (!trimmedKey || !normalized) {
      continue;
    }
    out[trimmedKey] = normalized;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function normalizeUnifiedComposeModels(models?: UnifiedComposeModelInput[]) {
  const out: Array<{ name: string; alias: string }> = [];
  for (const model of models || []) {
    const name = String(model.name || '').trim();
    if (!name) {
      continue;
    }
    out.push({ name, alias: String(model.alias || '').trim() });
  }
  return out.length > 0 ? out : undefined;
}

export function buildUnifiedComposeCodexAPIKeyInput(source: UnifiedComposeCodexAPIKeyInputSource): UnifiedComposeCodexAPIKeyInput {
  const quotaCurl = String(source.quotaCurl || '').trim();
  const billingCurl = String(source.billingCurl || '').trim();
  const platformCookie = String(source.platformCookie || '').trim();
  const curlVariables = normalizeUnifiedComposeCurlVariables(source.curlVariables);

  return {
    label: source.providerName.trim(),
    apiKey: source.apiKey.trim(),
    baseUrl: normalizeBaseUrl(source.baseUrl),
    prefix: '',
    formatBaseUrls: normalizeUnifiedComposeFormatBaseUrls(source.formatBaseUrls),
    models: normalizeUnifiedComposeModels(source.models),
    quotaCurl,
    quotaEnabled: Boolean(source.quotaEnabled && quotaCurl),
    billingCurl,
    billingEnabled: Boolean(source.billingEnabled && billingCurl),
    platformCookie: platformCookie || undefined,
    curlVariables,
  };
}
