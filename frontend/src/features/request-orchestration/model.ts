import type { AccountRecord } from '../../types';
import { buildProxyURLFromNode, type ProxyNodeRecord } from '../proxy-pool/model.ts';

export type RequestEntryCLI = 'codex' | 'claude-code';
export type FlowTestStatus = 'pending' | 'accepted' | 'blocked';

export interface RequestAccount {
  id: string;
  name: string;
  groupID: string;
  provider: string;
  entrySupport: RequestEntryCLI[];
  modelMappings: Record<string, string>;
  proxyPoolEnabled: boolean;
  defaultRouteID: string | null;
  disabled?: boolean;
}

export interface RequestAccountGroup {
  id: string;
  label: string;
  note: string;
}

export interface RequestProxyRoute {
  id: string;
  label: string;
  note: string;
  disabled?: boolean;
}

export interface RequestFlow {
  id: string;
  label: string;
  cli: RequestEntryCLI;
  groupID: string;
  accountID: string | null;
  enabledAccountIDs: string[];
  routes: Record<string, string | null>;
  applied: boolean;
  test: {
    status: FlowTestStatus;
    time?: string;
    reason?: string;
  } | null;
}

export interface ComputedRequestAccount extends RequestAccount {
  inGroup: boolean;
  cliOk: boolean;
  targetModel: string | null;
  modelOk: boolean;
  routeID: string;
  route: RequestProxyRoute;
  routeOk: boolean;
  enabled: boolean;
  included: boolean;
  usable: boolean;
  active: boolean;
  reasons: string[];
}

export const REQUEST_ORCHESTRATION_FLOWS_STORAGE_KEY = 'gettokens.request-orchestration.flows';
export const REQUEST_ORCHESTRATION_ACCOUNT_OVERRIDES_STORAGE_KEY = 'gettokens.request-orchestration.account-overrides';

export type RequestAccountOverride = Partial<Pick<RequestAccount, 'disabled' | 'proxyPoolEnabled'>>;
export type RequestAccountOverrides = Record<string, RequestAccountOverride>;

export interface RequestProviderModelSource {
  name: string;
  baseUrl?: string;
  prefix?: string;
  apiKey?: string;
  disabled?: boolean;
  priority?: number;
  models?: Array<{ name?: string; alias?: string }>;
}

export const entryModelByCLI: Record<RequestEntryCLI, string> = {
  codex: 'gpt-5.5',
  'claude-code': 'claude-sonnet-4.5',
};

export const requestEntries: ReadonlyArray<{ id: RequestEntryCLI; label: string; note: string }> = [
  { id: 'codex', label: 'codex', note: 'Codex 请求入口' },
  { id: 'claude-code', label: 'claude code', note: 'Claude Code 请求入口' },
];

export const requestAccountGroups: RequestAccountGroup[] = [
  { id: 'codex', label: 'Codex 生产组', note: '面向 Codex 的主力账号' },
  { id: 'claude', label: 'Claude 灰度组', note: '面向 Claude Code 的灰度账号' },
];

export const requestAccounts: RequestAccount[] = [
  {
    id: 'codex-prod-01',
    name: 'codex-prod-01',
    groupID: 'codex',
    provider: 'OpenAI',
    entrySupport: ['codex'],
    modelMappings: { 'codex:gpt-5.5': 'gpt-5.5' },
    proxyPoolEnabled: false,
    defaultRouteID: null,
  },
  {
    id: 'codex-lab-02',
    name: 'codex-lab-02',
    groupID: 'codex',
    provider: 'OpenAI',
    entrySupport: ['codex', 'claude-code'],
    modelMappings: {
      'codex:gpt-5.5': 'gpt-5.4-mini',
      'claude-code:claude-sonnet-4.5': 'claude-sonnet-4.5',
    },
    proxyPoolEnabled: true,
    defaultRouteID: 'hk-resi-03',
  },
  {
    id: 'openai-compatible:deepseek',
    name: 'deepseek',
    groupID: 'openai-compatible',
    provider: 'deepseek',
    entrySupport: ['codex'],
    modelMappings: { 'codex:gpt-5.5': 'deepseek-chat' },
    proxyPoolEnabled: false,
    defaultRouteID: null,
  },
  {
    id: 'claude-prod-01',
    name: 'claude-prod-01',
    groupID: 'claude',
    provider: 'Anthropic',
    entrySupport: ['claude-code'],
    modelMappings: { 'claude-code:claude-sonnet-4.5': 'claude-sonnet-4.5' },
    proxyPoolEnabled: true,
    defaultRouteID: 'sg-biz-01',
  },
  {
    id: 'bridge-01',
    name: 'bridge-01',
    groupID: 'claude',
    provider: 'Bridge',
    entrySupport: ['codex', 'claude-code'],
    modelMappings: {
      'codex:gpt-5.5': 'gpt-5.4-mini',
      'claude-code:claude-sonnet-4.5': 'claude-sonnet-4.5',
    },
    proxyPoolEnabled: false,
    defaultRouteID: null,
  },
];

