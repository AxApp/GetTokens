export const CHANNEL_ROUTE_MODES = ['sequential', 'balanced'] as const;
export const PROJECT_MODE_FALLBACK_ROUTE_MODES = ['sequential', 'balanced'] as const;
export const CHANNEL_FALLBACK_MODES = ['fail-closed', 'fallback-default', 'fallback-global'] as const;
export const UPSTREAM_COMPAT_ROUTE_MODES = ['dedicated', 'prefer', 'ordered', 'weighted', 'canary'] as const;
export const LEGACY_CHANNEL_ROUTING_BYPASS_IDS = ['session-affinity', 'websocket-pin', 'route-order-header'] as const;

export type ChannelID = 'codex' | 'claude';
export type ChannelRouteMode = (typeof CHANNEL_ROUTE_MODES)[number];
export type ProjectModeFallbackRouteMode = (typeof PROJECT_MODE_FALLBACK_ROUTE_MODES)[number];
export type ChannelFallbackMode = (typeof CHANNEL_FALLBACK_MODES)[number];
export type UpstreamCompatRouteMode = (typeof UPSTREAM_COMPAT_ROUTE_MODES)[number];

export type ChannelRouteModeClassification =
  | {
      kind: 'gettokens';
      mode: ChannelRouteMode;
    }
  | {
      kind: 'upstream-compat';
      mode: UpstreamCompatRouteMode;
    }
  | {
      kind: 'invalid';
      mode: string;
    };

export interface ChannelGroupState {
  enabled: boolean;
  routeOrder?: number;
}

export interface ChannelAccountGroup {
  id: string;
  name?: string;
  enabled: boolean;
  routeOrder?: number;
  accountIDs: string[];
}

export interface ChannelProjectBinding {
  projectName: string;
  targetType: 'account' | 'group';
  targetID: string;
  fallbackMode: ChannelFallbackMode;
}

export interface ChannelRoutingConfig {
  channel: ChannelID;
  routeMode: ChannelRouteMode;
  orderedAccountIDs: string[];
  accountGroups: ChannelAccountGroup[];
  channelGroupStates: Record<string, ChannelGroupState>;
  projectBindings: ChannelProjectBinding[];
  projectModeFallbackRouteMode: ProjectModeFallbackRouteMode;
  fallbackMode: ChannelFallbackMode;
  shadowEnabled: boolean;
  shadowRouteMode: ChannelRouteMode;
}

export interface ChannelRoutingConfigDraft {
  channel?: unknown;
  routeMode?: unknown;
  orderedAccountIDs?: unknown;
  accountGroups?: unknown;
  channelGroupStates?: unknown;
  projectBindings?: unknown;
  projectModeFallbackRouteMode?: unknown;
  fallbackMode?: unknown;
  shadowEnabled?: unknown;
  shadowRouteMode?: unknown;
}

export type LegacyChannelRoutingBypassID = (typeof LEGACY_CHANNEL_ROUTING_BYPASS_IDS)[number];
export type LegacyChannelRoutingBypassDisposition = 'blocked' | 'ignored';

export interface LegacyChannelRoutingBypass {
  id: LegacyChannelRoutingBypassID;
  label: string;
  disposition: LegacyChannelRoutingBypassDisposition;
  detail: string;
}

export interface LegacyRoutingMaskPanel {
  title: string;
  summary: string;
  note: string;
  hasDetails: false;
}

export interface NormalizedChannelRoutingConfig {
  config: ChannelRoutingConfig;
  ignoredUpstreamModes: UpstreamCompatRouteMode[];
  invalidModes: string[];
}

export const LEGACY_CHANNEL_ROUTING_BYPASSES: LegacyChannelRoutingBypass[] = [
  {
    id: 'session-affinity',
    label: 'Session affinity',
    disposition: 'blocked',
    detail: '跳过，不进入新配置；仅保留为 runtime 粘性信号',
  },
  {
    id: 'websocket-pin',
    label: 'WebSocket pin',
    disposition: 'blocked',
    detail: '屏蔽，不进入新配置；仅保留为连接级运行态信号',
  },
  {
    id: 'route-order-header',
    label: 'Route order header',
    disposition: 'ignored',
    detail: '跳过，不进入新配置；探测路径不再注入顺序头',
  },
];

