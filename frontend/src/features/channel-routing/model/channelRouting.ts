export const CHANNEL_ROUTE_MODES = ['sequential', 'balanced', 'project'] as const;
export const PROJECT_MODE_FALLBACK_ROUTE_MODES = ['sequential', 'balanced'] as const;
export const CHANNEL_FALLBACK_MODES = ['fail-closed', 'fallback-default', 'fallback-global'] as const;
export const UPSTREAM_COMPAT_ROUTE_MODES = ['dedicated', 'prefer', 'ordered', 'weighted', 'canary'] as const;

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

export interface NormalizedChannelRoutingConfig {
  config: ChannelRoutingConfig;
  ignoredUpstreamModes: UpstreamCompatRouteMode[];
  invalidModes: string[];
}

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

export function buildChannelRouteAuditEventSummary(event: ChannelRouteAuditEvent): ChannelRouteAuditEventSummary {
  const routeMode = String(event.routeMode || 'unknown').trim() || 'unknown';
  const selected = String(event.selectedAccountID || 'none').trim() || 'none';
  const project = String(event.projectName || '').trim();
  const snapshot = String(event.snapshotVersion || 'snapshot-unknown').trim() || 'snapshot-unknown';
  const policy = String(event.policyVersion || 'policy-unknown').trim() || 'policy-unknown';
  const candidateCount = Number.isFinite(event.candidateCount) ? event.candidateCount : 0;
  const filteredCount = Number.isFinite(event.filteredCount) ? event.filteredCount : 0;
  const title = `${routeMode} -> ${selected}`;
  const metaParts = [
    project ? `project:${project}` : '',
    `${candidateCount} candidates`,
    `${filteredCount} filtered`,
    `${snapshot} / ${policy}`,
  ].filter(Boolean);
  const shadow = event.shadowEnabled
    ? `${event.shadowRouteMode || 'shadow'} -> ${event.shadowSelectedAccountID || 'none'} / diff:${event.shadowDiff ? 'yes' : 'no'}`
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
  } else if (classified.kind === 'gettokens' && classified.mode === 'project') {
    invalidModes.push(classified.mode);
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
