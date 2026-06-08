export const CHANNEL_ROUTE_MODES = ['sequential', 'balanced'] as const;

export type ChannelID = 'codex' | 'claude';
export type ChannelRouteMode = (typeof CHANNEL_ROUTE_MODES)[number];

export type ChannelRouteModeClassification =
  | {
      kind: 'gettokens';
      mode: ChannelRouteMode;
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

export interface ChannelRoutingConfig {
  channel: ChannelID;
  routeMode: ChannelRouteMode;
  orderedAccountIDs: string[];
  manualRequestableAccountIDs: string[];
  accountGroups: ChannelAccountGroup[];
  channelGroupStates: Record<string, ChannelGroupState>;
  shadowEnabled: boolean;
  shadowRouteMode: ChannelRouteMode;
}

export interface ChannelRoutingConfigDraft {
  channel?: unknown;
  routeMode?: unknown;
  orderedAccountIDs?: unknown;
  manualRequestableAccountIDs?: unknown;
  accountGroups?: unknown;
  channelGroupStates?: unknown;
  shadowEnabled?: unknown;
  shadowRouteMode?: unknown;
}

export interface NormalizedChannelRoutingConfig {
  config: ChannelRoutingConfig;
  invalidModes: string[];
}

export interface ChannelRouteAuditEvent {
  id: string;
  recordedAt: string;
  channel: string;
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  routeMode: string;
  selectedAccountID?: string;
  candidateCount: number;
  filteredCount: number;
  filtered?: Array<{
    id?: string;
    reason?: string;
  }>;
  filteredReasonCounts?: Array<{
    reason?: string;
    count?: number;
  }>;
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
  projectCandidatePool?: {
    evaluated?: boolean;
    activated?: boolean;
    reason?: string;
    ruleID?: string;
    projectKey?: string;
    projectName?: string;
    projectKeySource?: string;
    projectKeyConfidence?: string;
    allowAccountIDs?: string[];
    filteredAccountIDs?: string[];
    beforeCandidateCount?: number;
    afterCandidateCount?: number;
  };
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

export interface ProjectCandidatePoolRuleLike {
  id?: string;
  channel?: string;
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  enabled?: boolean;
  allowAccountIDs?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectCandidatePoolRuleRow {
  id: string;
  projectTitle: string;
  projectKey: string;
  projectMeta: string;
  statusLabel: string;
  enabled: boolean;
  allowAccountTitles: string[];
  missingAccountIDs: string[];
  accountCountLabel: string;
  raw: ProjectCandidatePoolRuleLike;
}

export interface ProjectCandidatePoolObservedProjectLike {
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  lastSeenAt?: string;
  source?: 'live-session' | 'session-history' | 'route-event' | 'configured';
  active?: boolean;
  sessionCount?: number;
}

export interface ProjectCandidatePoolSessionManagementProjectLike {
  name?: string;
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  lastActiveAt?: string;
  sessionCount?: number;
  activeSessionCount?: number;
  sessions?: ProjectCandidatePoolSessionManagementSessionLike[];
}

export interface ProjectCandidatePoolSessionManagementSessionLike {
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  updatedAt?: string;
  status?: string;
}

export interface ProjectCandidatePoolSessionManagementSnapshotLike {
  projects?: ProjectCandidatePoolSessionManagementProjectLike[];
}

export interface ProjectCandidatePoolLiveSessionLike {
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  startedAt?: string;
  lastEventAt?: string;
  status?: string;
}

export interface ProjectCandidatePoolLiveSessionsSnapshotLike {
  sessions?: ProjectCandidatePoolLiveSessionLike[];
}

export interface ProjectCandidatePoolProjectOption {
  projectKey: string;
  projectName: string;
  projectKeySource: string;
  projectKeyConfidence: string;
  configured: boolean;
  lastSeenAt?: string;
  sourceLabel?: string;
  active?: boolean;
  sessionCount?: number;
  sourceRank?: number;
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
  projectCandidatePoolLabel: string;
  projectCandidatePoolMeta: string;
  candidateRows: ChannelRoutingExplainCandidateRow[];
  filteredRows: ChannelRoutingExplainReasonRow[];
  stepRows: ChannelRoutingExplainStepRow[];
}

export interface ChannelRouteModeHelpSection {
  title: string;
  body: string;
  points: string[];
}

export const CHANNEL_ROUTE_MODE_HELP_SECTIONS: ChannelRouteModeHelpSection[] = [
  {
    title: '顺序模式不是账号独占',
    body: '顺序模式会在每次路由决策时按参与账号顺序，从前往后选择第一个可请求账号。它不保证整段会话或全应用只消耗第一个账号。',
    points: [
      '同一次请求 retry 时，会排除已尝试账号并继续下一个可路由账号。',
      '多个会话、并发请求、Codex 与 Claude 渠道会分别进入路由决策。',
    ],
  },
  {
    title: '这些情况会切到后续账号',
    body: '账号被运行态守卫过滤后，顺序模式会继续查找下一个可请求账号。',
    points: [
      '401 / 402 / 403 / 429、额度耗尽、模型不可用、超时或 5xx 会触发冷却、限流或失败降级。',
      'WebSocket pinned auth 在请求边界被释放后，会重新进入路由引擎选择账号。',
      '项目或账号组限定会先缩小候选池，再在候选池内按顺序或均衡模式选择。',
    ],
  },
  {
    title: '探测和说明的消耗边界',
    body: 'Explain / dry-run 只解释候选和过滤原因，不请求上游；路由探测和连续测试会发真实 relay 请求，可能命中并消耗账号额度。',
    points: ['排查多账号消耗时，优先查看高级诊断里的最近路由和预演结果。'],
  },
  {
    title: '均衡模式的差异',
    body: '均衡模式优先选择当前活跃会话数或 in-flight 请求数更少的账号；负载相同时再按请求顺序兜底。',
    points: ['如果想尽量先用排在前面的账号，保持顺序模式；如果更关心并发分摊，使用均衡模式。'],
  },
];

const CHANNELS = ['codex', 'claude'] as const;

export function classifyChannelRouteMode(input: unknown): ChannelRouteModeClassification {
  const mode = String(input ?? '').trim();
  if (isChannelRouteMode(mode)) {
    return { kind: 'gettokens', mode };
  }
  return { kind: 'invalid', mode };
}

export function isChannelRouteMode(input: unknown): input is ChannelRouteMode {
  return typeof input === 'string' && CHANNEL_ROUTE_MODES.includes(input as ChannelRouteMode);
}

export function normalizeChannelRoutingConfig(
  draft: ChannelRoutingConfigDraft,
  defaults: Pick<ChannelRoutingConfig, 'channel'>,
): NormalizedChannelRoutingConfig {
  const invalidModes: string[] = [];

  const routeModeResult = normalizeRouteMode(draft.routeMode, 'sequential', invalidModes);

  return {
    config: {
      channel: normalizeChannel(draft.channel, defaults.channel),
      routeMode: routeModeResult,
      orderedAccountIDs: normalizeOrderedAccountIDs(draft.orderedAccountIDs),
      manualRequestableAccountIDs: normalizeOrderedAccountIDs(draft.manualRequestableAccountIDs),
      accountGroups: normalizeAccountGroups(draft.accountGroups),
      channelGroupStates: normalizeChannelGroupStates(draft.channelGroupStates),
      shadowEnabled: draft.shadowEnabled === true,
      shadowRouteMode: normalizeRouteMode(draft.shadowRouteMode, fallbackShadowMode(routeModeResult), invalidModes),
    },
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
    manualRequestableAccountIDs: patch.manualRequestableAccountIDs
      ? normalizeOrderedAccountIDs(patch.manualRequestableAccountIDs)
      : [...config.manualRequestableAccountIDs],
    accountGroups: patch.accountGroups
      ? normalizeAccountGroups(patch.accountGroups)
      : config.accountGroups.map((group) => ({ ...group, accountIDs: [...group.accountIDs] })),
    channelGroupStates: patch.channelGroupStates
      ? normalizeChannelGroupStates(patch.channelGroupStates)
      : cloneChannelGroupStates(config.channelGroupStates),
    shadowEnabled: patch.shadowEnabled ?? config.shadowEnabled,
    shadowRouteMode: patch.shadowRouteMode ?? config.shadowRouteMode,
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
  const reasonSummary = formatChannelRoutingReasonSummary(event);
  const metaParts = [
    project ? `项目:${project}` : '',
    `${candidateCount} 个候选`,
    `${filteredCount} 个过滤`,
    reasonSummary ? `过滤原因 ${reasonSummary}` : '',
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

function formatChannelRoutingReasonSummary(event: ChannelRouteAuditEvent) {
  const counts = new Map<string, number>();
  (event.filteredReasonCounts ?? []).forEach((item) => {
    const reason = String(item.reason || '').trim();
    const count = Number(item.count || 0);
    if (reason && count > 0) {
      counts.set(reason, (counts.get(reason) ?? 0) + count);
    }
  });
  (event.filtered ?? []).forEach((item) => {
    const reason = String(item.reason || '').trim();
    if (reason) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .sort(([leftReason, leftCount], [rightReason, rightCount]) => {
      if (leftCount !== rightCount) return rightCount - leftCount;
      return leftReason.localeCompare(rightReason);
    })
    .slice(0, 3)
    .map(([reason, count]) => `${reason} x${count}`)
    .join(', ');
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
      projectCandidatePoolLabel: '项目池未评估',
      projectCandidatePoolMeta: '',
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
  const projectCandidatePool = buildProjectCandidatePoolDigest(input.projectCandidatePool);

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
    projectCandidatePoolLabel: projectCandidatePool.label,
    projectCandidatePoolMeta: projectCandidatePool.meta,
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

export function normalizeProjectCandidatePoolRuleDraft(
  draft: ProjectCandidatePoolRuleLike,
  channel: ChannelID,
): ProjectCandidatePoolRuleLike {
  const projectKey = String(draft.projectKey || '').trim();
  return {
    id: String(draft.id || '').trim() || undefined,
    channel,
    projectKey,
    projectName: String(draft.projectName || '').trim(),
    projectKeySource: String(draft.projectKeySource || '').trim() || 'manual-confirmed',
    projectKeyConfidence: String(draft.projectKeyConfidence || '').trim() || (projectKey ? 'strong' : ''),
    enabled: draft.enabled !== false,
    allowAccountIDs: normalizeOrderedAccountIDs(draft.allowAccountIDs),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export function normalizeProjectCandidatePoolRules(
  rules: ProjectCandidatePoolRuleLike[] | null | undefined,
  channel: ChannelID,
): ProjectCandidatePoolRuleLike[] {
  return (rules || [])
    .map((rule) => normalizeProjectCandidatePoolRuleDraft(rule, channel))
    .filter((rule) => String(rule.projectKey || '').trim());
}

export function buildPreviewProjectCandidatePoolRules(
  channel: ChannelID,
  accounts: ChannelRoutingParticipantAccountLike[] = [],
): ProjectCandidatePoolRuleLike[] {
  const requestableAccountIDs = accounts
    .filter((account) => account.requestable !== false && account.disabled !== true)
    .map((account) => String(account.id || '').trim())
    .filter(Boolean);
  const allowAccountIDs = requestableAccountIDs.slice(0, Math.max(1, Math.min(2, requestableAccountIDs.length)));
  if (allowAccountIDs.length === 0) {
    return [];
  }
  return [
    {
      id: `preview-${channel}-gettokens`,
      channel,
      projectKey: 'workspace:preview-gettokens',
      projectName: 'GetTokens',
      projectKeySource: 'browser-preview',
      projectKeyConfidence: 'strong',
      enabled: true,
      allowAccountIDs,
    },
  ];
}

export function validateProjectCandidatePoolRuleDraft(rule: ProjectCandidatePoolRuleLike): string[] {
  const issues: string[] = [];
  const projectKey = String(rule.projectKey || '').trim();
  if (!projectKey) {
    issues.push('请选择项目');
  } else if (!/^[a-z][a-z0-9-]*:.+$/i.test(projectKey)) {
    issues.push('项目标识缺少来源前缀，请重新选择历史项目');
  }
  if (normalizeOrderedAccountIDs(rule.allowAccountIDs).length === 0) {
    issues.push('至少选择一个允许账号');
  }
  return issues;
}

export function buildProjectCandidatePoolProjectOptions(input: {
  rules?: ProjectCandidatePoolRuleLike[] | null;
  sessionProjects?: ProjectCandidatePoolObservedProjectLike[] | null;
  routeEvents?: ChannelRouteAuditEvent[] | null;
}): ProjectCandidatePoolProjectOption[] {
  const optionsByKey = new Map<string, ProjectCandidatePoolProjectOption>();

  for (const rule of input.rules || []) {
    addProjectCandidatePoolProjectOption(optionsByKey, {
      projectKey: rule.projectKey,
      projectName: rule.projectName,
      projectKeySource: rule.projectKeySource,
      projectKeyConfidence: rule.projectKeyConfidence,
      configured: true,
      lastSeenAt: rule.updatedAt || rule.createdAt,
      source: 'configured',
    });
  }

  for (const project of input.sessionProjects || []) {
    addProjectCandidatePoolProjectOption(optionsByKey, {
      projectKey: project.projectKey,
      projectName: project.projectName,
      projectKeySource: project.projectKeySource,
      projectKeyConfidence: project.projectKeyConfidence,
      configured: false,
      lastSeenAt: project.lastSeenAt,
      source: project.source || 'session-history',
      active: project.active,
      sessionCount: project.sessionCount,
    });
  }

  for (const event of input.routeEvents || []) {
    addProjectCandidatePoolProjectOption(optionsByKey, {
      projectKey: event.projectKey,
      projectName: event.projectName,
      projectKeySource: event.projectKeySource,
      projectKeyConfidence: event.projectKeyConfidence,
      configured: false,
      lastSeenAt: event.recordedAt,
      source: 'route-event',
    });
  }

  return Array.from(optionsByKey.values()).sort(compareProjectCandidatePoolProjectOptions);
}

export function buildProjectCandidatePoolProjectsFromSessionManagementSnapshot(
  snapshot: ProjectCandidatePoolSessionManagementSnapshotLike | null | undefined,
  source: ProjectCandidatePoolObservedProjectLike['source'] = 'session-history',
): ProjectCandidatePoolObservedProjectLike[] {
  const items: ProjectCandidatePoolObservedProjectLike[] = [];
  for (const project of snapshot?.projects || []) {
    const projectKey = String(project.projectKey || '').trim();
    if (projectKey) {
      items.push({
        projectKey,
        projectName: String(project.projectName || project.name || '').trim(),
        projectKeySource: project.projectKeySource,
        projectKeyConfidence: project.projectKeyConfidence,
        lastSeenAt: project.lastActiveAt,
        source,
        active: source === 'live-session',
        sessionCount: project.sessionCount,
      });
    }
    for (const session of project.sessions || []) {
      const sessionProjectKey = String(session.projectKey || '').trim();
      if (!sessionProjectKey) {
        continue;
      }
      items.push({
        projectKey: sessionProjectKey,
        projectName: String(session.projectName || project.projectName || project.name || '').trim(),
        projectKeySource: session.projectKeySource || project.projectKeySource,
        projectKeyConfidence: session.projectKeyConfidence || project.projectKeyConfidence,
        lastSeenAt: session.updatedAt || project.lastActiveAt,
        source,
        active: source === 'live-session',
        sessionCount: 1,
      });
    }
  }
  return mergeProjectCandidatePoolObservedProjects(items);
}

export function buildProjectCandidatePoolProjectsFromCodexLiveSessions(
  snapshot: ProjectCandidatePoolLiveSessionsSnapshotLike | null | undefined,
  historySnapshot?: ProjectCandidatePoolSessionManagementSnapshotLike | null,
): ProjectCandidatePoolObservedProjectLike[] {
  const historyByProjectName = new Map<string, ProjectCandidatePoolObservedProjectLike>();
  for (const project of buildProjectCandidatePoolProjectsFromSessionManagementSnapshot(historySnapshot, 'session-history')) {
    const name = normalizeProjectCandidatePoolProjectNameKey(project.projectName);
    if (name && !historyByProjectName.has(name)) {
      historyByProjectName.set(name, project);
    }
  }

  const items: ProjectCandidatePoolObservedProjectLike[] = [];
  for (const session of snapshot?.sessions || []) {
    const projectName = String(session.projectName || '').trim();
    const historyProject = historyByProjectName.get(normalizeProjectCandidatePoolProjectNameKey(projectName));
    const projectKey = String(session.projectKey || historyProject?.projectKey || '').trim();
    if (!projectKey) {
      continue;
    }
    items.push({
      projectKey,
      projectName: projectName || historyProject?.projectName || projectKey,
      projectKeySource: session.projectKeySource || historyProject?.projectKeySource || 'codex-live-session',
      projectKeyConfidence: session.projectKeyConfidence || historyProject?.projectKeyConfidence || 'observed',
      lastSeenAt: session.lastEventAt || session.startedAt || historyProject?.lastSeenAt,
      source: 'live-session',
      active: session.status !== 'completed' && session.status !== 'archived',
      sessionCount: 1,
    });
  }
  return mergeProjectCandidatePoolObservedProjects(items);
}

export function mergeProjectCandidatePoolObservedProjects(
  projects: ProjectCandidatePoolObservedProjectLike[] = [],
): ProjectCandidatePoolObservedProjectLike[] {
  const byKey = new Map<string, ProjectCandidatePoolObservedProjectLike>();
  for (const project of projects) {
    const projectKey = String(project.projectKey || '').trim();
    if (!projectKey) {
      continue;
    }
    const current = byKey.get(projectKey);
    if (!current) {
      byKey.set(projectKey, {
        ...project,
        projectKey,
        projectName: String(project.projectName || '').trim() || projectKey,
        sessionCount: project.sessionCount || 0,
      });
      continue;
    }
    const projectSourceRank = getProjectCandidatePoolProjectSourceRank(project.source);
    const currentSourceRank = getProjectCandidatePoolProjectSourceRank(current.source);
    byKey.set(projectKey, {
      ...current,
      projectName:
        currentSourceRank <= projectSourceRank
          ? current.projectName || project.projectName
          : project.projectName || current.projectName,
      projectKeySource:
        currentSourceRank <= projectSourceRank
          ? current.projectKeySource || project.projectKeySource
          : project.projectKeySource || current.projectKeySource,
      projectKeyConfidence:
        current.projectKeyConfidence === 'strong'
          ? current.projectKeyConfidence
          : project.projectKeyConfidence || current.projectKeyConfidence,
      lastSeenAt: pickLatestDateLabel(current.lastSeenAt, project.lastSeenAt),
      source: currentSourceRank <= projectSourceRank ? current.source : project.source,
      active: Boolean(current.active || project.active),
      sessionCount: (current.sessionCount || 0) + (project.sessionCount || 0),
    });
  }
  return Array.from(byKey.values());
}

export function buildProjectCandidatePoolRuleRows(
  rules: ProjectCandidatePoolRuleLike[] = [],
  accounts: ChannelRoutingParticipantAccountLike[] = [],
): ProjectCandidatePoolRuleRow[] {
  const accountByID = new Map<string, ChannelRoutingParticipantAccountLike>();
  for (const account of accounts) {
    const id = String(account.id || '').trim();
    if (id && !accountByID.has(id)) {
      accountByID.set(id, account);
    }
  }

  return rules
    .map((rule, index) => {
      const projectKey = String(rule.projectKey || '').trim();
      const allowAccountIDs = normalizeOrderedAccountIDs(rule.allowAccountIDs);
      const allowAccountTitles: string[] = [];
      const missingAccountIDs: string[] = [];
      for (const accountID of allowAccountIDs) {
        const account = accountByID.get(accountID);
        if (!account) {
          missingAccountIDs.push(accountID);
          continue;
        }
        allowAccountTitles.push(String(account.label || account.id || accountID).trim() || accountID);
      }
      const projectName = String(rule.projectName || '').trim();
      const source = String(rule.projectKeySource || '').trim();
      const confidence = String(rule.projectKeyConfidence || '').trim();
      return {
        id: String(rule.id || '').trim() || `${projectKey || 'project'}:${index}`,
        projectTitle: projectName || projectKey || '未命名项目',
        projectKey,
        projectMeta: [source, confidence].filter(Boolean).join(' · '),
        statusLabel: rule.enabled === false ? '停用' : '启用',
        enabled: rule.enabled !== false,
        allowAccountTitles,
        missingAccountIDs,
        accountCountLabel: `${allowAccountIDs.length} 个账号`,
        raw: {
          ...rule,
          allowAccountIDs,
        },
      };
    })
    .filter((row) => row.projectKey);
}

function addProjectCandidatePoolProjectOption(
  optionsByKey: Map<string, ProjectCandidatePoolProjectOption>,
  input: Partial<ProjectCandidatePoolProjectOption> & {
    source?: ProjectCandidatePoolObservedProjectLike['source'];
  },
) {
  const projectKey = String(input.projectKey || '').trim();
  if (!projectKey) {
    return;
  }
  const current = optionsByKey.get(projectKey);
  const projectName = String(input.projectName || '').trim();
  const projectKeySource = String(input.projectKeySource || '').trim();
  const projectKeyConfidence = String(input.projectKeyConfidence || '').trim();
  const keepConfiguredIdentity = current?.configured && !input.configured;
  const source = input.source || (input.configured ? 'configured' : undefined);
  const sourceRank = getProjectCandidatePoolProjectSourceRank(source);
  const currentSourceRank = current?.sourceRank ?? 99;
  const nextSourceRank = Math.min(currentSourceRank, sourceRank);
  const active = Boolean(current?.active || input.active);
  const sessionCount = Math.max(current?.sessionCount || 0, input.sessionCount || 0);
  const next: ProjectCandidatePoolProjectOption = {
    projectKey,
    projectName: keepConfiguredIdentity ? current.projectName : projectName || current?.projectName || projectKey,
    projectKeySource: keepConfiguredIdentity ? current.projectKeySource : projectKeySource || current?.projectKeySource || 'observed',
    projectKeyConfidence: keepConfiguredIdentity
      ? current.projectKeyConfidence
      : projectKeyConfidence || current?.projectKeyConfidence || 'observed',
    configured: Boolean(current?.configured || input.configured),
    lastSeenAt: pickLatestDateLabel(current?.lastSeenAt, input.lastSeenAt),
    sourceLabel: getProjectCandidatePoolProjectSourceLabel(nextSourceRank, active),
    active,
    sessionCount,
    sourceRank: nextSourceRank,
  };
  optionsByKey.set(projectKey, next);
}

function compareProjectCandidatePoolProjectOptions(
  left: ProjectCandidatePoolProjectOption,
  right: ProjectCandidatePoolProjectOption,
): number {
  if (left.configured !== right.configured) {
    return left.configured ? -1 : 1;
  }
  if (Boolean(left.active) !== Boolean(right.active)) {
    return left.active ? -1 : 1;
  }
  if ((left.sourceRank ?? 99) !== (right.sourceRank ?? 99)) {
    return (left.sourceRank ?? 99) - (right.sourceRank ?? 99);
  }
  const leftTime = Date.parse(left.lastSeenAt || '');
  const rightTime = Date.parse(right.lastSeenAt || '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return left.projectName.localeCompare(right.projectName);
}

function pickLatestDateLabel(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return right || left;
  }
  return rightTime >= leftTime ? right : left;
}

function getProjectCandidatePoolProjectSourceRank(source: string | undefined): number {
  switch (source) {
    case 'configured':
      return 0;
    case 'live-session':
      return 1;
    case 'session-history':
      return 2;
    case 'route-event':
      return 3;
    default:
      return 9;
  }
}

function getProjectCandidatePoolProjectSourceLabel(sourceRank: number, active: boolean): string {
  if (active || sourceRank === 1) {
    return '运行会话';
  }
  if (sourceRank === 2) {
    return '会话历史';
  }
  if (sourceRank === 3) {
    return '路由记录';
  }
  if (sourceRank === 0) {
    return '已配置';
  }
  return '已识别';
}

function normalizeProjectCandidatePoolProjectNameKey(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function formatChannelRouteModeLabel(mode: unknown): string {
  switch (String(mode || '').trim()) {
    case 'sequential':
      return '顺序';
    case 'balanced':
      return '均衡';
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
    case 'waiting-check':
      return '待检测';
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
    case 'project-candidate-pool':
      return '项目候选池规则';
    case 'project-candidate-pool-no-routeable-account':
      return '项目候选池无可路由账号';
    case 'project-candidate-pool-conflict':
      return '项目候选池规则冲突';
    default:
      return reason;
  }
}

function buildProjectCandidatePoolDigest(
  projectCandidatePool: ChannelRoutingExplainLike['projectCandidatePool'],
): { label: string; meta: string } {
  if (!projectCandidatePool) {
    return { label: '项目池未评估', meta: '' };
  }

  const reason = String(projectCandidatePool.reason || '').trim();
  const label = formatProjectCandidatePoolReason(reason) || '项目池已记录';
  const projectName = String(projectCandidatePool.projectName || '').trim();
  const ruleID = String(projectCandidatePool.ruleID || '').trim();
  const before = Number(projectCandidatePool.beforeCandidateCount);
  const after = Number(projectCandidatePool.afterCandidateCount);
  const countMeta =
    Number.isFinite(before) && Number.isFinite(after) && (before > 0 || after > 0) ? `${before} → ${after} 个候选` : '';
  const meta = [projectName ? `项目:${projectName}` : '', ruleID ? `规则:${ruleID}` : '', countMeta].filter(Boolean).join(' · ');
  return { label, meta };
}

function formatProjectCandidatePoolReason(reason: string): string {
  switch (reason) {
    case 'project-candidate-pool:matched':
      return '项目候选池命中';
    case 'project-candidate-pool:not-matched':
      return '项目候选池未命中';
    case 'project-candidate-pool:not-evaluated:no-project-key':
      return '项目身份缺失';
    case 'project-candidate-pool:not-evaluated:ambiguous-project':
      return '项目身份不唯一';
    case 'project-candidate-pool:no-routeable-account':
      return '项目候选池无可路由账号';
    case 'project-candidate-pool:conflict':
      return '项目候选池规则冲突';
    default:
      return reason;
  }
}

function formatChannelRoutingExplainStep(step: string): ChannelRoutingExplainStepRow | null {
  const raw = String(step || '').trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith('project-candidate-pool:')) {
    return {
      label: '项目候选池',
      detail: formatProjectCandidatePoolReason(raw),
    };
  }
  if (raw.startsWith('mode:')) {
    return {
      label: '当前模式',
      detail: formatChannelRouteModeLabel(raw.slice(5)),
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
  return {
    label: '步骤',
    detail: raw,
  };
}

function normalizeRouteMode(
  input: unknown,
  fallback: ChannelRouteMode,
  invalidModes: string[],
): ChannelRouteMode {
  const classified = classifyChannelRouteMode(input);
  if (classified.kind === 'gettokens') {
    return classified.mode;
  }
  if (classified.mode) {
    invalidModes.push(classified.mode);
  }
  return fallback;
}

function fallbackShadowMode(productionMode: ChannelRouteMode): ChannelRouteMode {
  return productionMode === 'balanced' ? 'sequential' : 'balanced';
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

function normalizeOptionalRouteOrder(input: unknown): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return undefined;
  }
  return input;
}
