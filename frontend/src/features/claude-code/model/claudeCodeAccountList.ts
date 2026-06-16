import type { AccountRecord } from '../../../types.ts';
import { compareAccountRecords } from '../../accounts/model/accountPresentation.ts';
import { buildPriorityUpdates, reorderPriorityAccounts } from '../../accounts/model/accountRotation.ts';
import type { CodexAccountRow } from '../../codex/model/codexAccountList.ts';

export type ClaudeCodeAccountSourceKind = CodexAccountRow['sourceKind'];
export type ClaudeCodeAccountOrderEdge = 'top' | 'bottom';

export interface ClaudeCodeModelMappingRow {
  realModel: string;
  codexModel: string;
}

export interface ClaudeCodeAccountRow {
  id: string;
  label: string;
  sourceKind: ClaudeCodeAccountSourceKind;
  provider: string;
  priority?: number;
  requestable: boolean;
  blockReason: string;
  status: string;
  baseUrl: string;
  prefix: string;
  keySuffix: string;
  disabled?: boolean;
  apiKey?: string;
  apiKeys?: string[];
  headers?: Record<string, string>;
  quotaKey?: string;
  name?: string;
  supportedFormats: readonly string[];
  modelMappings: ClaudeCodeModelMappingRow[];
}

export interface ClaudeCodeAccountSummary {
  total: number;
  anthropic: number;
  requestable: number;
  blocked: number;
}

export interface ProviderDefaultModelProfile {
  providerId: string;
  providerName: string;
  source: 'official' | 'cc-switch' | 'gettokens-preset' | 'remote-models' | 'user';
  checkedAt: string;
  confidence: 'high' | 'medium' | 'fallback' | 'conflict';
  defaultModel: string;
  haikuModel?: string;
  sonnetModel?: string;
  opusModel?: string;
  baseUrl?: string;
  officialSwitchableModels: readonly string[];
  legacyPresetValues?: readonly string[];
  notes?: readonly string[];
}

interface AccountModelLike {
  name?: string;
  alias?: string;
}

export const CLAUDE_CODE_PROVIDER_DEFAULT_MODEL_PROFILES: readonly ProviderDefaultModelProfile[] = [
  {
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    source: 'official',
    checkedAt: '2026-06-16',
    confidence: 'high',
    defaultModel: 'deepseek-v4-pro[1m]',
    haikuModel: 'deepseek-v4-flash',
    sonnetModel: 'deepseek-v4-pro[1m]',
    opusModel: 'deepseek-v4-pro[1m]',
    baseUrl: 'https://api.deepseek.com/anthropic',
    officialSwitchableModels: ['deepseek-v4-pro[1m]', 'deepseek-v4-flash'],
    notes: ['CLAUDE_CODE_SUBAGENT_MODEL 和 CLAUDE_CODE_EFFORT_LEVEL 只属于 local apply extra env。'],
  },
  {
    providerId: 'bailian',
    providerName: '百炼',
    source: 'official',
    checkedAt: '2026-05-19',
    confidence: 'high',
    defaultModel: 'qwen3.6-plus',
    haikuModel: 'qwen3.6-flash',
    sonnetModel: 'qwen3.6-plus',
    opusModel: 'qwen3.6-plus',
    officialSwitchableModels: ['qwen3.6-plus', 'qwen3.6-flash'],
    notes: ['按 Token Plan、Coding Plan、Pay-as-you-go 分 profile；本表只表达默认模型语义。'],
  },
  {
    providerId: 'mimo',
    providerName: 'Xiaomi MiMo',
    source: 'official',
    checkedAt: '2026-05-19',
    confidence: 'high',
    defaultModel: 'mimo-v2.5-pro',
    haikuModel: 'mimo-v2.5-pro',
    sonnetModel: 'mimo-v2.5-pro',
    opusModel: 'mimo-v2.5-pro',
    officialSwitchableModels: ['mimo-v2.5-pro[1m]', 'mimo-v2.5-pro', 'mimo-v2-pro', 'mimo-v2.5', 'mimo-v2-omni', 'mimo-v2-flash', 'mimo-v2.5-tts'],
  },
  {
    providerId: 'minimax',
    providerName: 'MiniMax',
    source: 'official',
    checkedAt: '2026-06-16',
    confidence: 'high',
    defaultModel: 'MiniMax-M3',
    haikuModel: 'MiniMax-M3',
    sonnetModel: 'MiniMax-M3',
    opusModel: 'MiniMax-M3',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    officialSwitchableModels: ['MiniMax-M3', 'MiniMax-M2.7'],
    legacyPresetValues: ['MiniMax-M2.7'],
    notes: ['中国区使用 https://api.minimaxi.com/anthropic；国际区使用 https://api.minimax.io/anthropic；官方要求 API_TIMEOUT_MS=3000000。'],
  },
  {
    providerId: 'kimi',
    providerName: 'Kimi Moonshot',
    source: 'official',
    checkedAt: '2026-06-16',
    confidence: 'high',
    defaultModel: 'kimi-k2.7-code',
    haikuModel: 'kimi-k2.7-code',
    sonnetModel: 'kimi-k2.7-code',
    opusModel: 'kimi-k2.7-code',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    officialSwitchableModels: ['kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5'],
    legacyPresetValues: ['kimi-k2.6', 'kimi-k2.5'],
    notes: ['官方文档还建议 ENABLE_TOOL_SEARCH=false 与 CLAUDE_CODE_AUTO_COMPACT_WINDOW=262144；当前 local apply 尚未支持这两个额外字段。'],
  },
  {
    providerId: 'doubao',
    providerName: 'Doubao Ark Coding',
    source: 'official',
    checkedAt: '2026-06-16',
    confidence: 'high',
    defaultModel: 'ark-code-latest',
    haikuModel: 'ark-code-latest',
    sonnetModel: 'ark-code-latest',
    opusModel: 'ark-code-latest',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
    officialSwitchableModels: ['ark-code-latest', 'doubao-seed-2-0-code-preview-latest'],
    legacyPresetValues: ['doubao-seed-2-0-code-preview-latest'],
    notes: ['官方文档允许写 ark-code-latest 或控制台中的具体 Model_Name。'],
  },
  {
    providerId: 'stepfun',
    providerName: 'StepFun Step Plan',
    source: 'official',
    checkedAt: '2026-06-16',
    confidence: 'high',
    defaultModel: 'step-3.7-flash',
    haikuModel: 'step-3.7-flash',
    sonnetModel: 'step-3.7-flash',
    opusModel: 'step-3.7-flash',
    baseUrl: 'https://api.stepfun.com/step_plan',
    officialSwitchableModels: ['step-3.7-flash', 'step-3.6', 'step-3.5-flash-2603'],
  },
  {
    providerId: 'zhipu',
    providerName: 'Zhipu GLM Coding Plan',
    source: 'official',
    checkedAt: '2026-06-16',
    confidence: 'high',
    defaultModel: 'glm-5.2[1m]',
    haikuModel: 'glm-4.5-air',
    sonnetModel: 'glm-5.2[1m]',
    opusModel: 'glm-5.2[1m]',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    officialSwitchableModels: ['glm-5.2[1m]', 'glm-5.2', 'glm-4.5-air'],
    notes: ['官方 Claude Code 文档要求 API_TIMEOUT_MS=3000000；1M 上下文需模型后缀 [1m] 和 auto compact window。'],
  },
];

