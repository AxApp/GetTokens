import type { AccountRecord } from "../../../types";
import { buildDefaultCodexQuotaCurl } from "./accountConfig.ts";
import { getVendorPreset, type VendorCredentialField } from "./vendorPresets.ts";
import { resolveVendorPresetID } from "./vendorPresetHelpers.ts";

export interface ApiKeyConfigDraft {
  apiKey: string;
  baseUrl: string;
  prefix: string;
  quotaCurl: string;
  quotaEnabled: boolean;
  billingCurl: string;
  billingEnabled: boolean;
  platformCookie?: string;
  curlVariables?: Record<string, string>;
  proxyUrl: string;
}

type ConfigSource = Pick<
  AccountRecord,
  | "displayName"
  | "provider"
  | "apiKey"
  | "baseUrl"
  | "prefix"
  | "quotaCurl"
  | "quotaEnabled"
  | "billingCurl"
  | "billingEnabled"
  | "platformCookie"
  | "curlVariables"
  | "proxyUrl"
>;

export function buildApiKeyConfigDraft(
  account: ConfigSource,
): ApiKeyConfigDraft {
  const baseUrl = account.baseUrl ?? "";
  const quotaCurl =
    account.quotaCurl ||
    buildQuotaCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl,
    });
  const billingCurl =
    account.billingCurl ||
    buildBillingCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl,
    });
  return {
    apiKey: account.apiKey ?? "",
    baseUrl,
    prefix: account.prefix ?? "",
    quotaCurl,
    quotaEnabled: account.quotaEnabled ?? quotaCurl.trim().length > 0,
    billingCurl,
    billingEnabled: account.billingEnabled ?? billingCurl.trim().length > 0,
    platformCookie: account.platformCookie ?? account.curlVariables?.platformCookie ?? "",
    curlVariables: normalizeCurlVariables(account.curlVariables, account.platformCookie),
    proxyUrl: account.proxyUrl ?? "",
  };
}

export function hasApiKeyConfigChanges(
  account: ConfigSource,
  draft: ApiKeyConfigDraft,
) {
  const current = buildApiKeyConfigDraft(account);
  return (
    current.apiKey !== draft.apiKey ||
    current.baseUrl !== draft.baseUrl ||
    current.prefix !== draft.prefix ||
    current.quotaCurl !== draft.quotaCurl ||
    current.quotaEnabled !== draft.quotaEnabled ||
    current.billingCurl !== draft.billingCurl ||
    current.billingEnabled !== draft.billingEnabled ||
    current.platformCookie !== draft.platformCookie ||
    !isSameCurlVariables(current.curlVariables, draft.curlVariables) ||
    current.proxyUrl !== draft.proxyUrl
  );
}

export function listApiKeyConfigMissingFields(draft: ApiKeyConfigDraft) {
  const fields: string[] = [];
  if (!draft.apiKey.trim()) {
    fields.push("API Key");
  }
  if (!draft.baseUrl.trim()) {
    fields.push("Base URL");
  }
  return fields;
}

export function normalizeCurlVariables(values?: Record<string, string>, platformCookie?: string): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(values ?? {}).forEach(([key, value]) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) return;
    out[trimmedKey] = String(value ?? '').trim();
  });
  const cookie = (platformCookie ?? '').trim();
  if (cookie) {
    out.platformCookie = cookie;
  }
  return out;
}

export function isSameCurlVariables(a?: Record<string, string>, b?: Record<string, string>) {
  const left = normalizeCurlVariables(a);
  const right = normalizeCurlVariables(b);
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  return keys.every((key) => (left[key] ?? '') === (right[key] ?? ''));
}

export function buildQuotaCurlTemplate(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
) {
  const preset = resolveVendorPreset(account);
  if (preset?.quotaCurlTemplate) {
    return preset.quotaCurlTemplate;
  }
  return buildDefaultCodexQuotaCurl(account.baseUrl);
}

export function buildBillingCurlTemplate(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
) {
  const preset = resolveVendorPreset(account);
  return preset?.billingCurlTemplate ?? "";
}

export function buildQuotaCurlSetupGuide(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
) {
  const preset = resolveVendorPreset(account);
  return preset?.quotaSetupGuide ?? [];
}

export function buildBillingCurlSetupGuide(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
) {
  const preset = resolveVendorPreset(account);
  return preset?.billingSetupGuide ?? [];
}

export function buildVendorCredentialFields(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
): VendorCredentialField[] {
  const preset = resolveVendorPreset(account);
  return preset?.credentialFields ?? [];
}

export function buildVendorCurlVariableFields(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
): VendorCredentialField[] {
  return buildVendorCredentialFields(account).filter((field) => field.scope === "curl" && field.variableName);
}

function resolveVendorPreset(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
) {
  const presetID = resolveVendorPresetID(
    account.displayName || account.provider || "",
    account.baseUrl || "",
  );
  return presetID ? getVendorPreset(presetID) : undefined;
}