export interface ChannelRouteAuditEvent {
  id: string;
  recordedAt: string;
  channel: string;
  projectName?: string;
  routeMode: string;
  selectedAccountID?: string;
  candidateCount: number;
  filteredCount: number;
  snapshotVersion: string;
  policyVersion: string;
  shadowEnabled?: boolean;
  shadowRouteMode?: string;
  shadowSelectedAccountID?: string;
  shadowDiff?: boolean;
  redacted: boolean;
}

export interface ChannelRouteAuditEventSummary {
  id: string;
  title: string;
  meta: string;
  shadow: string;
  redacted: boolean;
}

export interface ChannelRoutingExplainLike {
  routeMode?: string;
  selectedAccountID?: string;
  candidates?: Array<{
    id?: string;
    displayName?: string;
    provider?: string;
    routeOrder?: number;
    channelOrder?: number;
    groupID?: string;
    groupOrder?: number;
    activeSessions?: number;
  }>;
  filtered?: Array<{
    id?: string;
    reason?: string;
  }>;
  steps?: string[];
  snapshotVersion?: string;
  policyVersion?: string;
  shadow?: {
    enabled?: boolean;
    routeMode?: string;
    selectedAccountID?: string;
    diff?: boolean;
    steps?: string[];
  };
}

export interface ChannelRoutingExplainCandidateRow {
  rank: number;
  id: string;
  title: string;
  meta: string;
}

export interface ChannelRoutingExplainReasonRow {
  label: string;
  count: number;
}

export interface ChannelRoutingExplainStepRow {
  label: string;
  detail?: string;
}

export interface ChannelRoutingParticipantAccountLike {
  id?: string;
  label?: string;
  provider?: string;
  sourceKind?: string;
  requestable?: boolean;
  disabled?: boolean;
}

export interface ChannelRoutingParticipantRow {
  rank: number;
  id: string;
  title: string;
  meta: string;
}

export interface ChannelRoutingExplainDigest {
  hasExplain: boolean;
  modeLabel: string;
  selectedTitle: string;
  selectedMeta: string;
  summaryLabel: string;
  snapshotLabel: string;
  policyLabel: string;
  shadowLabel: string;
  shadowMeta: string;
  candidateRows: ChannelRoutingExplainCandidateRow[];
  filteredRows: ChannelRoutingExplainReasonRow[];
  stepRows: ChannelRoutingExplainStepRow[];
}

const CHANNELS = ['codex', 'claude'] as const;

export function classifyChannelRouteMode(input: unknown): ChannelRouteModeClassification {
  const mode = String(input ?? '').trim();
  if (isChannelRouteMode(mode)) {
    return { kind: 'gettokens', mode };
  }
  if (isUpstreamCompatRouteMode(mode)) {
    return { kind: 'upstream-compat', mode };
  }
  return { kind: 'invalid', mode };
}

export function isChannelRouteMode(input: unknown): input is ChannelRouteMode {
  return typeof input === 'string' && CHANNEL_ROUTE_MODES.includes(input as ChannelRouteMode);
}

export function isProjectModeFallbackRouteMode(input: unknown): input is ProjectModeFallbackRouteMode {
  return (
    typeof input === 'string' &&
    PROJECT_MODE_FALLBACK_ROUTE_MODES.includes(input as ProjectModeFallbackRouteMode)
  );
}

export function isChannelFallbackMode(input: unknown): input is ChannelFallbackMode {
  return typeof input === 'string' && CHANNEL_FALLBACK_MODES.includes(input as ChannelFallbackMode);
}

export function isUpstreamCompatRouteMode(input: unknown): input is UpstreamCompatRouteMode {
  return typeof input === 'string' && UPSTREAM_COMPAT_ROUTE_MODES.includes(input as UpstreamCompatRouteMode);
}

export function normalizeChannelRoutingConfig(
  draft: ChannelRoutingConfigDraft,
  defaults: Pick<ChannelRoutingConfig, 'channel'>,
): NormalizedChannelRoutingConfig {
  const ignoredUpstreamModes: UpstreamCompatRouteMode[] = [];
  const invalidModes: string[] = [];

  const routeModeResult = normalizeRouteMode(draft.routeMode, 'sequential', ignoredUpstreamModes, invalidModes);
  const projectFallbackResult = normalizeProjectFallbackRouteMode(
    draft.projectModeFallbackRouteMode,
    ignoredUpstreamModes,
    invalidModes,
  );

  return {
    config: {
      channel: normalizeChannel(draft.channel, defaults.channel),
      routeMode: routeModeResult,
      orderedAccountIDs: normalizeOrderedAccountIDs(draft.orderedAccountIDs),
      accountGroups: normalizeAccountGroups(draft.accountGroups),
      channelGroupStates: normalizeChannelGroupStates(draft.channelGroupStates),
      projectBindings: normalizeProjectBindings(draft.projectBindings),
      projectModeFallbackRouteMode: projectFallbackResult,
      fallbackMode: isChannelFallbackMode(draft.fallbackMode) ? draft.fallbackMode : 'fail-closed',
      shadowEnabled: draft.shadowEnabled === true,
      shadowRouteMode: normalizeRouteMode(draft.shadowRouteMode, fallbackShadowMode(routeModeResult), ignoredUpstreamModes, invalidModes),
    },
    ignoredUpstreamModes: Array.from(new Set(ignoredUpstreamModes)),
    invalidModes: Array.from(new Set(invalidModes.filter(Boolean))),
  };
}