export function buildClaudeCodeAccountRows(accounts: AccountRecord[]): ClaudeCodeAccountRow[] {
  return accounts
    .filter(isClaudeCodeRequestAccount)
    .map((account) => mapAccountRecordToClaudeCodeRow(account))
    .sort(compareClaudeCodeAccountRows);
}

export function reorderClaudeCodeAccountRows<T extends { id: string; priority?: number }>(
  rows: T[],
  draggedID: string,
  targetID: string,
): T[] {
  return reorderPriorityAccounts(rows, draggedID, targetID);
}

export function moveClaudeCodeAccountRowToEdge<T extends { id: string }>(
  rows: T[],
  rowID: string,
  edge: ClaudeCodeAccountOrderEdge,
): T[] {
  const next = rows.slice();
  const rowIndex = next.findIndex((row) => row.id === rowID);
  if (rowIndex < 0) {
    return next;
  }

  const [row] = next.splice(rowIndex, 1);
  if (edge === 'top') {
    next.unshift(row);
  } else {
    next.push(row);
  }
  return next;
}

export function buildClaudeCodeAccountPriorityUpdates<T extends { id: string; priority?: number }>(rows: T[]) {
  return buildPriorityUpdates(rows);
}

export function applyClaudeCodeAccountPriorities<T extends { priority?: number }>(rows: T[]): T[] {
  const highestPriority = rows.length;
  return rows.map((row, index) => ({
    ...row,
    priority: highestPriority - index,
  }));
}

export function buildClaudeCodeAccountSummary(rows: readonly ClaudeCodeAccountRow[]): ClaudeCodeAccountSummary {
  return rows.reduce<ClaudeCodeAccountSummary>(
    (summary, row) => {
      summary.total += 1;
      if (row.supportedFormats.includes('anthropic')) {
        summary.anthropic += 1;
      }
      if (row.requestable) {
        summary.requestable += 1;
      } else {
        summary.blocked += 1;
      }
      return summary;
    },
    { total: 0, anthropic: 0, requestable: 0, blocked: 0 },
  );
}

