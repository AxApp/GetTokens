import type { AccountRecord } from "../../../types";
import { buildDefaultCodexQuotaCurl } from "./accountConfig.ts";
import { getVendorPreset } from "./vendorPresets.ts";
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
    platformCookie: account.platformCookie ?? "",
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

function resolveVendorPreset(
  account: Pick<ConfigSource, "displayName" | "provider" | "baseUrl">,
) {
  const presetID = resolveVendorPresetID(
    account.displayName || account.provider || "",
    account.baseUrl || "",
  );
  return presetID ? getVendorPreset(presetID) : undefined;
}