export function updateChannelRoutingConfig(
  config: ChannelRoutingConfig,
  patch: Partial<Omit<ChannelRoutingConfig, 'channel'>>,
): ChannelRoutingConfig {
  return {
    ...config,
    ...patch,
    channel: config.channel,
    orderedAccountIDs: patch.orderedAccountIDs
      ? normalizeOrderedAccountIDs(patch.orderedAccountIDs)
      : [...config.orderedAccountIDs],
    accountGroups: patch.accountGroups
      ? normalizeAccountGroups(patch.accountGroups)
      : config.accountGroups.map((group) => ({ ...group, accountIDs: [...group.accountIDs] })),
    channelGroupStates: patch.channelGroupStates
      ? normalizeChannelGroupStates(patch.channelGroupStates)
      : cloneChannelGroupStates(config.channelGroupStates),
    projectBindings: patch.projectBindings
      ? normalizeProjectBindings(patch.projectBindings)
      : config.projectBindings.map((binding) => ({ ...binding })),
    shadowEnabled: patch.shadowEnabled ?? config.shadowEnabled,
    shadowRouteMode: patch.shadowRouteMode ?? config.shadowRouteMode,
  };
}

export function buildLegacyRoutingBypassSummary() {
  return `${LEGACY_CHANNEL_ROUTING_BYPASSES.length} 个旧兼容输入已屏蔽`;
}

export function buildLegacyRoutingMaskPanel(): LegacyRoutingMaskPanel {
  return {
    title: '兼容层提示',
    summary: buildLegacyRoutingBypassSummary(),
    note: '这些信号只保留为兼容层，不写入新配置，也不影响主路由判断。',
    hasDetails: false,
  };
}

export function buildChannelRouteAuditEventSummary(event: ChannelRouteAuditEvent): ChannelRouteAuditEventSummary {
  const routeMode = formatChannelRouteModeLabel(event.routeMode) || '未知';
  const selected = String(event.selectedAccountID || 'none').trim() || 'none';
  const project = String(event.projectName || '').trim();
  const snapshot = String(event.snapshotVersion || 'snapshot-unknown').trim() || 'snapshot-unknown';
  const policy = String(event.policyVersion || 'policy-unknown').trim() || 'policy-unknown';
  const candidateCount = Number.isFinite(event.candidateCount) ? event.candidateCount : 0;
  const filteredCount = Number.isFinite(event.filteredCount) ? event.filteredCount : 0;
  const title = `${routeMode} → ${selected}`;
  const metaParts = [
    project ? `项目:${project}` : '',
    `${candidateCount} 个候选`,
    `${filteredCount} 个过滤`,
    `快照 ${snapshot}`,
    `规则 ${policy}`,
  ].filter(Boolean);
  const shadow = event.shadowEnabled
    ? `${formatChannelRouteModeLabel(event.shadowRouteMode) || 'Shadow'} → ${event.shadowSelectedAccountID || '未命中'} · 差异:${
        event.shadowDiff ? '有' : '无'
      }`
    : '';
  return {
    id: String(event.id || '').trim() || `${event.channel || 'channel'}:${event.recordedAt || 'unknown'}`,
    title,
    meta: metaParts.join(' · '),
    shadow,
    redacted: event.redacted !== false,
  };
}