export const requestProxyRoutes: RequestProxyRoute[] = [
  { id: 'direct', label: '直连', note: '系统出口，不走代理池' },
  { id: 'hk-resi-03', label: 'hk-resi-03', note: '住宅出口 / Hong Kong' },
  { id: 'sg-biz-01', label: 'sg-biz-01', note: '商务出口 / Singapore' },
  { id: 'us-static-02', label: 'us-static-02', note: '静态出口 / US West' },
];

export const initialRequestFlows: RequestFlow[] = [
  {
    id: 'default',
    label: '默认组',
    cli: 'codex',
    groupID: 'codex',
    accountID: 'codex-prod-01',
    enabledAccountIDs: ['codex-prod-01', 'codex-lab-02'],
    routes: { 'codex-prod-01': null, 'codex-lab-02': 'hk-resi-03' },
    applied: false,
    test: null,
  },
  {
    id: 'custom-flow-01',
    label: '自定义组 01',
    cli: 'codex',
    groupID: 'codex',
    accountID: 'codex-lab-02',
    enabledAccountIDs: ['codex-lab-02'],
    routes: { 'codex-lab-02': 'hk-resi-03' },
    applied: false,
    test: null,
  },
];

export function cloneRequestFlows(flows: RequestFlow[] = initialRequestFlows): RequestFlow[] {
  return JSON.parse(JSON.stringify(flows)) as RequestFlow[];
}

export function getModelKey(flow: Pick<RequestFlow, 'cli'>): string {
  return `${flow.cli}:${entryModelByCLI[flow.cli]}`;
}

export function computeRequestAccount(
  account: RequestAccount,
  flow: RequestFlow,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): ComputedRequestAccount {
  const inGroup = account.groupID === flow.groupID;
  const cliOk = account.entrySupport.includes(flow.cli);
  const targetModel = account.modelMappings[getModelKey(flow)] ?? null;
  const modelOk = Boolean(targetModel);
  const configuredRouteID = Object.prototype.hasOwnProperty.call(flow.routes, account.id)
    ? flow.routes[account.id]
    : account.defaultRouteID;
  const routeID = account.proxyPoolEnabled ? configuredRouteID || 'direct' : 'direct';
  const matchedRoute = routes.find((item) => item.id === routeID);
  const route = matchedRoute ?? routes[0];
  const routeOk = account.proxyPoolEnabled
    ? routeID !== 'direct' && Boolean(matchedRoute) && !matchedRoute?.disabled
    : routeID === 'direct';
  const enabled = !account.disabled;
  const included = flow.enabledAccountIDs.includes(account.id);
  const usable = inGroup && cliOk && modelOk && enabled && routeOk;
  const active = included && usable;
  const reasons: string[] = [];
  if (!inGroup) reasons.push('不在当前账号组');
  if (!cliOk) reasons.push('CLI 不兼容');
  if (cliOk && !modelOk) reasons.push('缺少模型映射');
  if (!enabled) reasons.push('账号已禁用');
  if (!routeOk) reasons.push(account.proxyPoolEnabled ? '未选择可用代理' : '代理不可用');
  if (usable && !included) reasons.push('未勾选参与');

  return {
    ...account,
    inGroup,
    cliOk,
    targetModel,
    modelOk,
    routeID,
    route,
    routeOk,
    enabled,
    included,
    usable,
    active,
    reasons,
  };
}

