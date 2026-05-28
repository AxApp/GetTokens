import {
  CODEX_CHATGPT_BACKEND_BASE_URL,
  normalizeRelayProviderOption,
  RELAY_CODEX_DEFAULT_MODEL,
  RELAY_CODEX_DEFAULT_REASONING_EFFORT,
  RELAY_CODEX_OPENAI_PROVIDER_ID,
  RELAY_CODEX_PROVIDER_ID,
  RELAY_CODEX_PROVIDER_NAME,
  RELAY_CODEX_REASONING_EFFORT_OPTIONS,
} from '../../accounts/model/accountConfig.ts';
import {
  mergeRelayProviderCatalog,
  type RelayProviderOption,
} from './relayProviderCatalog.ts';

export interface RelayKeyEditorState {
  mode: 'create' | 'rename';
  index: number | null;
  name: string;
  apiKey: string;
  error: string;
}

export interface RelayModelEditorState {
  value: string;
  error: string;
}

export interface RelayProviderEditorState {
  providerID: string;
  providerName: string;
  error: string;
}

export type LocalCliTargetID = 'codex' | 'claude';
export type CodexLocalAuthStrategy = 'replace_auth_with_apikey' | 'preserve_chatgpt_auth' | 'replace_auth_with_oauth';

export interface CodexLocalTargetDraft {
  relayKeyIndex: number;
  endpointID: string;
  model: string;
  providerID: string;
}

export interface LocalCodexAuthStateLike {
  hasAuthFile?: boolean;
  authMode?: string;
  hasOpenAIAPIKey?: boolean;
  hasTokens?: boolean;
  accountEmail?: string;
  planType?: string;
  canPreserveChatGPTAuth?: boolean;
  warnings?: string[];
}

export interface ClaudeCodeLocalApplyDraft {
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
  claudeCodeAttributionHeader: boolean;
  authField: 'ANTHROPIC_API_KEY' | 'ANTHROPIC_AUTH_TOKEN';
}

export interface LocalCliTargetDrafts {
  codex: CodexLocalTargetDraft;
  claude: ClaudeCodeLocalApplyDraft;
}

export interface CodexLocalApplyDiffInput {
  apiKey: string;
  apiKeySet?: boolean;
  authFileContentSet?: boolean;
  baseUrl: string;
  baseUrlSet?: boolean;
  model: string;
  modelSet?: boolean;
  reasoningEffort: string;
  reasoningEffortSet?: boolean;
  providerID: string;
  providerIDSet?: boolean;
  providerName: string;
  providerNameSet?: boolean;
  requiresOpenAIAuth?: boolean;
  requiresOpenAIAuthSet?: boolean;
  wireAPI?: string;
  wireAPISet?: boolean;
  supportsWebsockets: boolean;
  supportsWebsocketsSet?: boolean;
  authStrategy: CodexLocalAuthStrategy;
}

export interface CodexLocalApplyPreflightInput {
  authStrategy: CodexLocalAuthStrategy;
  providerID: string;
  authState?: LocalCodexAuthStateLike | null;
}

export interface CodexLocalApplyPreflightResult {
  canApply: boolean;
  reason: 'ok' | 'missing_chatgpt_auth' | 'requires_custom_provider';
}

export type CodexLocalApplyDisabledReason =
  | 'none'
  | 'applying'
  | 'service_not_ready'
  | 'missing_relay_key'
  | Exclude<CodexLocalApplyPreflightResult['reason'], 'ok'>;

export type CodexLocalApplyRecoveryAction =
  | 'none'
  | 'create_relay_key'
  | 'switch_auth_to_apikey'
  | 'switch_to_custom_provider'
  | 'create_provider';

export interface CodexLocalApplyState {
  canApply: boolean;
  disabledReason: CodexLocalApplyDisabledReason;
  recoveryAction: CodexLocalApplyRecoveryAction;
  nextProviderID?: string;
}

export interface CodexLocalApplyStateInput {
  isApplyingToLocal: boolean;
  isReady: boolean;
  selectedRelayKey: string;
  selectedProviderID: string;
  providerOptions: RelayProviderOption[];
  preflight: CodexLocalApplyPreflightResult;
}