export function buildPreviewChannelRouteAuditEvent(input: {
  channel: ChannelID;
  explain?: {
    selectedAccountID?: string;
    candidates?: unknown[];
    filtered?: unknown[];
    snapshotVersion?: string;
    policyVersion?: string;
    shadow?: {
      enabled?: boolean;
      routeMode?: string;
      selectedAccountID?: string;
      diff?: boolean;
    };
  } | null;
}): ChannelRouteAuditEvent | null {
  if (!input.explain) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: `preview:${input.channel}:${now}`,
    recordedAt: now,
    channel: input.channel,
    routeMode: 'preview',
    selectedAccountID: input.explain.selectedAccountID || '',
    candidateCount: input.explain.candidates?.length || 0,
    filteredCount: input.explain.filtered?.length || 0,
    snapshotVersion: input.explain.snapshotVersion || 'preview',
    policyVersion: input.explain.policyVersion || 'channel-routing-v1',
    shadowEnabled: input.explain.shadow?.enabled === true,
    shadowRouteMode: input.explain.shadow?.routeMode || '',
    shadowSelectedAccountID: input.explain.shadow?.selectedAccountID || '',
    shadowDiff: input.explain.shadow?.diff === true,
    redacted: true,
  };
}

export function buildChannelRoutingExplainDigest(
  input: ChannelRoutingExplainLike | null | undefined,
): ChannelRoutingExplainDigest {
  if (!input) {
    return {
      hasExplain: false,
      modeLabel: '未运行',
      selectedTitle: '尚未运行预演',
      selectedMeta: '点击“运行预演”后会显示候选、过滤原因和最终命中。',
      summaryLabel: '尚未运行',
      snapshotLabel: '快照未生成',
      policyLabel: '规则未生成',
      shadowLabel: 'Shadow 关闭',
      shadowMeta: '',
      candidateRows: [],
      filteredRows: [],
      stepRows: [],
    };
  }

  const candidateRows = (input.candidates || []).map((candidate, index) => {
    const rank = index + 1;
    const title = String(candidate.displayName || candidate.id || `候选 ${rank}`).trim() || `候选 ${rank}`;
    const metaParts = [String(candidate.provider || '').trim(), buildChannelRoutingActiveSessionMeta(candidate.activeSessions)];
    const meta = metaParts.filter(Boolean).join(' · ') || '无附加信息';
    return {
      rank,
      id: String(candidate.id || '').trim(),
      title,
      meta,
    };
  });

  const selectedAccountID = String(input.selectedAccountID || '').trim();
  const selectedCandidate = candidateRows.find((candidate) => candidate.id === selectedAccountID);
  const selectedTitle = selectedCandidate?.title || selectedAccountID || '未命中';
  const selectedMeta = selectedCandidate
    ? `命中候选 #${selectedCandidate.rank} · ${selectedCandidate.meta}`
    : selectedAccountID
      ? `命中账号 ${selectedAccountID}`
      : '尚未命中';

  const filteredRows = buildChannelRoutingFilteredReasonRows(input.filtered || []);
  const stepRows = (input.steps || [])
    .map((step) => formatChannelRoutingExplainStep(step))
    .filter((step): step is ChannelRoutingExplainStepRow => Boolean(step));

  const shadow = input.shadow;
  const shadowEnabled = shadow?.enabled === true;
  const shadowLabel = shadowEnabled ? 'Shadow 开启' : 'Shadow 关闭';
  const shadowMeta = shadowEnabled
    ? `${formatChannelRouteModeLabel(shadow.routeMode) || 'Shadow'} · ${shadow.selectedAccountID || '未命中'} · 差异:${
        shadow.diff ? '有' : '无'
      }`
    : '';

  return {
    hasExplain: true,
    modeLabel: formatChannelRouteModeLabel(input.routeMode) || '未知',
    selectedTitle,
    selectedMeta,
    summaryLabel: `${candidateRows.length} 个候选 / ${filteredRows.reduce((total, item) => total + item.count, 0)} 个过滤`,
    snapshotLabel: `快照 ${String(input.snapshotVersion || '未生成').trim() || '未生成'}`,
    policyLabel: `规则 ${String(input.policyVersion || '未生成').trim() || '未生成'}`,
    shadowLabel,
    shadowMeta,
    candidateRows,
    filteredRows,
    stepRows,
  };
}