export function getUsableAccountsForGroup(
  flow: RequestFlow,
  groupID: string,
  accounts: RequestAccount[] = requestAccounts,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): ComputedRequestAccount[] {
  const scopedFlow = { ...flow, groupID };
  return accounts
    .map((account) => computeRequestAccount(account, scopedFlow, routes))
    .filter((account) => account.groupID === groupID && account.usable);
}

export function getCompatibleAccountsForGroup(
  flow: RequestFlow,
  groupID: string,
  accounts: RequestAccount[] = requestAccounts,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): ComputedRequestAccount[] {
  const scopedFlow = { ...flow, groupID };
  return accounts
    .map((account) => computeRequestAccount(account, scopedFlow, routes))
    .filter((account) => account.groupID === groupID && account.active);
}

export function selectFirstCompatibleAccount(
  flow: RequestFlow,
  accounts: RequestAccount[] = requestAccounts,
  groups: RequestAccountGroup[] = requestAccountGroups,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): RequestFlow {
  const currentGroupUsableAccounts = getUsableAccountsForGroup(flow, flow.groupID, accounts, routes);
  if (currentGroupUsableAccounts.length > 0) {
    const usableIDs = currentGroupUsableAccounts.map((account) => account.id);
    const enabledAccountIDs = flow.enabledAccountIDs.filter((accountID) => usableIDs.includes(accountID));
    const nextEnabledAccountIDs = enabledAccountIDs.length > 0 ? enabledAccountIDs : usableIDs;
    const accountID = flow.accountID && nextEnabledAccountIDs.includes(flow.accountID)
      ? flow.accountID
      : nextEnabledAccountIDs[0] ?? null;
    return { ...flow, enabledAccountIDs: nextEnabledAccountIDs, accountID };
  }

  const nextGroup = groups.find((group) => getUsableAccountsForGroup(flow, group.id, accounts, routes).length > 0);
  if (nextGroup) {
    const usableIDs = getUsableAccountsForGroup(flow, nextGroup.id, accounts, routes).map((account) => account.id);
    return {
      ...flow,
      groupID: nextGroup.id,
      enabledAccountIDs: usableIDs,
      accountID: usableIDs[0] ?? null,
    };
  }

  return {
    ...flow,
    enabledAccountIDs: [],
    accountID: accounts.find((account) => account.groupID === flow.groupID)?.id ?? null,
  };
}

export function toggleFlowAccountEnabled(
  flow: RequestFlow,
  accountID: string,
  accounts: RequestAccount[] = requestAccounts,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): RequestFlow {
  const enabledAccountIDSet = new Set(flow.enabledAccountIDs);
  if (enabledAccountIDSet.has(accountID)) {
    enabledAccountIDSet.delete(accountID);
  } else {
    enabledAccountIDSet.add(accountID);
  }

  const enabledAccountIDs = Array.from(enabledAccountIDSet).filter((id) =>
    accounts.some((account) => account.id === id && account.groupID === flow.groupID),
  );
  const nextFlow = { ...flow, enabledAccountIDs };
  const currentAccount = getCurrentAccount(nextFlow, accounts, routes);
  if (currentAccount?.active) {
    return nextFlow;
  }

  const nextAccount = accounts
    .map((account) => computeRequestAccount(account, nextFlow, routes))
    .find((account) => account.groupID === flow.groupID && account.active);

  return {
    ...nextFlow,
    accountID: nextAccount?.id ?? null,
  };
}

export function getCurrentAccount(
  flow: RequestFlow,
  accounts: RequestAccount[] = requestAccounts,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): ComputedRequestAccount | null {
  const computed = accounts.map((account) => computeRequestAccount(account, flow, routes));
  return computed.find((account) => account.id === flow.accountID) ?? computed.find((account) => account.inGroup) ?? null;
}

