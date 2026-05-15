import type { AccountRecord } from '../../../types';
import type { OpenAICompatibleProvider } from '../../accounts/model/openAICompatible.ts';
import { compareAccountRecords } from '../../accounts/model/accountPresentation.ts';
import { buildPriorityUpdates, reorderPriorityAccounts } from '../../accounts/model/accountRotation.ts';
import { buildOpenAICompatibleModelMappings, type CodexModelMappingRow } from './codexModelMappings.ts';

export {
  buildCodexAuthFileModelMappings,
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  buildOpenAICompatibleModelMappings,
  mergeCodexAuthFileModelMappings,
  normalizeCodexModelMappingsForProvider,
  type CodexAuthFileModelLike,
  type CodexModelMappingRow,
} from './codexModelMappings.ts';
export {
  buildCodexRoutePolicyPreview,
  buildCodexRoutePolicyRowStates,
  buildCodexRoutePolicySummary,
  buildCodexRoutingProbeModelOptions,
  buildCodexRoutingProbeStreamLines,
  DEFAULT_CODEX_ROUTING_PROBE_MODEL,
  normalizeCodexAccountIDList,
  resolveCodexRoutingProbeDefaultModel,
  summarizeCodexRoutingProbeAttempt,
  type CodexRoutePolicyDraft,
  type CodexRoutePolicyRowMode,
  type CodexRoutePolicyRowState,
  type CodexRoutePolicySummary,
  type CodexRoutingProbeAttemptView,
  type CodexRoutingProbeStreamLine,
  type CodexRoutingProbeStreamLineStatus,
} from './codexRoutePolicy.ts';

export type CodexAccountSourceKind = 'codex-auth-file' | 'codex-api-key' | 'openai-compatible';

export interface CodexAccountRow {
  id: string;
  label: string;
  sourceKind: CodexAccountSourceKind;
  provider: string;
  quotaKey?: string;
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
  modelMappings: CodexModelMappingRow[];
}

export interface BuildCodexAccountRowsInput {
  accounts: AccountRecord[];
  providers: OpenAICompatibleProvider[];
}

export interface CodexAccountSummary {
  total: number;
  requestable: number;
  blocked: number;
  openAICompatible: number;
}

export function buildCodexAccountRows(input: BuildCodexAccountRowsInput): CodexAccountRow[] {
  const rows = [
    ...input.accounts
      .filter(isCodexRequestAccount)
      .map((account) => mapAccountRecordToCodexRow(account)),
    ...input.providers.map((provider) => mapOpenAICompatibleProviderToCodexRow(provider)),
  ];

  return rows.sort(compareCodexAccountRows);
}

export function reorderCodexAccountRows<T extends { id: string; priority?: number }>(
  rows: T[],
  draggedID: string,
  targetID: string,
): T[] {
  return reorderPriorityAccounts(rows, draggedID, targetID);
}

export function buildCodexAccountPriorityUpdates<T extends { id: string; priority?: number }>(rows: T[]) {
  return buildPriorityUpdates(rows);
}

export function applyCodexAccountPriorities<T extends { priority?: number }>(rows: T[]): T[] {
  const highestPriority = rows.length;
  return rows.map((row, index) => ({
    ...row,
    priority: highestPriority - index,
  }));
}

export function buildCodexAccountSummary(rows: Array<Pick<CodexAccountRow, 'requestable' | 'sourceKind'>>) {
  return rows.reduce<CodexAccountSummary>(
    (summary, row) => {
      summary.total += 1;
      if (row.requestable) {
        summary.requestable += 1;
      } else {
        summary.blocked += 1;
      }
      if (row.sourceKind === 'openai-compatible') {
        summary.openAICompatible += 1;
      }
      return summary;
    },
    {
      total: 0,
      requestable: 0,
      blocked: 0,
      openAICompatible: 0,
    },
  );
}

function isCodexRequestAccount(account: AccountRecord) {
  const id = String(account.id || '').trim();
  const provider = String(account.provider || '').trim().toLowerCase();
  return provider === 'codex' || id.startsWith('codex-api-key:');
}

function mapAccountRecordToCodexRow(account: AccountRecord): CodexAccountRow {
  const status = String(account.status || '').trim();
  const requestable = isRequestableStatus(status) && !account.disabled;
  return {
    id: account.id,
    label: String(account.email || account.displayName || account.name || account.id).trim(),
    sourceKind: account.credentialSource === 'auth-file' ? 'codex-auth-file' : 'codex-api-key',
    provider: String(account.provider || 'codex').trim(),
    quotaKey: account.quotaKey,
    priority: account.priority,
    requestable,
    blockReason: requestable ? '' : buildAccountBlockReason(account),
    status,
    baseUrl: String(account.baseUrl || '').trim(),
    prefix: String(account.prefix || '').trim(),
    keySuffix: String(account.keySuffix || '').trim(),
    disabled: account.disabled,
    modelMappings: [],
  };
}

function mapOpenAICompatibleProviderToCodexRow(provider: OpenAICompatibleProvider): CodexAccountRow {
  const name = String(provider.name || '').trim();
  const disabled = Boolean(provider.disabled);
  return {
    id: `openai-compatible:${name}`,
    label: name || 'openai-compatible',
    sourceKind: 'openai-compatible',
    provider: name || 'openai-compatible',
    priority: Number(provider.priority || 0),
    requestable: !disabled,
    blockReason: disabled ? 'disabled' : '',
    status: disabled ? 'disabled' : 'configured',
    baseUrl: String(provider.baseUrl || '').trim(),
    prefix: String(provider.prefix || '').trim(),
    keySuffix: '',
    disabled,
    apiKey: String(provider.apiKey || ''),
    apiKeys: provider.apiKeys || [],
    headers: provider.headers || {},
    modelMappings: buildOpenAICompatibleModelMappings(provider),
  };
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

function compareCodexAccountRows(left: CodexAccountRow, right: CodexAccountRow) {
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