export interface ClaudeCodeSettingsDiffInput {
  apiKey: string;
  baseUrl: string;
  model: string;
  defaultHaikuModel?: string;
  defaultSonnetModel?: string;
  defaultOpusModel?: string;
  smallFastModel?: string;
  maxOutputTokens?: string;
  apiTimeoutMs?: string;
  disableNonEssentialTraffic?: boolean;
  claudeCodeAttributionHeader?: boolean;
  targetPath?: string;
  authField?: 'ANTHROPIC_API_KEY' | 'ANTHROPIC_AUTH_TOKEN';
}

export type UnifiedDiffLineTone = 'add' | 'remove' | 'hunk' | 'file' | 'meta' | 'context';

const relayKeyAliasStorageKey = 'gettokens.status.relay-key-aliases';
const relayLANAccessStorageKey = 'gettokens.status.lan-access-enabled';
const relayModelOptionsStorageKey = 'gettokens.status.relay-model-options';
const relaySelectedModelStorageKey = 'gettokens.status.selected-relay-model';
const relayProviderOptionsStorageKey = 'gettokens.status.relay-provider-options';
const relaySelectedProviderStorageKey = 'gettokens.status.selected-relay-provider';
const relaySelectedReasoningEffortStorageKey = 'gettokens.status.selected-relay-reasoning-effort';
const codexLocalAuthStrategyStorageKey = 'gettokens.status.codex-local-auth-strategy';

export const defaultRelayModelOptions = [RELAY_CODEX_DEFAULT_MODEL];
export const defaultRelayReasoningEffortOptions = [...RELAY_CODEX_REASONING_EFFORT_OPTIONS];
export const defaultCodexLocalAuthStrategy: CodexLocalAuthStrategy = 'replace_auth_with_apikey';

const legacyRelayModelOptionIDs = new Set(['GT']);

function normalizeRelayModelOptionList(values: unknown[]) {
  const normalized = values
    .map((item) => String(item || '').trim())
    .filter((item) => item && !legacyRelayModelOptionIDs.has(item));
  return Array.from(new Set(normalized));
}

export function toRelayProviderOption(input: {
  providerID?: string;
  providerName?: string;
}): RelayProviderOption {
  const normalized = normalizeRelayProviderOption(input);
  return {
    id: normalized.providerID,
    name: normalized.providerName,
  };
}

export const defaultRelayProviderOptions: RelayProviderOption[] = [
  toRelayProviderOption({
    providerID: RELAY_CODEX_OPENAI_PROVIDER_ID,
    providerName: 'OpenAI',
  }),
  toRelayProviderOption({
    providerID: RELAY_CODEX_PROVIDER_ID,
    providerName: RELAY_CODEX_PROVIDER_NAME,
  }),
];

export function maskRelayKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed || 'KEY';
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

function quoteConfigString(value: string) {
  return JSON.stringify(String(value || '').trim());
}