export function getVisibleRoutesForAccount(
  account: ComputedRequestAccount | null,
  routes: RequestProxyRoute[] = requestProxyRoutes,
): RequestProxyRoute[] {
  if (!account) return [];
  if (!account.proxyPoolEnabled) {
    return routes.filter((route) => route.id === 'direct');
  }
  return routes.filter((route) => route.id !== 'direct');
}

export function getFirstProxyRouteID(routes: readonly RequestProxyRoute[]): string | null {
  return routes.find((route) => route.id !== 'direct' && !route.disabled)?.id ?? null;
}

export function enableProxyPoolForFlowAccount(
  flow: RequestFlow,
  accountID: string,
  routes: readonly RequestProxyRoute[],
): RequestFlow {
  const currentRouteID = Object.prototype.hasOwnProperty.call(flow.routes, accountID) ? flow.routes[accountID] : null;
  if (currentRouteID && currentRouteID !== 'direct') {
    return flow;
  }

  const proxyRouteID = getFirstProxyRouteID(routes);
  if (!proxyRouteID) {
    return flow;
  }

  return {
    ...flow,
    routes: {
      ...flow.routes,
      [accountID]: proxyRouteID,
    },
  };
}

export function buildFlowTest(flow: RequestFlow, account: ComputedRequestAccount | null, time: string): RequestFlow['test'] {
  if (!account?.active) {
    return {
      status: 'blocked',
      time,
      reason: account?.reasons.join(' / ') || '无可用账号',
    };
  }
  return { status: 'accepted', time };
}

