import type { ApiFormat } from '../../../types';
import type { LocalCodexAuthStateLike } from '../../status/model/relayLocalState.ts';
import type { AccountRecord } from './types.ts';
import { normalizeBaseURL, resolveVendorPresetID } from './vendorPresetHelpers.ts';
import { getVendorPreset, getVendorPresets, type VendorPreset } from './vendorPresets.ts';

export type AccountLocalCliTarget = 'codex' | 'claude';
export type AccountLocalCliMappingStatus =
  | 'ready'
  | 'disabled-account'
  | 'blocked-account'
  | 'missing-relay-key'
  | 'sidecar-not-ready';

export type AccountLocalCliWarningSeverity = 'info' | 'warning' | 'blocking';
export type AccountLocalCliWarningCode =
  | 'relay-only'
  | 'preview-mode'
  | 'preserve-chatgpt-auth-requires-custom-provider'
  | 'preserve-chatgpt-auth-missing-local-auth'
  | 'current-provider-missing'
  | 'model-derived-from-template'
  | 'model-family-partial';

export interface AccountLocalCliWarning {
  code: AccountLocalCliWarningCode;
  severity: AccountLocalCliWarningSeverity;
  message: string;
}

export interface AccountLocalCliRelayKeyLike {
  value?: string;
  name?: string;
  label?: string;
}

export interface AccountLocalCliRelayEndpointLike {
  id: string;
  baseUrl: string;
}

export interface LocalCodexModelProviderStateLike {
  currentProviderID?: string;
  currentProviderName?: string;
  currentProviderIsBuiltin?: boolean;
  currentProviderExists?: boolean;
  providers?: Array<{
    providerID?: string;
    providerName?: string;
  }>;
}

export interface ResolveAccountLocalCliMappingsInput {
  account: AccountRecord;
  vendorPresets?: ReadonlyArray<VendorPreset>;
  relayKeyItems?: AccountLocalCliRelayKeyLike[];
  relayEndpoint?: AccountLocalCliRelayEndpointLike | null;
  selectedModel?: string;
  selectedReasoningEffort?: string;
  supportsWebsockets?: boolean;
  sidecarReady?: boolean;
  previewMode?: boolean;
  currentCodexProviderState?: LocalCodexModelProviderStateLike | null;
  localCodexAuthState?: LocalCodexAuthStateLike | null;
  accountBlockedReason?: string;
}

export interface AccountLocalCliMapping {
  id: string;
  accountID: string;
  accountTitle: string;
  templateID: string;
  templateName: string;
  target: AccountLocalCliTarget;
  status: AccountLocalCliMappingStatus;
  enabled: boolean;
  disabledReason?: string;
  sourceFormat: ApiFormat;
  sourceFormatBaseUrl: string;
  relayEndpointID: string;
  relayBaseUrl: string;
  relayKeyIndex: number;
  relayKeyLabel: string;
  modelCandidates: string[];
  warnings: AccountLocalCliWarning[];
  draft: AccountCliApplyDraft;
}

export type AccountCliApplyDraft =
  | {
      target: 'codex';
      source: Omit<AccountLocalCliMapping, 'draft'>;
      codex: {
        relayKeyIndex: number;
        endpointID: string;
        baseUrl: string;
        model: string;
        providerID: string;
        providerName: string;
        reasoningEffort: string;
        supportsWebsockets: boolean;
        authStrategy: 'replace_auth_with_apikey' | 'preserve_chatgpt_auth';
      };
    }
  | {
      target: 'claude';
      source: Omit<AccountLocalCliMapping, 'draft'>;
      claude: {
        relayKeyIndex: number;
        baseUrl: string;
        model: string;
        defaultHaikuModel: string;
        defaultSonnetModel: string;
        defaultOpusModel: string;
        smallFastModel: string;
        maxOutputTokens: string;
        apiTimeoutMs: string;
        disableNonEssentialTraffic: boolean;
        authField: 'ANTHROPIC_API_KEY';
      };
    };

const verifiedTemplateTargets: Record<string, AccountLocalCliTarget[]> = {
  anthropic: ['claude'],
  deepseek: ['claude'],
  zhipu: ['claude'],
  stepfun: ['claude'],
  bailian: ['claude'],
  siliconflow: ['claude'],
  aihubmix: ['claude'],
  shengsuanyun: ['claude'],
  novita: ['claude'],
  openai: ['codex'],
};