export function buildChannelRoutingParticipantRows(
  config: Pick<ChannelRoutingConfig, 'orderedAccountIDs'>,
  accounts: ChannelRoutingParticipantAccountLike[] = [],
): ChannelRoutingParticipantRow[] {
  const accountByID = new Map<string, ChannelRoutingParticipantAccountLike>();
  const normalizedAccounts: ChannelRoutingParticipantAccountLike[] = [];

  for (const account of accounts) {
    const id = String(account.id || '').trim();
    if (!id || accountByID.has(id)) {
      continue;
    }
    const normalized = { ...account, id };
    accountByID.set(id, normalized);
    normalizedAccounts.push(normalized);
  }

  const orderedIDs = normalizeOrderedAccountIDs(config.orderedAccountIDs);
  const sourceIDs = orderedIDs.length > 0 ? orderedIDs : normalizedAccounts.map((account) => String(account.id || '').trim());
  const rows: ChannelRoutingParticipantRow[] = [];
  const seen = new Set<string>();

  for (const id of sourceIDs) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);

    const account = accountByID.get(id);
    if (accountByID.size > 0 && !account) {
      continue;
    }
    if (account && (account.requestable === false || account.disabled === true)) {
      continue;
    }

    const title = String(account?.label || id).trim() || id;
    const meta = [String(account?.provider || '').trim(), formatChannelRoutingSourceKind(account?.sourceKind)]
      .filter(Boolean)
      .join(' · ');

    rows.push({
      rank: rows.length + 1,
      id,
      title,
      meta: meta || '可请求账号',
    });
  }

  return rows;
}

function formatChannelRouteModeLabel(mode: unknown): string {
  switch (String(mode || '').trim()) {
    case 'sequential':
      return '顺序';
    case 'balanced':
      return '均衡';
    case 'project':
      return '项目';
    case 'preview':
      return '预演';
    default:
      return String(mode || '').trim();
  }
}

function formatChannelRoutingSourceKind(sourceKind: unknown): string {
  switch (String(sourceKind || '').trim()) {
    case 'codex-auth-file':
      return 'OAuth 文件';
    case 'codex-api-key':
      return 'API Key';
    case 'openai-compatible':
      return 'OpenAI-compatible';
    default:
      return '';
  }
}

function buildChannelRoutingActiveSessionMeta(activeSessions: unknown): string {
  const count = Number(activeSessions);
  if (!Number.isFinite(count) || count <= 0) {
    return '';
  }
  return `${count} 个活跃会话`;
}

function buildChannelRoutingFilteredReasonRows(
  filtered: Array<{
    id?: string;
    reason?: string;
  }>,
): ChannelRoutingExplainReasonRow[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const item of filtered) {
    const reason = String(item.reason || '').trim() || 'unknown';
    const label = formatChannelRoutingFilteredReason(reason);
    if (!counts.has(label)) {
      order.push(label);
    }
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return order.map((label) => ({
    label,
    count: counts.get(label) || 0,
  }));
}

function formatChannelRoutingFilteredReason(reason: string): string {
  switch (reason) {
    case 'channel-unsupported':
      return '渠道不支持';
    case 'scope-account':
      return '范围锁定账号';
    case 'scope-group':
      return '范围外账号组';
    case 'tried':
      return '已在本轮尝试';
    case 'account-disabled':
      return '账号已禁用';
    case 'account-unrequestable':
      return '账号暂不可请求';
    case 'group-disabled-or-missing':
      return '账号组不可用';
    case 'runtime-manual-disabled':
      return '运行态手动禁用';
    case 'runtime-auth-error':
      return '运行态认证错误';
    case 'runtime-rate-limit':
      return '运行态限流';
    case 'runtime-cooldown':
      return '运行态冷却';
    case 'runtime-model-unavailable':
      return '运行态模型不可用';
    case 'runtime-upstream-error':
      return '运行态上游错误';
    default:
      return reason;
  }
}

function formatChannelRoutingExplainStep(step: string): ChannelRoutingExplainStepRow | null {
  const raw = String(step || '').trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith('mode:')) {
    return {
      label: '当前模式',
      detail: formatChannelRouteModeLabel(raw.slice(5)),
    };
  }
  if (raw.startsWith('legacy:')) {
    const payload = raw.slice(7);
    const [key, value] = payload.split('=');
    const detail = value ? `${key} 已${value === 'ignored' ? '忽略' : '屏蔽'}` : payload;
    return {
      label: '兼容信号',
      detail,
    };
  }
  if (raw.startsWith('candidates:')) {
    return {
      label: '候选池',
      detail: `${raw.slice(11)} 个`,
    };
  }
  if (raw.startsWith('sticky:hit:')) {
    return {
      label: '粘性命中',
      detail: raw.slice(11),
    };
  }
  if (raw.startsWith('sticky:invalidated:')) {
    return {
      label: '粘性失效',
      detail: formatChannelRoutingFilteredReason(raw.slice(19)),
    };
  }
  if (raw === 'sticky:miss') {
    return {
      label: '粘性未命中',
    };
  }
  if (raw.startsWith('project:hit:')) {
    return {
      label: '项目命中',
      detail: raw.slice(12),
    };
  }
  if (raw === 'project:miss') {
    return {
      label: '项目未命中',
    };
  }
  if (raw === 'project:fallback-default') {
    return {
      label: '项目回退',
      detail: '默认路由',
    };
  }
  return {
    label: '步骤',
    detail: raw,
  };
}