export function buildCodexLocalApplyDiff(input: CodexLocalApplyDiffInput) {
  const providerID = input.providerID.trim() || RELAY_CODEX_OPENAI_PROVIDER_ID;
  const providerName = input.providerName.trim() || providerID;
  const baseUrl = input.baseUrl.trim();
  const model = input.model.trim();
  const reasoningEffort = input.reasoningEffort.trim();
  const maskedKey = maskRelayKey(input.apiKey);
  const authStrategy = input.authStrategy || defaultCodexLocalAuthStrategy;
  const providerBaseUrl = authStrategy === 'replace_auth_with_oauth' ? CODEX_CHATGPT_BACKEND_BASE_URL : baseUrl;
  const customProviderLines = [
    `+[model_providers.${providerID}]`,
  ];
  if (input.providerIDSet !== false) {
    customProviderLines.unshift('', ` model_provider = ${quoteConfigString(providerID)} # current user provider preserved unless explicitly switched`);
  }
  if (input.providerNameSet !== false) {
    customProviderLines.push(`+name = ${quoteConfigString(providerName)}`);
  }
  if (input.baseUrlSet !== false) {
    customProviderLines.push(`+base_url = ${quoteConfigString(providerBaseUrl)}`);
  }
  if (authStrategy === 'preserve_chatgpt_auth') {
    if (input.apiKeySet !== false) {
      customProviderLines.push(`+experimental_bearer_token = ${quoteConfigString(maskedKey)}`);
    }
    customProviderLines.push('-env_key = "OPENAI_API_KEY"');
  } else if (authStrategy === 'replace_auth_with_oauth') {
    customProviderLines.push('-env_key = "OPENAI_API_KEY"');
    customProviderLines.push('-experimental_bearer_token = "<previous token>"');
  }
  if (input.requiresOpenAIAuthSet !== false) {
    customProviderLines.push(`+requires_openai_auth = ${input.requiresOpenAIAuth === false ? 'false' : 'true'}`);
  }
  if (input.wireAPISet !== false) {
    customProviderLines.push(`+wire_api = ${quoteConfigString(input.wireAPI || 'responses')}`);
  }
  if (input.supportsWebsocketsSet !== false) {
    customProviderLines.push(`+supports_websockets = ${input.supportsWebsockets ? 'true' : 'false'}`);
  }
  const providerLines =
    providerID === RELAY_CODEX_OPENAI_PROVIDER_ID
      ? authStrategy === 'replace_auth_with_oauth'
        ? [
            '-openai_base_url = "<previous override if present>"',
            '# built-in openai provider uses ChatGPT Codex backend when auth_mode=chatgpt',
            '# model_provider is not forced unless already present',
          ]
        : [
            `+openai_base_url = ${quoteConfigString(baseUrl)}`,
            '# openai provider identity preserved; model_provider is not forced unless already present',
          ]
      : customProviderLines;
  const authLines =
    authStrategy === 'preserve_chatgpt_auth'
      ? [
          '# CODEX_HOME/auth.json (read-only preflight)',
          '# read: auth_mode must be ChatGPT-compatible and tokens must exist',
          '# preserved: existing ChatGPT login tokens stay in place',
          '# preserved: auth_mode / OPENAI_API_KEY / tokens / account metadata are not rewritten',
        ]
      : authStrategy === 'replace_auth_with_oauth'
        ? [
            '--- CODEX_HOME/auth.json',
            '+++ CODEX_HOME/auth.json',
            '@@ oauth auth fields @@',
            ...(input.authFileContentSet === false
              ? ['# preserved: deep link did not provide OAuth auth-file content']
              : [
                  ' {',
                  '+"auth_mode": "chatgpt",',
                  '+"tokens": "<selected OAuth account tokens>"',
                  '-"OPENAI_API_KEY": "<previous api key if present>"',
                  ' }',
                ]),
          ]
      : [
          '--- CODEX_HOME/auth.json',
          '+++ CODEX_HOME/auth.json',
          '@@ auth fields @@',
          ...(input.apiKeySet === false
            ? ['# preserved: deep link did not provide OPENAI_API_KEY']
            : [
                ' {',
                '+"auth_mode": "apikey",',
                `+"OPENAI_API_KEY": ${quoteConfigString(maskedKey)}`,
                '-"tokens": "<previous OAuth tokens if present>"',
                '-"last_refresh": "<previous OAuth refresh timestamp if present>"',
                '-"agent_identity": "<previous agent identity if present>"',
                '-"user": "<previous ChatGPT account metadata if present>"',
                ' }',
                '# API key mode rewrites auth.json to Codex CLI minimal fields only',
              ]),
        ];
  const rootLines = [
    ...(input.modelSet === false ? [] : [`+model = ${quoteConfigString(model)}`]),
    ...(input.reasoningEffortSet === false ? [] : [`+model_reasoning_effort = ${quoteConfigString(reasoningEffort)}`]),
  ];

  return [
    ...authLines,
    '',
    '--- CODEX_HOME/config.toml',
    '+++ CODEX_HOME/config.toml',
    '@@ root keys @@',
    '# existing comments stay where they are',
    ...rootLines,
    ...providerLines,
    '',
    '# preserved: [mcp_servers.*] / [profiles.*] / unknown provider keys',
    '# preserved: user comments and unmanaged sections are not part of this patch',
  ].join('\n');
}

export function getCodexLocalApplyPreflight(input: CodexLocalApplyPreflightInput): CodexLocalApplyPreflightResult {
  if (input.authStrategy === 'preserve_chatgpt_auth') {
    if ((input.providerID || '').trim() === RELAY_CODEX_OPENAI_PROVIDER_ID) {
      return { canApply: false, reason: 'requires_custom_provider' };
    }
    if (!input.authState?.canPreserveChatGPTAuth) {
      return { canApply: false, reason: 'missing_chatgpt_auth' };
    }
  }
  return { canApply: true, reason: 'ok' };
}

