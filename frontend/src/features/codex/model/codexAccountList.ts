import type { AccountRecord, ApiFormat } from '../../../types';
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
  buildCodexRoutingProbeRequestInput,
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
export type CodexAccountDetailModuleID =
  | 'credentials'
  | 'auth-file-actions'
  | 'models'
  | 'rate-limit'
  | 'quota'
  | 'billing'
  | 'model-routing';

export interface CodexAccountRow {
  id: string;
  label: string;
  sourceKind: CodexAccountSourceKind;
  provider: string;
  quotaKey?: string;
  priority?: number;
  requestable: boolean;
  blockReason: string;
  requestabilityEvidence?: string[];
  manualRequestable?: boolean;
  status: string;
  baseUrl: string;
  prefix: string;
  keySuffix: string;
  disabled?: boolean;
  apiKey?: string;
  apiKeys?: string[];
  headers?: Record<string, string>;
  quotaCurl?: string;
  quotaEnabled?: boolean;
  billingCurl?: string;
  billingEnabled?: boolean;
  name?: string;
  email?: string;
  planType?: string;
  proxyUrl?: string;
  supportedFormats?: readonly string[];
  formatBaseUrls?: AccountRecord['formatBaseUrls'];
  models?: AccountRecord['models'];
  modelMappings: CodexModelMappingRow[];
}

export interface BuildCodexAccountRowsInput {
  accounts: AccountRecord[];
  providers: OpenAICompatibleProvider[];
  manualRequestableAccountIDs?: string[];
}

export type CodexAccountOrderEdge = 'top' | 'bottom';

export interface CodexAccountSummary {
  total: number;
  requestable: number;
  blocked: number;
  openAICompatible: number;
}

export function canEditCodexModelMappings(sourceKind: CodexAccountSourceKind): boolean {
  return sourceKind === 'openai-compatible' || sourceKind === 'codex-auth-file' || sourceKind === 'codex-api-key';
}

export function buildCodexAccountDetailModulePlan(
  row: Pick<CodexAccountRow, 'sourceKind'>,
): CodexAccountDetailModuleID[] {
  if (row.sourceKind === 'codex-auth-file') {
    return ['auth-file-actions', 'models', 'rate-limit', 'quota', 'billing', 'model-routing'];
  }

  return ['credentials', 'rate-limit', 'quota', 'billing', 'model-routing'];
}