function normalizeRouteMode(
  input: unknown,
  fallback: ChannelRouteMode,
  ignoredUpstreamModes: UpstreamCompatRouteMode[],
  invalidModes: string[],
): ChannelRouteMode {
  const classified = classifyChannelRouteMode(input);
  if (classified.kind === 'gettokens') {
    return classified.mode;
  }
  if (classified.kind === 'upstream-compat') {
    ignoredUpstreamModes.push(classified.mode);
    return fallback;
  }
  if (classified.mode) {
    invalidModes.push(classified.mode);
  }
  return fallback;
}

function fallbackShadowMode(productionMode: ChannelRouteMode): ChannelRouteMode {
  return productionMode === 'balanced' ? 'sequential' : 'balanced';
}

function normalizeProjectFallbackRouteMode(
  input: unknown,
  ignoredUpstreamModes: UpstreamCompatRouteMode[],
  invalidModes: string[],
): ProjectModeFallbackRouteMode {
  if (isProjectModeFallbackRouteMode(input)) {
    return input;
  }
  const classified = classifyChannelRouteMode(input);
  if (classified.kind === 'upstream-compat') {
    ignoredUpstreamModes.push(classified.mode);
  } else if (classified.kind === 'invalid' && classified.mode) {
    invalidModes.push(classified.mode);
  }
  return 'sequential';
}

function normalizeChannel(input: unknown, fallback: ChannelID): ChannelID {
  return typeof input === 'string' && CHANNELS.includes(input as ChannelID) ? (input as ChannelID) : fallback;
}

function normalizeOrderedAccountIDs(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  input.forEach((item) => {
    const id = String(item ?? '').trim();
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

function normalizeChannelGroupStates(input: unknown): Record<string, ChannelGroupState> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return Object.entries(input as Record<string, unknown>).reduce<Record<string, ChannelGroupState>>(
    (states, [rawID, rawState]) => {
      const id = rawID.trim();
      if (!id || !rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
        return states;
      }
      const state = rawState as Record<string, unknown>;
      const routeOrder = normalizeOptionalRouteOrder(state.routeOrder);
      states[id] = {
        enabled: state.enabled !== false,
        ...(routeOrder === undefined ? {} : { routeOrder }),
      };
      return states;
    },
    {},
  );
}

function normalizeAccountGroups(input: unknown): ChannelAccountGroup[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  return input.reduce<ChannelAccountGroup[]>((groups, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return groups;
    }
    const raw = item as Record<string, unknown>;
    const id = String(raw.id ?? '').trim();
    if (!id || seen.has(id)) {
      return groups;
    }
    seen.add(id);
    groups.push({
      id,
      name: String(raw.name ?? '').trim() || undefined,
      enabled: raw.enabled !== false,
      routeOrder: normalizeOptionalRouteOrder(raw.routeOrder),
      accountIDs: normalizeOrderedAccountIDs(raw.accountIDs),
    });
    return groups;
  }, []);
}

function cloneChannelGroupStates(input: Record<string, ChannelGroupState>): Record<string, ChannelGroupState> {
  return Object.entries(input).reduce<Record<string, ChannelGroupState>>((states, [id, state]) => {
    states[id] = { ...state };
    return states;
  }, {});
}

function normalizeProjectBindings(input: unknown): ChannelProjectBinding[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  return input.reduce<ChannelProjectBinding[]>((bindings, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return bindings;
    }
    const raw = item as Record<string, unknown>;
    const projectName = String(raw.projectName ?? '').trim();
    const targetType = raw.targetType === 'account' || raw.targetType === 'group' ? raw.targetType : null;
    const targetID = String(raw.targetID ?? '').trim();
    if (!projectName || !targetType || !targetID || seen.has(projectName)) {
      return bindings;
    }
    seen.add(projectName);
    bindings.push({
      projectName,
      targetType,
      targetID,
      fallbackMode: isChannelFallbackMode(raw.fallbackMode) ? raw.fallbackMode : 'fail-closed',
    });
    return bindings;
  }, []);
}

function normalizeOptionalRouteOrder(input: unknown): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return undefined;
  }
  return input;
}