export function resolveCodexLocalApplyState(input: CodexLocalApplyStateInput): CodexLocalApplyState {
  if (input.isApplyingToLocal) {
    return { canApply: false, disabledReason: 'applying', recoveryAction: 'none' };
  }
  if (!input.isReady) {
    return { canApply: false, disabledReason: 'service_not_ready', recoveryAction: 'none' };
  }
  if (!input.selectedRelayKey.trim()) {
    return { canApply: false, disabledReason: 'missing_relay_key', recoveryAction: 'create_relay_key' };
  }
  if (!input.preflight.canApply) {
    if (input.preflight.reason === 'missing_chatgpt_auth') {
      return {
        canApply: false,
        disabledReason: input.preflight.reason,
        recoveryAction: 'switch_auth_to_apikey',
      };
    }
    if (input.preflight.reason === 'requires_custom_provider') {
      const nextProvider = input.providerOptions.find(
        (provider) =>
          provider.id.trim() &&
          provider.id.trim() !== RELAY_CODEX_OPENAI_PROVIDER_ID &&
          provider.id.trim() !== input.selectedProviderID.trim()
      );
      return {
        canApply: false,
        disabledReason: input.preflight.reason,
        recoveryAction: nextProvider ? 'switch_to_custom_provider' : 'create_provider',
        nextProviderID: nextProvider?.id,
      };
    }
    return {
      canApply: false,
      disabledReason: input.preflight.reason as Exclude<CodexLocalApplyPreflightResult['reason'], 'ok'>,
      recoveryAction: 'none',
    };
  }
  return { canApply: true, disabledReason: 'none', recoveryAction: 'none' };
}

export function buildClaudeCodeSettingsDiff(input: ClaudeCodeSettingsDiffInput) {
  const targetPath = input.targetPath?.trim() || '~/.claude/settings.json';
  const authField = input.authField || 'ANTHROPIC_API_KEY';
  const maskedKey = maskRelayKey(input.apiKey);
  const baseUrl = input.baseUrl.trim();
  const model = input.model.trim();
  const envItems = [
    [authField, maskedKey],
    ...(authField === 'ANTHROPIC_AUTH_TOKEN' ? [['ANTHROPIC_API_KEY', ''] as [string, string]] : []),
    ['ANTHROPIC_BASE_URL', baseUrl],
    ['ANTHROPIC_MODEL', model],
    ['ANTHROPIC_DEFAULT_HAIKU_MODEL', input.defaultHaikuModel?.trim() || ''],
    ['ANTHROPIC_DEFAULT_SONNET_MODEL', input.defaultSonnetModel?.trim() || ''],
    ['ANTHROPIC_DEFAULT_OPUS_MODEL', input.defaultOpusModel?.trim() || ''],
    ['ANTHROPIC_SMALL_FAST_MODEL', input.smallFastModel?.trim() || ''],
    ['CLAUDE_CODE_MAX_OUTPUT_TOKENS', input.maxOutputTokens?.trim() || ''],
    ['API_TIMEOUT_MS', input.apiTimeoutMs?.trim() || ''],
    ['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', input.disableNonEssentialTraffic ? '1' : ''],
    ['CLAUDE_CODE_ATTRIBUTION_HEADER', input.claudeCodeAttributionHeader ? '0' : ''],
  ].filter(([key, value]) => value || (authField === 'ANTHROPIC_AUTH_TOKEN' && key === 'ANTHROPIC_API_KEY')) as [string, string][];

  const envLines = envItems.map(([key, value], index) => {
    const comma = index === envItems.length - 1 ? '' : ',';
    return `+    "${key}": ${quoteConfigString(value)}${comma}`;
  });

  return [
    `--- ${targetPath}`,
    `+++ ${targetPath}`,
    '@@ env @@',
    ' {',
    '   "env": {',
    '     "HTTP_PROXY": "http://127.0.0.1:7890",',
    '     "ANTHROPIC_AUTH_TOKEN": "existing-user-token",',
    ...envLines,
    '   },',
    '   "permissions": { /* unchanged */ },',
    '   "hooks": { /* unchanged */ },',
    '   "statusLine": { /* unchanged */ }',
    ' }',
    '',
    '# preserved: ANTHROPIC_AUTH_TOKEN exists and is not removed automatically',
    '# preserved: permissions / hooks / statusLine are not part of this patch',
  ].join('\n');
}

export function resolveUnifiedDiffLineTone(line: string): UnifiedDiffLineTone {
  if (line.startsWith('+++ ') || line.startsWith('--- ')) {
    return 'file';
  }
  if (line.startsWith('@@')) {
    return 'hunk';
  }
  if (line.startsWith('+')) {
    return 'add';
  }
  if (line.startsWith('-')) {
    return 'remove';
  }
  if (line.startsWith('#')) {
    return 'meta';
  }
  return 'context';
}