const defaultRelayEndpoint: AccountLocalCliRelayEndpointLike = {
  id: 'localhost',
  baseUrl: 'http://127.0.0.1:8317/v1',
};

const openAIProviderID = 'openai';

export function resolveAccountLocalCliMappings(input: ResolveAccountLocalCliMappingsInput): AccountLocalCliMapping[] {
  const preset = resolveAccountTemplatePreset(input.account, input.vendorPresets || getVendorPresets());
  if (!preset) {
    return [];
  }

  const targets = verifiedTemplateTargets[preset.id] || [];
  if (targets.length === 0) {
    return [];
  }

  const relayEndpoint = normalizeRelayEndpoint(input.relayEndpoint);
  const relayKeyItems = input.relayKeyItems || [];
  const relayKeyIndex = firstUsableRelayKeyIndex(relayKeyItems);
  const relayKeyLabel = buildRelayKeyLabel(relayKeyItems[relayKeyIndex], relayKeyIndex);
  const baseContext = resolveBaseStatus(input, relayKeyIndex);

  return targets
    .map((target) => buildMappingForTarget({
      ...input,
      preset,
      target,
      relayEndpoint,
      relayKeyIndex,
      relayKeyLabel,
      baseContext,
    }))
    .filter((item): item is AccountLocalCliMapping => item !== null);
}

export function resolveAccountTemplatePreset(account: AccountRecord, presets: ReadonlyArray<VendorPreset> = getVendorPresets()) {
  const providerID = normalizeProviderID(account.provider);
  if (providerID === 'codex') {
    const openAI = getVendorPreset('openai');
    if (openAI) return openAI;
  }
  const exact = presets.find((preset) => preset.id === providerID);
  if (exact) {
    return exact;
  }

  const resolvedID = resolveVendorPresetID(account.displayName || account.provider, account.baseUrl || '');
  if (resolvedID) {
    const resolved = presets.find((preset) => preset.id === resolvedID);
    if (resolved) return resolved;
  }

  const urls = [
    account.baseUrl || '',
    ...Object.values(account.formatBaseUrls || {}).map((value) => String(value || '')),
  ].map((value) => normalizeBaseURL(value)).filter(Boolean);

  return presets.find((preset) => {
    const presetUrls = [
      preset.baseUrl,
      ...Object.values(preset.formatBaseUrls || {}).map((value) => String(value || '')),
    ].map((value) => normalizeBaseURL(value)).filter(Boolean);
    return presetUrls.some((url) => urls.includes(url));
  });
}

function buildMappingForTarget(input: ResolveAccountLocalCliMappingsInput & {
  preset: VendorPreset;
  target: AccountLocalCliTarget;
  relayEndpoint: AccountLocalCliRelayEndpointLike;
  relayKeyIndex: number;
  relayKeyLabel: string;
  baseContext: {
    status: AccountLocalCliMappingStatus;
    enabled: boolean;
    disabledReason?: string;
    warnings: AccountLocalCliWarning[];
  };
}): AccountLocalCliMapping | null {
  const sourceFormat = resolveSourceFormat(input.account, input.preset, input.target);
  if (!sourceFormat) {
    return null;
  }

  const modelCandidates = resolveModelCandidates(input.account, input.preset, input.selectedModel);
  const model = modelCandidates[0] || input.selectedModel?.trim() || 'GT';
  const sourceFormatBaseUrl = resolveFormatBaseURL(input.account, input.preset, sourceFormat);
  const warnings = [...input.baseContext.warnings];
  if (input.previewMode) {
    warnings.push({
      code: 'preview-mode',
      severity: 'info',
      message: 'PREVIEW ONLY：普通浏览器预览不会调用 Wails 写入本机配置。',
    });
  }
  warnings.push({
    code: 'relay-only',
    severity: 'info',
    message: 'P0 只写入 GetTokens relay 入口，不把上游 API Key 或上游 base URL 直接写入本地 CLI。',
  });
  if (!hasAccountModel(input.account) && input.preset.modelSuggestions.length > 0) {
    warnings.push({
      code: 'model-derived-from-template',
      severity: 'info',
      message: `模型默认值来自 ${input.preset.name} 模板建议。`,
    });
  }

  const sourceBase = {
    id: `${input.account.id}:${input.target}`,
    accountID: input.account.id,
    accountTitle: input.account.displayName || input.account.name || input.account.id,
    templateID: input.preset.id,
    templateName: input.preset.name,
    target: input.target,
    status: input.baseContext.status,
    enabled: input.baseContext.enabled,
    disabledReason: input.baseContext.disabledReason,
    sourceFormat,
    sourceFormatBaseUrl,
    relayEndpointID: input.relayEndpoint.id,
    relayBaseUrl: input.relayEndpoint.baseUrl,
    relayKeyIndex: input.relayKeyIndex,
    relayKeyLabel: input.relayKeyLabel,
    modelCandidates,
    warnings,
  } satisfies Omit<AccountLocalCliMapping, 'draft'>;

  const draft = input.target === 'codex'
    ? buildCodexDraft(input, sourceBase, model, warnings)
    : buildClaudeDraft(input, sourceBase, model, warnings);

  return {
    ...sourceBase,
    warnings,
    draft,
  };
}