function normalizeProvider(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function hasProviderToken(account: Pick<AccountRecord, 'provider' | 'id' | 'displayName'>, token: string): boolean {
  const normalized = `${account.provider || ''} ${account.id || ''} ${account.displayName || ''}`.toLowerCase();
  return normalized.includes(token);
}

function resolveRequestAccountGroupID(account: AccountRecord): string {
  if (hasProviderToken(account, 'claude') || hasProviderToken(account, 'anthropic')) {
    return 'claude';
  }
  if (String(account.id || '').startsWith('openai-compatible:')) {
    return 'openai-compatible';
  }
  if (account.credentialSource === 'api-key' && normalizeProvider(account.provider) !== 'codex') {
    return 'openai-compatible';
  }
  return 'codex';
}

function resolveEntrySupport(account: AccountRecord): RequestEntryCLI[] {
  if (hasProviderToken(account, 'bridge')) {
    return ['codex', 'claude-code'];
  }
  if (hasProviderToken(account, 'claude') || hasProviderToken(account, 'anthropic')) {
    return ['claude-code'];
  }
  return ['codex'];
}

function buildDefaultModelMappings(entrySupport: RequestEntryCLI[], targetModels: readonly string[] = []): Record<string, string> {
  const mappings: Record<string, string> = {};
  for (const cli of entrySupport) {
    const entryModel = entryModelByCLI[cli];
    mappings[`${cli}:${entryModel}`] = targetModels.includes(entryModel) ? entryModel : targetModels[0] || entryModel;
  }
  return mappings;
}

function openAICompatibleAccountID(name: string): string {
  return `openai-compatible:${String(name || '').trim()}`;
}

export function buildOpenAICompatibleModelMap(providers: readonly RequestProviderModelSource[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const provider of providers) {
    const id = openAICompatibleAccountID(provider.name);
    const models = (provider.models || [])
      .map((model) => String(model.name || '').trim())
      .filter((name, index, all) => name && all.indexOf(name) === index);
    if (models.length > 0) {
      result[id] = models;
    }
  }
  return result;
}

export function mapOpenAICompatibleProvidersToAccountRecords(providers: readonly RequestProviderModelSource[]): AccountRecord[] {
  const records: AccountRecord[] = [];
  for (const provider of providers) {
    const name = String(provider.name || '').trim();
    if (!name) {
      continue;
    }

    records.push({
      id: openAICompatibleAccountID(name),
      provider: name.toLowerCase(),
      credentialSource: 'api-key',
      displayName: `兼容 OpenAI · ${name}`,
      status: provider.disabled ? 'DISABLED' : 'CONFIGURED',
      priority: Number(provider.priority || 0),
      disabled: Boolean(provider.disabled),
      name,
      apiKey: String(provider.apiKey || '').trim(),
      baseUrl: String(provider.baseUrl || '').trim(),
      prefix: String(provider.prefix || '').trim(),
    });
  }
  return records;
}

export function mapAccountRecordsToRequestAccounts(
  records: readonly AccountRecord[],
  modelMap: Record<string, string[]> = {},
): RequestAccount[] {
  return records.map((record) => {
    const entrySupport = resolveEntrySupport(record);
    const targetModels = modelMap[record.id] || [];
    return {
      id: record.id,
      name: record.displayName || record.name || record.id,
      groupID: resolveRequestAccountGroupID(record),
      provider: String(record.provider || 'unknown').trim() || 'unknown',
      entrySupport,
      modelMappings: buildDefaultModelMappings(entrySupport, targetModels),
      proxyPoolEnabled: false,
      defaultRouteID: null,
      disabled: Boolean(record.disabled),
    };
  });
}

export function buildRequestAccountGroups(accounts: readonly RequestAccount[]): RequestAccountGroup[] {
  const knownGroups: RequestAccountGroup[] = [
    { id: 'codex', label: 'Codex 账号组', note: 'Codex auth file 与 Codex API key' },
    { id: 'openai-compatible', label: 'OpenAI-Compatible 组', note: 'OpenAI 兼容 provider' },
    { id: 'claude', label: 'Claude 账号组', note: 'Claude Code / Anthropic 账号' },
  ];
  const accountGroupIDs = new Set(accounts.map((account) => account.groupID));
  const groups = knownGroups.filter((group) => accountGroupIDs.has(group.id));
  return groups.length > 0 ? groups : requestAccountGroups;
}

export function mapProxyNodesToRequestRoutes(nodes: readonly ProxyNodeRecord[]): RequestProxyRoute[] {
  const routes: RequestProxyRoute[] = [{ id: 'direct', label: '直连', note: '系统出口，不走代理池' }];
  for (const node of nodes) {
    if (node.status !== 'available') {
      continue;
    }
    const proxyURL = buildProxyURLFromNode(node);
    routes.push({
      id: node.id,
      label: node.name || node.id,
      note: `${node.group} / ${proxyURL} / ${node.latencyMs}ms / ${node.availabilityRate}%`,
    });
  }
  return routes;
}

function isRequestEntryCLI(value: unknown): value is RequestEntryCLI {
  return value === 'codex' || value === 'claude-code';
}

function isFlowTestStatus(value: unknown): value is FlowTestStatus {
  return value === 'pending' || value === 'accepted' || value === 'blocked';
}

function isRoutesRecord(value: unknown): value is Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((item) => item === null || typeof item === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRequestFlow(value: unknown): value is RequestFlow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const flow = value as Record<string, unknown>;
  const test = flow.test;
  const testOk =
    test === null ||
    (typeof test === 'object' &&
      !Array.isArray(test) &&
      isFlowTestStatus((test as Record<string, unknown>).status) &&
      (typeof (test as Record<string, unknown>).time === 'undefined' || typeof (test as Record<string, unknown>).time === 'string') &&
      (typeof (test as Record<string, unknown>).reason === 'undefined' || typeof (test as Record<string, unknown>).reason === 'string'));

  return (
    typeof flow.id === 'string' &&
    typeof flow.label === 'string' &&
    isRequestEntryCLI(flow.cli) &&
    typeof flow.groupID === 'string' &&
    (flow.accountID === null || typeof flow.accountID === 'string') &&
    (typeof flow.enabledAccountIDs === 'undefined' || isStringArray(flow.enabledAccountIDs)) &&
    isRoutesRecord(flow.routes) &&
    typeof flow.applied === 'boolean' &&
    testOk
  );
}

export function readStoredRequestFlows(storage: Pick<Storage, 'getItem'> | null): RequestFlow[] | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(REQUEST_ORCHESTRATION_FLOWS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isRequestFlow)) {
      return null;
    }
    return parsed.length > 0 ? cloneRequestFlows(parsed) : null;
  } catch {
    return null;
  }
}

