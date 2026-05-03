import {
  normalizeRelayProviderOption,
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

export interface CodexLocalTargetDraft {
  relayKeyIndex: number;
  endpointID: string;
  model: string;
  providerID: string;
}

export interface ClaudeCodeLocalApplyDraft {
  relayKeyIndex: number;
  baseUrl: string;
  model: string;
  authField: 'ANTHROPIC_API_KEY';
}

export interface LocalCliTargetDrafts {
  codex: CodexLocalTargetDraft;
  claude: ClaudeCodeLocalApplyDraft;
}

export interface CodexLocalApplyDiffInput {
  apiKey: string;
  baseUrl: string;
  model: string;
  reasoningEffort: string;
  providerID: string;
  providerName: string;
}

export interface ClaudeCodeSettingsDiffInput {
  apiKey: string;
  baseUrl: string;
  model: string;
  targetPath?: string;
  authField?: 'ANTHROPIC_API_KEY';
}

export type UnifiedDiffLineTone = 'add' | 'remove' | 'hunk' | 'file' | 'meta' | 'context';

const relayKeyAliasStorageKey = 'gettokens.status.relay-key-aliases';
const relayLANAccessStorageKey = 'gettokens.status.lan-access-enabled';
const relayModelOptionsStorageKey = 'gettokens.status.relay-model-options';
const relaySelectedModelStorageKey = 'gettokens.status.selected-relay-model';
const relayProviderOptionsStorageKey = 'gettokens.status.relay-provider-options';
const relaySelectedProviderStorageKey = 'gettokens.status.selected-relay-provider';
const relaySelectedReasoningEffortStorageKey = 'gettokens.status.selected-relay-reasoning-effort';

export const defaultRelayModelOptions = ['GT', 'gpt-5.4'];
export const defaultRelayReasoningEffortOptions = [...RELAY_CODEX_REASONING_EFFORT_OPTIONS];

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
  const providerLines =
    providerID === RELAY_CODEX_OPENAI_PROVIDER_ID
      ? [
          `+openai_base_url = ${quoteConfigString(baseUrl)}`,
          '# openai provider identity preserved; model_provider is not forced unless already present',
        ]
      : [
          `+model_provider = ${quoteConfigString(providerID)}`,
          '',
          `+[model_providers.${providerID}]`,
          `+name = ${quoteConfigString(providerName)}`,
          `+base_url = ${quoteConfigString(baseUrl)}`,
          '+requires_openai_auth = true',
          '+wire_api = "responses"',
        ];

  return [
    '--- CODEX_HOME/auth.json',
    '+++ CODEX_HOME/auth.json',
    '@@ auth fields @@',
    ' {',
    '   "auth_mode": "apikey",',
    `+"OPENAI_API_KEY": ${quoteConfigString(maskedKey)}`,
    ' }',
    '',
    '--- CODEX_HOME/config.toml',
    '+++ CODEX_HOME/config.toml',
    '@@ root keys @@',
    '# existing comments stay where they are',
    `+model = ${quoteConfigString(model)}`,
    `+model_reasoning_effort = ${quoteConfigString(reasoningEffort)}`,
    ...providerLines,
    '',
    '# preserved: [mcp_servers.*] / [profiles.*] / unknown provider keys',
    '# preserved: user comments and unmanaged sections are not part of this patch',
  ].join('\n');
}

export function buildClaudeCodeSettingsDiff(input: ClaudeCodeSettingsDiffInput) {
  const targetPath = input.targetPath?.trim() || '~/.claude/settings.json';
  const authField = input.authField || 'ANTHROPIC_API_KEY';
  const maskedKey = maskRelayKey(input.apiKey);
  const baseUrl = input.baseUrl.trim();
  const model = input.model.trim();
  const envLines = [
    `+    "${authField}": ${quoteConfigString(maskedKey)},`,
    `+    "ANTHROPIC_BASE_URL": ${quoteConfigString(baseUrl)}${model ? ',' : ''}`,
  ];

  if (model) {
    envLines.push(`+    "ANTHROPIC_MODEL": ${quoteConfigString(model)}`);
  }

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
    const normalized = parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return Array.from(new Set(normalized));
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
    window.localStorage.setItem(relayModelOptionsStorageKey, JSON.stringify(values));
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

export function loadSelectedRelayModel(modelOptions: string[]) {
  if (typeof window === 'undefined') {
    return modelOptions[0] || 'GT';
  }

  try {
    const raw = String(window.localStorage.getItem(relaySelectedModelStorageKey) || '').trim();
    return raw || modelOptions[0] || 'GT';
  } catch (error) {
    console.error(error);
    return modelOptions[0] || 'GT';
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

export function loadSelectedRelayProvider(providerOptions: RelayProviderOption[]) {
  if (typeof window === 'undefined') {
    return providerOptions[0]?.id || RELAY_CODEX_OPENAI_PROVIDER_ID;
  }

  try {
    const raw = String(window.localStorage.getItem(relaySelectedProviderStorageKey) || '').trim();
    return raw && providerOptions.some((option) => option.id === raw)
      ? raw
      : (providerOptions[0]?.id || RELAY_CODEX_OPENAI_PROVIDER_ID);
  } catch (error) {
    console.error(error);
    return providerOptions[0]?.id || RELAY_CODEX_OPENAI_PROVIDER_ID;
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