function buildCodexDraft(
  input: ResolveAccountLocalCliMappingsInput & {
    relayEndpoint: AccountLocalCliRelayEndpointLike;
    relayKeyIndex: number;
  },
  source: Omit<AccountLocalCliMapping, 'draft'>,
  model: string,
  warnings: AccountLocalCliWarning[],
): AccountCliApplyDraft {
  const providerState = normalizeCodexProviderState(input.currentCodexProviderState);
  const authStrategy = input.account.credentialSource === 'auth-file'
    ? 'preserve_chatgpt_auth'
    : 'replace_auth_with_apikey';

  if (authStrategy === 'preserve_chatgpt_auth') {
    if (providerState.currentProviderID === openAIProviderID) {
      warnings.push({
        code: 'preserve-chatgpt-auth-requires-custom-provider',
        severity: 'blocking',
        message: '当前 model_provider=openai，OAuth 保留模式不能静默复用内置 OpenAI provider。',
      });
    }
    if (providerState.currentProviderID !== openAIProviderID && !providerState.currentProviderExists) {
      warnings.push({
        code: 'current-provider-missing',
        severity: 'blocking',
        message: `当前 model_provider=${providerState.currentProviderID} 缺少 provider section，需要先选择或创建 custom provider。`,
      });
    }
    if (!input.localCodexAuthState?.canPreserveChatGPTAuth) {
      warnings.push({
        code: 'preserve-chatgpt-auth-missing-local-auth',
        severity: 'blocking',
        message: '本机 Codex auth.json 没有可保留的 ChatGPT 登录态，不能执行 OAuth 保留模式。',
      });
    }
  }

  return {
    target: 'codex',
    source,
    codex: {
      relayKeyIndex: input.relayKeyIndex,
      endpointID: input.relayEndpoint.id,
      baseUrl: input.relayEndpoint.baseUrl,
      model,
      providerID: providerState.currentProviderID,
      providerName: providerState.currentProviderName,
      reasoningEffort: input.selectedReasoningEffort?.trim() || 'medium',
      supportsWebsockets: input.supportsWebsockets ?? true,
      authStrategy,
    },
  };
}

function buildClaudeDraft(
  input: ResolveAccountLocalCliMappingsInput & {
    preset: VendorPreset;
    relayEndpoint: AccountLocalCliRelayEndpointLike;
    relayKeyIndex: number;
  },
  source: Omit<AccountLocalCliMapping, 'draft'>,
  model: string,
  warnings: AccountLocalCliWarning[],
): AccountCliApplyDraft {
  const haikuModel = findModelCandidate(input.account, input.preset, ['haiku']) || '';
  const sonnetModel = findModelCandidate(input.account, input.preset, ['sonnet']) || model;
  const opusModel = findModelCandidate(input.account, input.preset, ['opus']) || '';
  if (!haikuModel || !opusModel) {
    warnings.push({
      code: 'model-family-partial',
      severity: 'warning',
      message: '模型族字段只有部分可信来源，缺失项不会伪造默认值。',
    });
  }

  return {
    target: 'claude',
    source,
    claude: {
      relayKeyIndex: input.relayKeyIndex,
      baseUrl: input.relayEndpoint.baseUrl,
      model,
      defaultHaikuModel: haikuModel,
      defaultSonnetModel: sonnetModel,
      defaultOpusModel: opusModel,
      smallFastModel: haikuModel,
      maxOutputTokens: '',
      apiTimeoutMs: '',
      disableNonEssentialTraffic: true,
      authField: 'ANTHROPIC_API_KEY',
    },
  };
}