export function persistRequestFlows(storage: Pick<Storage, 'setItem'> | null, flows: readonly RequestFlow[]) {
  storage?.setItem(REQUEST_ORCHESTRATION_FLOWS_STORAGE_KEY, JSON.stringify(flows));
}

function isRequestAccountOverride(value: unknown): value is RequestAccountOverride {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const override = value as Record<string, unknown>;
  return (
    (typeof override.disabled === 'undefined' || typeof override.disabled === 'boolean') &&
    (typeof override.proxyPoolEnabled === 'undefined' || typeof override.proxyPoolEnabled === 'boolean')
  );
}

export function readStoredRequestAccountOverrides(storage: Pick<Storage, 'getItem'> | null): RequestAccountOverrides {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(REQUEST_ORCHESTRATION_ACCOUNT_OVERRIDES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: RequestAccountOverrides = {};
    for (const [accountID, override] of Object.entries(parsed)) {
      if (typeof accountID !== 'string' || !isRequestAccountOverride(override)) {
        continue;
      }
      result[accountID] = override;
    }
    return result;
  } catch {
    return {};
  }
}

export function persistRequestAccountOverrides(
  storage: Pick<Storage, 'setItem'> | null,
  overrides: RequestAccountOverrides,
) {
  const normalized: RequestAccountOverrides = {};
  for (const [accountID, override] of Object.entries(overrides)) {
    if (!isRequestAccountOverride(override)) {
      continue;
    }
    normalized[accountID] = override;
  }
  storage?.setItem(REQUEST_ORCHESTRATION_ACCOUNT_OVERRIDES_STORAGE_KEY, JSON.stringify(normalized));
}

export function reconcileRequestFlows(
  flows: readonly RequestFlow[],
  accounts: readonly RequestAccount[],
  groups: readonly RequestAccountGroup[],
  routes: readonly RequestProxyRoute[],
): RequestFlow[] {
  const safeGroups = groups.length > 0 ? groups : requestAccountGroups;
  const groupIDs = new Set(safeGroups.map((group) => group.id));
  const accountIDs = new Set(accounts.map((account) => account.id));
  const routeIDs = new Set(routes.map((route) => route.id));

  return flows.map((flow) => {
    const groupID = groupIDs.has(flow.groupID) ? flow.groupID : safeGroups[0]?.id ?? 'codex';
    const routesForKnownAccounts: Record<string, string | null> = {};
    for (const [accountID, routeID] of Object.entries(flow.routes || {})) {
      if (!accountIDs.has(accountID)) {
        continue;
      }
      if (routeID !== null && !routeIDs.has(routeID)) {
        continue;
      }
      routesForKnownAccounts[accountID] = routeID;
    }

    const scopedFlow: RequestFlow = {
      ...flow,
      groupID,
      accountID: flow.accountID && accountIDs.has(flow.accountID) ? flow.accountID : null,
      enabledAccountIDs: (Array.isArray(flow.enabledAccountIDs) ? flow.enabledAccountIDs : []).filter((accountID) => accountIDs.has(accountID)),
      routes: routesForKnownAccounts,
    };

    if (scopedFlow.enabledAccountIDs.length === 0 || !scopedFlow.accountID) {
      return selectFirstCompatibleAccount(scopedFlow, [...accounts], [...safeGroups], [...routes]);
    }

    const currentAccount = getCurrentAccount(scopedFlow, [...accounts], [...routes]);
    if (!currentAccount?.active) {
      const nextAccount = getCompatibleAccountsForGroup(scopedFlow, scopedFlow.groupID, [...accounts], [...routes])[0];
      return {
        ...scopedFlow,
        accountID: nextAccount?.id ?? scopedFlow.accountID,
      };
    }

    return scopedFlow;
  });
}