export function buildCodexAccountRows(input: BuildCodexAccountRowsInput): CodexAccountRow[] {
  const manualRequestableAccountIDs = new Set(normalizeIDList(input.manualRequestableAccountIDs));
  const rows = [
    ...input.accounts
      .filter(isCodexRequestAccount)
      .map((account) => mapAccountRecordToCodexRow(account, manualRequestableAccountIDs)),
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

export function moveCodexAccountRowToEdge<T extends { id: string }>(
  rows: T[],
  rowID: string,
  edge: CodexAccountOrderEdge,
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

export function patchCodexAccountRowDisabled(row: CodexAccountRow, disabled: boolean): CodexAccountRow {
  const status = disabled
    ? 'disabled'
    : String(row.status || '').trim().toUpperCase() === 'DISABLED'
      ? 'configured'
      : row.status;
  const requestability = resolveCodexAccountRequestability({
    status,
    disabled,
    sourceKind: row.sourceKind,
    accountKind: sourceKindToAccountKind(row.sourceKind),
    evidence: row.requestabilityEvidence || [],
    manualRequestable: row.manualRequestable === true,
    statusMessage: row.blockReason,
  });
  return {
    ...row,
    disabled,
    requestable: requestability.requestable,
    blockReason: requestability.blockReason,
    requestabilityEvidence: requestability.evidence,
    manualRequestable: requestability.manualRequestable,
    status,
  };
}

export function patchCodexAccountRowManualRequestable(row: CodexAccountRow, manualRequestable: boolean): CodexAccountRow {
  const requestability = resolveCodexAccountRequestability({
    status: row.status,
    disabled: row.disabled,
    sourceKind: row.sourceKind,
    accountKind: sourceKindToAccountKind(row.sourceKind),
    evidence: (row.requestabilityEvidence || []).filter((item) => item !== 'manual'),
    manualRequestable,
    statusMessage: row.blockReason,
  });
  return {
    ...row,
    requestable: requestability.requestable,
    blockReason: requestability.blockReason,
    requestabilityEvidence: requestability.evidence,
    manualRequestable: requestability.manualRequestable,
  };
}

export function buildCodexQuotaSummaryAccount(row: CodexAccountRow): AccountRecord {
  return {
    id: row.id,
    provider: row.provider,
    credentialSource: row.sourceKind === 'codex-auth-file' ? 'auth-file' : 'api-key',
    displayName: row.label,
    status: row.status,
    disabled: row.disabled,
    baseUrl: row.baseUrl,
    prefix: row.prefix,
    quotaKey: row.quotaKey,
    quotaCurl: row.quotaCurl,
    quotaEnabled: row.quotaEnabled,
    billingCurl: row.billingCurl,
    billingEnabled: row.billingEnabled,
    name: row.name,
    email: row.email,
    planType: row.planType,
    apiKey: row.apiKey,
    apiKeys: row.apiKeys,
    headers: row.headers,
    keySuffix: row.keySuffix,
    proxyUrl: row.proxyUrl,
    supportedFormats: normalizeSupportedFormats(row.supportedFormats),
    formatBaseUrls: row.formatBaseUrls,
    models: row.models,
    requestability: {
      evidence: row.requestabilityEvidence || [],
      manual: row.manualRequestable === true,
    },
  };
}

function normalizeSupportedFormats(formats: readonly string[] | undefined): ApiFormat[] | undefined {
  if (!formats?.length) {
    return undefined;
  }
  return formats.filter(isApiFormat);
}

function isApiFormat(format: string): format is ApiFormat {
  return format === 'anthropic' || format === 'openai_chat' || format === 'openai_responses' || format === 'gemini_native';
}

function isCodexRequestAccount(account: AccountRecord) {
  const provider = String(account.provider || '').trim().toLowerCase();
  return provider === 'codex' || account.accountKind === 'codex-api-key';
}

function mapAccountRecordToCodexRow(account: AccountRecord, manualRequestableAccountIDs: Set<string>): CodexAccountRow {
  const status = String(account.status || '').trim();
  const sourceKind = account.credentialSource === 'auth-file' ? 'codex-auth-file' : 'codex-api-key';
  const requestability = resolveCodexAccountRequestability({
    status,
    disabled: Boolean(account.disabled),
    sourceKind,
    accountKind: account.accountKind,
    evidence: account.requestability?.evidence,
    manualRequestable: account.requestability?.manual === true || manualRequestableAccountIDs.has(account.id),
    statusMessage: account.statusMessage,
  });
  return {
    id: account.id,
    label: String(account.email || account.displayName || account.name || account.id).trim(),
    sourceKind,
    provider: String(account.provider || 'codex').trim(),
    quotaKey: account.quotaKey,
    priority: account.priority,
    requestable: requestability.requestable,
    blockReason: requestability.blockReason,
    requestabilityEvidence: requestability.evidence,
    manualRequestable: requestability.manualRequestable,
    status,
    baseUrl: String(account.baseUrl || '').trim(),
    prefix: String(account.prefix || '').trim(),
    keySuffix: String(account.keySuffix || '').trim(),
    disabled: account.disabled,
    apiKey: account.apiKey,
    apiKeys: account.apiKeys,
    headers: account.headers,
    quotaCurl: account.quotaCurl,
    quotaEnabled: account.quotaEnabled,
    billingCurl: account.billingCurl,
    billingEnabled: account.billingEnabled,
    name: account.name,
    email: account.email,
    planType: account.planType,
    proxyUrl: account.proxyUrl,
    supportedFormats: account.supportedFormats,
    formatBaseUrls: account.formatBaseUrls,
    models: account.models,
    modelMappings: sourceKind === 'codex-api-key'
      ? buildOpenAICompatibleModelMappings({ models: readAccountModels(account) })
      : [],
  };
}

function mapOpenAICompatibleProviderToCodexRow(provider: OpenAICompatibleProvider): CodexAccountRow {
  const name = String(provider.name || '').trim();
  const accountKey = String(provider.accountKey || '').trim();
  const disabled = Boolean(provider.disabled);
  const requestability = resolveCodexAccountRequestability({
    status: disabled ? 'disabled' : 'configured',
    disabled,
    sourceKind: 'openai-compatible',
    accountKind: 'openai-compatible',
    evidence: ['configured-provider'],
    manualRequestable: false,
  });
  return {
    id: accountKey || name,
    label: name || 'openai-compatible',
    sourceKind: 'openai-compatible',
    provider: name || 'openai-compatible',
    priority: Number(provider.priority || 0),
    requestable: requestability.requestable,
    blockReason: requestability.blockReason,
    requestabilityEvidence: requestability.evidence,
    manualRequestable: requestability.manualRequestable,
    status: disabled ? 'disabled' : 'configured',
    baseUrl: String(provider.baseUrl || '').trim(),
    prefix: String(provider.prefix || '').trim(),
    keySuffix: '',
    disabled,
    apiKey: String(provider.apiKey || ''),
    apiKeys: provider.apiKeys || [],
    headers: provider.headers || {},
    proxyUrl: String(provider.proxyUrl || ''),
    supportedFormats: ['openai_chat'],
    modelMappings: buildOpenAICompatibleModelMappings(provider),
  };
}

function isRequestableStatus(status: string) {
  const normalized = status.trim().toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'LOCAL' || normalized === 'READY' || normalized === 'OK';
}

function readAccountModels(account: AccountRecord): Array<{ name: string; alias?: string }> {
  const models = (account as AccountRecord & { models?: unknown }).models;
  if (!Array.isArray(models)) {
    return [];
  }
  return models.flatMap((model) => {
    if (!model || typeof model !== 'object') {
      return [];
    }
    const name = String((model as { name?: unknown }).name || '').trim();
    if (!name) {
      return [];
    }
    const alias = String((model as { alias?: unknown }).alias || '').trim();
    return [{ name, alias }];
  });
}

function sourceKindToAccountKind(sourceKind: CodexAccountSourceKind): string {
  switch (sourceKind) {
    case 'codex-auth-file':
      return 'auth-file';
    case 'codex-api-key':
      return 'codex-api-key';
    case 'openai-compatible':
      return 'openai-compatible';
    default:
      return '';
  }
}

function normalizeRequestabilityEvidence(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const evidence = String(item ?? '').trim().toLowerCase();
    if (!evidence || seen.has(evidence)) {
      continue;
    }
    seen.add(evidence);
    out.push(evidence);
  }
  return out;
}

function normalizeIDList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const id = String(item ?? '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function hasRequestabilityEvidence(evidence: string[]): boolean {
  return evidence.some((item) =>
    ['active', 'local', 'ready', 'ok', 'verified', 'manual', 'usage', 'quota', 'configured-provider'].includes(item),
  );
}

function resolveCodexAccountRequestability(input: {
  status: string;
  disabled?: boolean;
  sourceKind: CodexAccountSourceKind;
  accountKind?: string;
  evidence?: unknown;
  manualRequestable?: boolean;
  statusMessage?: string;
}): { requestable: boolean; blockReason: string; evidence: string[]; manualRequestable: boolean } {
  const evidence = normalizeRequestabilityEvidence(input.evidence);
  const manualRequestable = input.manualRequestable === true;
  if (manualRequestable && !evidence.includes('manual')) {
    evidence.push('manual');
  }
  const status = String(input.status || '').trim();
  const normalizedStatus = status.toUpperCase();

  if (input.disabled || normalizedStatus === 'DISABLED') {
    return { requestable: false, blockReason: 'disabled', evidence, manualRequestable };
  }
  if (isRequestableStatus(status) && !evidence.includes(normalizedStatus.toLowerCase())) {
    evidence.push(normalizedStatus.toLowerCase());
  }
  if (input.sourceKind === 'openai-compatible' || String(input.accountKind || '').trim() === 'openai-compatible') {
    if (!evidence.includes('configured-provider')) {
      evidence.push('configured-provider');
    }
  }
  if (hasRequestabilityEvidence(evidence)) {
    return { requestable: true, blockReason: '', evidence, manualRequestable };
  }
  if (normalizedStatus === 'CONFIGURED' || normalizedStatus === '') {
    return { requestable: false, blockReason: 'waiting-check', evidence, manualRequestable };
  }
  return {
    requestable: false,
    blockReason: String(input.statusMessage || status).trim() || 'unavailable',
    evidence,
    manualRequestable,
  };
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