function resolveSourceFormat(account: AccountRecord, preset: VendorPreset, target: AccountLocalCliTarget): ApiFormat | null {
  const formats = new Set<ApiFormat>([
    ...preset.supportedFormats,
    ...(account.supportedFormats || []),
  ]);
  if (target === 'claude') {
    return formats.has('anthropic') ? 'anthropic' : null;
  }
  if (formats.has('openai_responses')) {
    return 'openai_responses';
  }
  return formats.has('openai_chat') ? 'openai_chat' : null;
}

function resolveFormatBaseURL(account: AccountRecord, preset: VendorPreset, format: ApiFormat) {
  return (
    account.formatBaseUrls?.[format] ||
    preset.formatBaseUrls?.[format] ||
    account.baseUrl ||
    preset.baseUrl
  );
}

function resolveModelCandidates(account: AccountRecord, preset: VendorPreset, selectedModel?: string) {
  const accountModels = (account.models || [])
    .map((item) => String(item.alias || item.name || '').trim())
    .filter(Boolean);
  const candidates = [
    ...accountModels,
    ...preset.modelSuggestions.map((item) => item.trim()).filter(Boolean),
    String(selectedModel || '').trim(),
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

function hasAccountModel(account: AccountRecord) {
  return (account.models || []).some((item) => String(item.alias || item.name || '').trim());
}

function findModelCandidate(account: AccountRecord, preset: VendorPreset, tokens: string[]) {
  return resolveModelCandidates(account, preset).find((model) => {
    const normalized = model.toLowerCase();
    return tokens.some((token) => normalized.includes(token));
  });
}

function resolveBaseStatus(input: ResolveAccountLocalCliMappingsInput, relayKeyIndex: number) {
  if (input.account.disabled || String(input.account.status || '').trim().toUpperCase() === 'DISABLED') {
    return {
      status: 'disabled-account' as const,
      enabled: false,
      disabledReason: '账号已禁用，不能写入本机 CLI 配置。',
      warnings: [] as AccountLocalCliWarning[],
    };
  }
  if (input.accountBlockedReason?.trim()) {
    return {
      status: 'blocked-account' as const,
      enabled: false,
      disabledReason: input.accountBlockedReason.trim(),
      warnings: [] as AccountLocalCliWarning[],
    };
  }
  if (input.sidecarReady === false) {
    return {
      status: 'sidecar-not-ready' as const,
      enabled: false,
      disabledReason: 'GetTokens relay 尚未 ready。',
      warnings: [] as AccountLocalCliWarning[],
    };
  }
  if (relayKeyIndex < 0) {
    return {
      status: 'missing-relay-key' as const,
      enabled: false,
      disabledReason: '缺少 GetTokens relay key。',
      warnings: [] as AccountLocalCliWarning[],
    };
  }
  return {
    status: 'ready' as const,
    enabled: true,
    warnings: [] as AccountLocalCliWarning[],
  };
}

function firstUsableRelayKeyIndex(items: AccountLocalCliRelayKeyLike[]) {
  return items.findIndex((item) => String(item.value || '').trim());
}

function buildRelayKeyLabel(item: AccountLocalCliRelayKeyLike | undefined, index: number) {
  const explicitLabel = String(item?.label || item?.name || '').trim();
  if (explicitLabel) {
    return explicitLabel;
  }
  return index >= 0 ? `KEY ${index + 1}` : 'NO RELAY KEY';
}

function normalizeRelayEndpoint(endpoint: AccountLocalCliRelayEndpointLike | null | undefined) {
  const baseUrl = String(endpoint?.baseUrl || '').trim();
  if (!baseUrl) {
    return defaultRelayEndpoint;
  }
  return {
    id: String(endpoint?.id || 'localhost').trim() || 'localhost',
    baseUrl,
  };
}

function normalizeCodexProviderState(state?: LocalCodexModelProviderStateLike | null) {
  const currentProviderID = String(state?.currentProviderID || openAIProviderID).trim() || openAIProviderID;
  const currentProviderName = String(state?.currentProviderName || (currentProviderID === openAIProviderID ? 'OpenAI' : currentProviderID)).trim();
  return {
    currentProviderID,
    currentProviderName,
    currentProviderIsBuiltin: Boolean(state?.currentProviderIsBuiltin || currentProviderID === openAIProviderID),
    currentProviderExists: state?.currentProviderExists ?? currentProviderID === openAIProviderID,
  };
}

function normalizeProviderID(value: string) {
  return String(value || '').trim().toLowerCase();
}