export function buildClaudeCodeModelMappings(models: readonly AccountModelLike[]): ClaudeCodeModelMappingRow[] {
  const seen = new Set<string>();
  const result: ClaudeCodeModelMappingRow[] = [];
  for (const model of models) {
    const realModel = String(model.name || '').trim();
    const claudeModel = String(model.alias || '').trim();
    if (!realModel || !claudeModel || claudeModel === realModel) {
      continue;
    }
    const key = `${realModel}\n${claudeModel}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ realModel, codexModel: claudeModel });
  }
  return result;
}

export function normalizeClaudeCodeModelMappingsForProvider(
  rows: readonly ClaudeCodeModelMappingRow[],
): Array<{ name: string; alias: string }> {
  const seen = new Set<string>();
  const result: Array<{ name: string; alias: string }> = [];
  for (const row of rows) {
    const name = String(row.realModel || '').trim();
    const alias = String(row.codexModel || '').trim();
    if (!name) {
      continue;
    }
    const normalizedAlias = alias === name ? '' : alias;
    const key = `${name}\n${normalizedAlias}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ name, alias: normalizedAlias });
  }
  return result;
}

export function buildClaudeCodeProfileMappingDraft(input: {
  profile: ProviderDefaultModelProfile;
  sonnetAlias?: string;
  opusAlias?: string;
  haikuAlias?: string;
}): ClaudeCodeModelMappingRow[] {
  return buildClaudeCodeModelMappings([
    { name: input.profile.sonnetModel || input.profile.defaultModel, alias: input.sonnetAlias || '' },
    { name: input.profile.opusModel || input.profile.defaultModel, alias: input.opusAlias || '' },
    { name: input.profile.haikuModel || '', alias: input.haikuAlias || '' },
  ]);
}

export function resolveClaudeCodeProviderProfile(provider: string): ProviderDefaultModelProfile | null {
  const normalized = provider.trim().toLowerCase();
  const providerAliases: Record<string, string> = {
    minimaxi: 'minimax',
    moonshot: 'kimi',
    xiaomimimo: 'mimo',
    'xiaomimimo-token-plan': 'mimo',
  };
  const providerID = providerAliases[normalized] || normalized;
  return (
    CLAUDE_CODE_PROVIDER_DEFAULT_MODEL_PROFILES.find((profile) => profile.providerId === providerID) ||
    null
  );
}

function isClaudeCodeRequestAccount(account: AccountRecord) {
  return Array.isArray(account.supportedFormats) && account.supportedFormats.includes('anthropic');
}

function mapAccountRecordToClaudeCodeRow(account: AccountRecord): ClaudeCodeAccountRow {
  const status = String(account.status || '').trim();
  const requestable = isRequestableStatus(status) && !account.disabled;
  const provider = String(account.provider || '').trim();
  return {
    id: account.id,
    label: String(account.email || account.displayName || account.name || account.id).trim(),
    sourceKind: resolveSourceKind(account),
    provider,
    priority: account.priority,
    requestable,
    blockReason: requestable ? '' : buildAccountBlockReason(account),
    status,
    baseUrl: String(account.formatBaseUrls?.anthropic || account.baseUrl || '').trim(),
    prefix: String(account.prefix || '').trim(),
    keySuffix: String(account.keySuffix || '').trim(),
    disabled: account.disabled,
    apiKey: String(account.apiKey || ''),
    apiKeys: Array.isArray((account as AccountRecord & { apiKeys?: unknown }).apiKeys)
      ? (account as AccountRecord & { apiKeys?: string[] }).apiKeys
      : [],
    headers: readRecordStringMap((account as AccountRecord & { headers?: unknown }).headers),
    quotaKey: account.quotaKey,
    name: account.name,
    supportedFormats: account.supportedFormats || [],
    modelMappings: buildClaudeCodeModelMappings(readAccountModels(account)),
  };
}

function resolveSourceKind(account: AccountRecord): ClaudeCodeAccountSourceKind {
  if (account.accountKind === 'openai-compatible') {
    return 'openai-compatible';
  }
  return account.credentialSource === 'auth-file' ? 'codex-auth-file' : 'codex-api-key';
}

function readAccountModels(account: AccountRecord): AccountModelLike[] {
  const models = (account as AccountRecord & { models?: unknown }).models;
  return Array.isArray(models) ? models as AccountModelLike[] : [];
}

function readRecordStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((result, [key, item]) => {
    result[key] = String(item || '');
    return result;
  }, {});
}

function isRequestableStatus(status: string) {
  const normalized = status.trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'CONFIGURED' || normalized === 'LOCAL';
}

function buildAccountBlockReason(account: AccountRecord) {
  if (account.disabled) {
    return 'disabled';
  }
  return String(account.statusMessage || account.status || '').trim() || 'unavailable';
}

function compareClaudeCodeAccountRows(left: ClaudeCodeAccountRow, right: ClaudeCodeAccountRow) {
  const leftPriority = Number(left.priority || 0);
  const rightPriority = Number(right.priority || 0);
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }
  return compareAccountRecords(
    {
      id: left.id,
      provider: left.provider,
      credentialSource: left.sourceKind === 'codex-auth-file' ? 'auth-file' : 'api-key',
      displayName: left.label,
      status: left.status,
      priority: left.priority,
    },
    {
      id: right.id,
      provider: right.provider,
      credentialSource: right.sourceKind === 'codex-auth-file' ? 'auth-file' : 'api-key',
      displayName: right.label,
      status: right.status,
      priority: right.priority,
    },
  );
}
