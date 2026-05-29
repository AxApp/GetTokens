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
    checkedAt: '2026-05-19',
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
    sonnetModel: 'mimo-v2.5-pro',
    opusModel: 'mimo-v2.5-pro',
    officialSwitchableModels: ['mimo-v2.5-pro[1m]', 'mimo-v2.5', 'mimo-v2.5-tts'],
  },
  {
    providerId: 'minimax',
    providerName: 'MiniMax',
    source: 'official',
    checkedAt: '2026-05-19',
    confidence: 'high',
    defaultModel: 'MiniMax-M2.7',
    sonnetModel: 'MiniMax-M2.7',
    opusModel: 'MiniMax-M2.7',
    officialSwitchableModels: ['MiniMax-M2.7'],
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
  return (
    CLAUDE_CODE_PROVIDER_DEFAULT_MODEL_PROFILES.find((profile) => profile.providerId === normalized) ||
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
    supportedFormats: account.supportedFormats || [],
    modelMappings: buildClaudeCodeModelMappings(readAccountModels(account)),
  };
}

function resolveSourceKind(account: AccountRecord): ClaudeCodeAccountSourceKind {
  if (account.accountKind === 'openai-compatible' || account.id.startsWith('openai-compatible:')) {
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