export function updateLocalCliTargetDraft(
  drafts: LocalCliTargetDrafts,
  target: 'codex',
  patch: Partial<CodexLocalTargetDraft>
): LocalCliTargetDrafts;
export function updateLocalCliTargetDraft(
  drafts: LocalCliTargetDrafts,
  target: 'claude',
  patch: Partial<ClaudeCodeLocalApplyDraft>
): LocalCliTargetDrafts;
export function updateLocalCliTargetDraft(
  drafts: LocalCliTargetDrafts,
  target: LocalCliTargetID,
  patch: Partial<CodexLocalTargetDraft> | Partial<ClaudeCodeLocalApplyDraft>
): LocalCliTargetDrafts {
  return {
    ...drafts,
    [target]: {
      ...drafts[target],
      ...patch,
    },
  };
}

export function generateRandomRelayKey() {
  const prefix = 'sk-gettokens-';
  const hexLength = 32;

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(hexLength / 2));
    return `${prefix}${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  let suffix = '';
  while (suffix.length < hexLength) {
    suffix += Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  }
  return `${prefix}${suffix.slice(0, hexLength)}`;
}

export function loadRelayKeyAliases() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>;
  }

  try {
    const raw = window.localStorage.getItem(relayKeyAliasStorageKey);
    if (!raw) {
      return {} as Record<string, string>;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : ({} as Record<string, string>);
  } catch (error) {
    console.error(error);
    return {} as Record<string, string>;
  }
}

export function saveRelayKeyAliases(aliases: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relayKeyAliasStorageKey, JSON.stringify(aliases));
  } catch (error) {
    console.error(error);
  }
}

export function loadLANAccessEnabled() {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(relayLANAccessStorageKey);
    return raw === null ? true : raw === 'true';
  } catch (error) {
    console.error(error);
    return true;
  }
}

export function saveLANAccessEnabled(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relayLANAccessStorageKey, String(value));
  } catch (error) {
    console.error(error);
  }
}

export function loadRelayModelOptions() {
  if (typeof window === 'undefined') {
    return defaultRelayModelOptions;
  }

  try {
    const raw = window.localStorage.getItem(relayModelOptionsStorageKey);
    if (!raw) {
      return defaultRelayModelOptions;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultRelayModelOptions;
    }
    const normalized = normalizeRelayModelOptionList(parsed);
    return normalized.length ? normalized : defaultRelayModelOptions;
  } catch (error) {
    console.error(error);
    return defaultRelayModelOptions;
  }
}

export function saveRelayModelOptions(values: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const normalized = normalizeRelayModelOptionList(values);
    window.localStorage.setItem(relayModelOptionsStorageKey, JSON.stringify(normalized.length ? normalized : defaultRelayModelOptions));
  } catch (error) {
    console.error(error);
  }
}

export function normalizeRelayProviderOptions(values: Array<RelayProviderOption | string>) {
  const normalized = mergeRelayProviderCatalog(
    values.map((item) =>
      typeof item === 'string'
        ? { providerID: item, providerName: item }
        : { providerID: item.id, providerName: item.name }
    )
  );

  if (normalized.length === 0) {
    return defaultRelayProviderOptions;
  }
  return normalized;
}

export function loadRelayProviderOptions() {
  if (typeof window === 'undefined') {
    return defaultRelayProviderOptions;
  }

  try {
    const raw = window.localStorage.getItem(relayProviderOptionsStorageKey);
    if (!raw) {
      return defaultRelayProviderOptions;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultRelayProviderOptions;
    }
    return normalizeRelayProviderOptions(parsed as Array<RelayProviderOption | string>);
  } catch (error) {
    console.error(error);
    return defaultRelayProviderOptions;
  }
}

export function saveRelayProviderOptions(values: RelayProviderOption[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relayProviderOptionsStorageKey, JSON.stringify(values));
  } catch (error) {
    console.error(error);
  }
}

export interface ResolveInitialRelayModelSelectionInput {
  modelOptions: string[];
  storedModel?: string;
  activeModel?: string;
  hasExplicitActiveModel?: boolean;
  fallbackModel?: string;
}

export function resolveInitialRelayModelSelection(input: ResolveInitialRelayModelSelectionInput) {
  const modelOptions = input.modelOptions || [];
  const fallbackModel = String(input.fallbackModel || defaultRelayModelOptions[0] || RELAY_CODEX_DEFAULT_MODEL).trim() || RELAY_CODEX_DEFAULT_MODEL;
  const activeModel = String(input.activeModel || '').trim();
  if (input.hasExplicitActiveModel && activeModel) {
    return activeModel;
  }

  if (modelOptions.includes(fallbackModel)) {
    return fallbackModel;
  }

  const storedModel = String(input.storedModel || '').trim();
  if (storedModel && modelOptions.includes(storedModel)) {
    return storedModel;
  }

  return modelOptions[0] || fallbackModel;
}

export function loadSelectedRelayModel(modelOptions: string[]) {
  if (typeof window === 'undefined') {
    return resolveInitialRelayModelSelection({ modelOptions });
  }

  try {
    const raw = String(window.localStorage.getItem(relaySelectedModelStorageKey) || '').trim();
    return resolveInitialRelayModelSelection({
      modelOptions,
      storedModel: raw,
    });
  } catch (error) {
    console.error(error);
    return resolveInitialRelayModelSelection({ modelOptions });
  }
}

export function saveSelectedRelayModel(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relaySelectedModelStorageKey, value);
  } catch (error) {
    console.error(error);
  }
}

export interface ResolveInitialRelayProviderSelectionInput {
  providerOptions: RelayProviderOption[];
  storedProviderID?: string;
  activeProviderID?: string;
  hasExplicitActiveProvider?: boolean;
  fallbackProviderID?: string;
}

export function resolveInitialRelayProviderSelection(input: ResolveInitialRelayProviderSelectionInput) {
  const providerOptions = input.providerOptions || [];
  const fallbackProviderID = String(input.fallbackProviderID || RELAY_CODEX_PROVIDER_ID).trim() || RELAY_CODEX_PROVIDER_ID;
  const activeProviderID = String(input.activeProviderID || '').trim();
  if (input.hasExplicitActiveProvider && activeProviderID) {
    return activeProviderID;
  }

  if (providerOptions.some((option) => option.id === fallbackProviderID)) {
    return fallbackProviderID;
  }

  const storedProviderID = String(input.storedProviderID || '').trim();
  if (storedProviderID && providerOptions.some((option) => option.id === storedProviderID)) {
    return storedProviderID;
  }

  return providerOptions[0]?.id || fallbackProviderID;
}

export function loadSelectedRelayProvider(providerOptions: RelayProviderOption[]) {
  if (typeof window === 'undefined') {
    return resolveInitialRelayProviderSelection({ providerOptions });
  }

  try {
    const raw = String(window.localStorage.getItem(relaySelectedProviderStorageKey) || '').trim();
    return resolveInitialRelayProviderSelection({
      providerOptions,
      storedProviderID: raw,
    });
  } catch (error) {
    console.error(error);
    return resolveInitialRelayProviderSelection({ providerOptions });
  }
}

export function saveSelectedRelayProvider(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relaySelectedProviderStorageKey, value);
  } catch (error) {
    console.error(error);
  }
}

export function loadSelectedRelayReasoningEffort() {
  if (typeof window === 'undefined') {
    return RELAY_CODEX_DEFAULT_REASONING_EFFORT;
  }

  try {
    const raw = String(window.localStorage.getItem(relaySelectedReasoningEffortStorageKey) || '').trim().toLowerCase();
    return (defaultRelayReasoningEffortOptions as readonly string[]).includes(raw)
      ? raw
      : RELAY_CODEX_DEFAULT_REASONING_EFFORT;
  } catch (error) {
    console.error(error);
    return RELAY_CODEX_DEFAULT_REASONING_EFFORT;
  }
}

export function saveSelectedRelayReasoningEffort(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relaySelectedReasoningEffortStorageKey, value);
  } catch (error) {
    console.error(error);
  }
}

export function loadCodexLocalAuthStrategy(): CodexLocalAuthStrategy {
  if (typeof window === 'undefined') {
    return defaultCodexLocalAuthStrategy;
  }

  try {
    const raw = String(window.localStorage.getItem(codexLocalAuthStrategyStorageKey) || '').trim();
    return raw === 'preserve_chatgpt_auth' ? 'preserve_chatgpt_auth' : defaultCodexLocalAuthStrategy;
  } catch (error) {
    console.error(error);
    return defaultCodexLocalAuthStrategy;
  }
}

export function saveCodexLocalAuthStrategy(value: CodexLocalAuthStrategy) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(codexLocalAuthStrategyStorageKey, value);
  } catch (error) {
    console.error(error);
  }
}
