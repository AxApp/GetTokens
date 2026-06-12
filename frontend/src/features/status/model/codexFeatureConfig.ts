export type CodexFeatureStage =
  | 'recommended'
  | 'stable'
  | 'experimental'
  | 'advanced'
  | 'deprecated'
  | 'removed'
  | 'legacy'
  | 'unknown'
  | 'unsupported';

export type CodexFeatureStageFilter = 'all' | CodexFeatureStage | 'compat';
export type CodexConfigSection = 'root' | 'features' | 'notice' | 'model_providers';

export interface CodexFeatureConfigItem {
  id: string;
  section: CodexConfigSection;
  key: string;
  path: string[];
  description: string;
  stage: CodexFeatureStage;
  valueType: string;
  options: string[];
  defaultValue: unknown;
  localValue?: unknown;
  localRawValue: string;
  effectiveValue: unknown;
  hasLocalValue: boolean;
  legacyAliases: string[];
  canonicalKey: string;
  unsupported: boolean;
  readOnly: boolean;
  hiddenByDefault: boolean;
}

export interface CodexFeatureConfigSnapshot {
  codexHomePath: string;
  configPath: string;
  items: CodexFeatureConfigItem[];
  warnings: string[];
  loadedAt: string;
}

export interface CodexFeatureDraft {
  values: Record<string, unknown>;
  removed?: Record<string, true>;
}

export interface CodexFeatureRow extends CodexFeatureConfigItem {
  draftValue: unknown;
  dirty: boolean;
  changeKind: 'none' | 'added' | 'modified';
  removed: boolean;
}

export interface CodexFeatureRowGroup {
  section: CodexConfigSection;
  id: string;
  rows: CodexFeatureRow[];
}

export interface CodexFeatureRowPathDisplay {
  primaryLabel: string;
  childLabels: string[];
  fullLabel: string;
}

export interface CodexFeatureChangeInput {
  values: Record<string, boolean>;
  changes: Array<{
    id: string;
    section: string;
    key: string;
    path: string[];
    valueType: string;
    value: unknown;
    remove?: boolean;
  }>;
}

export interface CodexFeaturePreviewChange {
  id: string;
  section: string;
  key: string;
  path: string[];
  valueType: string;
  before?: unknown;
  after: unknown;
  kind: string;
}

export interface CodexFeaturePreview {
  configPath: string;
  changes: CodexFeaturePreviewChange[];
  summary: string;
}

export interface CodexFeatureSelectOptions {
  query?: string;
  stageFilter?: CodexFeatureStageFilter;
  sectionFilter?: CodexConfigSection;
}

const stageRank: Record<CodexFeatureStage, number> = {
  recommended: 0,
  stable: 1,
  experimental: 2,
  advanced: 3,
  legacy: 4,
  unknown: 5,
  unsupported: 6,
  deprecated: 7,
  removed: 8,
};

const compatibleStages = new Set<CodexFeatureStage>(['legacy', 'deprecated', 'removed']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readString(record: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return undefined;
}

function readAny(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (hasOwn(record, key)) {
      return record[key];
    }
  }
  return undefined;
}

function readPathList(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
  }
  return [];
}

function readStringList(record: Record<string, unknown>, keys: string[]) {
  const values: string[] = [];

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      values.push(...value.filter((item): item is string => typeof item === 'string'));
    } else if (typeof value === 'string' && value.trim()) {
      values.push(value);
    }
  }

  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function resolveCodexDefaultValue(
  valueType: string,
  defaultValue: unknown,
  defaultEnabled?: boolean
) {
  if (typeof defaultValue !== 'undefined') {
    return defaultValue;
  }
  if (typeof defaultEnabled !== 'undefined') {
    return defaultEnabled;
  }
  if (valueType === 'boolean' || valueType === 'bool') {
    return false;
  }
  return undefined;
}

function normalizeSection(rawSection: unknown): CodexConfigSection {
  const normalized = String(rawSection || '').trim().toLowerCase();
  if (normalized === 'root') {
    return 'root';
  }
  if (normalized === 'notice') {
    return 'notice';
  }
  if (normalized === 'model_providers') {
    return 'model_providers';
  }
  return 'features';
}

function normalizeStage(rawStage: unknown, unsupported: boolean): CodexFeatureStage {
  if (unsupported) {
    return 'unsupported';
  }

  const normalized = String(rawStage || '').trim().toLowerCase().replace(/[\s_-]+/g, '-');
  switch (normalized) {
    case 'recommended':
    case 'default':
      return 'recommended';
    case 'stable':
      return 'stable';
    case 'experimental':
    case 'experiment':
    case 'beta':
      return 'experimental';
    case 'advanced':
    case 'under-development':
      return 'advanced';
    case 'deprecated':
      return 'deprecated';
    case 'removed':
      return 'removed';
    case 'legacy':
    case 'alias':
      return 'legacy';
    case 'unknown':
    case 'custom':
      return 'unknown';
    default:
      return 'unknown';
  }
}

function readItems(raw: unknown): unknown[] {
  if (!isRecord(raw)) {
    return [];
  }

  const candidate = raw.features ?? raw.items ?? raw.featureItems;
  if (Array.isArray(candidate)) {
    return candidate;
  }

  if (isRecord(candidate)) {
    return Object.entries(candidate).map(([key, value]) =>
      isRecord(value) ? { key, ...value } : { key, localValue: value }
    );
  }

  return [];
}

function readBackendDefinitionItems(raw: unknown): unknown[] {
  if (!isRecord(raw) || !Array.isArray(raw.definitions)) {
    return [];
  }

  const values = isRecord(raw.values) ? raw.values : {};
  const typedValues = isRecord(raw.typedValues) ? raw.typedValues : {};
  const rawValues = isRecord(raw.rawValues) ? raw.rawValues : {};
  const unknownValues = isRecord(raw.unknownValues) ? raw.unknownValues : {};
  const unknownSections = isRecord(raw.unknownSections) ? raw.unknownSections : {};
  const definitionItems = raw.definitions.filter(isRecord).map((definition) => {
    const key = readString(definition, ['key', 'name', 'id']);
    const valueType = readString(definition, ['valueType', 'type', 'kind'], 'boolean').toLowerCase();
    const section = normalizeSection(definition.section ?? definition.scope);
    const path = readPathList(definition, ['path']);
    const resolvedPath = path.length > 0 ? path : section === 'root' ? [key] : [section, key];
    const defaultID = resolvedPath.length === 1 ? `root.${resolvedPath[0]}` : resolvedPath.join('.');
    const id = readString(definition, ['id'], defaultID);
    const typedLocalValue = readAny(typedValues, [id, key]);
    const boolLocalValue =
      valueType === 'boolean' || valueType === 'bool' ? readAny(values, [key]) : undefined;
    const localValue = typeof typedLocalValue !== 'undefined' ? typedLocalValue : boolLocalValue;
    const localRawValue = readString(rawValues, [id, key]);
    const hasLocalValue =
      hasOwn(typedValues, id) ||
      hasOwn(typedValues, key) ||
      hasOwn(values, key) ||
      localRawValue !== '';
    const defaultValue = resolveCodexDefaultValue(
      valueType,
      readAny(definition, ['defaultValue', 'default']),
      readBoolean(definition, ['defaultEnabled'])
    );
    const canonicalKey = readString(definition, ['canonicalKey', 'canonical'], key);
    const isLegacyAlias = Boolean(definition.legacyAlias);
    const options = readStringList(definition, ['options']);

    return {
      id,
      section,
      key,
      path: resolvedPath,
      description: readString(definition, ['description', 'help', 'summary']),
      stage: isLegacyAlias ? 'legacy' : definition.stage,
      valueType,
      options,
      defaultValue,
      localValue,
      hasLocalValue,
      localRawValue: localRawValue || (typeof localValue !== 'undefined' ? String(localValue) : ''),
      effectiveValue: localValue ?? defaultValue,
      canonicalKey,
      legacyAliases:
        isLegacyAlias && key && canonicalKey && canonicalKey !== key
          ? [key]
          : readStringList(definition, ['legacyAliases', 'aliases', 'alias']),
      unsupported: Boolean(definition.unsupported),
      readOnly: isLegacyAlias || Boolean(definition.readOnly),
    };
  });

  const unknownItems = Object.entries(unknownValues)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([key, value]) => ({
      id: key,
      section: normalizeSection(unknownSections[key]),
      key,
      path: [key],
      stage: 'unknown',
      valueType: 'boolean',
      options: [],
      defaultValue: value,
      localValue: value,
      hasLocalValue: true,
      localRawValue: String(value),
      effectiveValue: value,
      canonicalKey: key,
      readOnly: false,
      unsupported: false,
    }));

  return [...definitionItems, ...unknownItems];
}

function normalizeItem(rawItem: unknown): CodexFeatureConfigItem | null {
  if (!isRecord(rawItem)) {
    return null;
  }

  const key = readString(rawItem, ['key', 'name', 'id']);
  if (!key) {
    return null;
  }
  const valueType = readString(rawItem, ['valueType', 'type', 'kind'], 'boolean').toLowerCase();
  const defaultValue = resolveCodexDefaultValue(
    valueType,
    readAny(rawItem, ['defaultValue', 'default', 'schemaDefault']),
    readBoolean(rawItem, ['defaultEnabled'])
  );
  const localValue = readAny(rawItem, ['localValue', 'local', 'fileValue', 'effectiveValue', 'value', 'currentValue']);
  const hasLocalValue = Boolean(
    readBoolean(rawItem, ['hasLocalValue']) ??
      hasOwn(rawItem, 'localValue') ??
      hasOwn(rawItem, 'local') ??
      hasOwn(rawItem, 'fileValue') ??
      hasOwn(rawItem, 'effectiveValue') ??
      hasOwn(rawItem, 'value') ??
      hasOwn(rawItem, 'currentValue')
  );
  const unsupported = Boolean(rawItem.unsupported);
  const stage = normalizeStage(
    rawItem.stage ??
      (rawItem.removed ? 'removed' : rawItem.deprecated ? 'deprecated' : rawItem.legacy ? 'legacy' : undefined),
    unsupported
  );
  const effectiveValue = localValue ?? defaultValue;
  const localRawValue = readString(rawItem, ['localRawValue', 'rawValue', 'sourceValue']);
  const hiddenByDefault = (stage === 'deprecated' || stage === 'removed') && !hasLocalValue;
  const path = readPathList(rawItem, ['path']);

  return {
    id: readString(rawItem, ['id'], key),
    section: normalizeSection(rawItem.section ?? rawItem.scope),
    key,
    path: path.length > 0 ? path : [key],
    description: readString(rawItem, ['description', 'help', 'summary']),
    stage,
    valueType,
    options: readStringList(rawItem, ['options']),
    defaultValue,
    localValue,
    localRawValue: localRawValue || (typeof localValue === 'boolean' ? String(localValue) : ''),
    effectiveValue,
    hasLocalValue,
    legacyAliases: readStringList(rawItem, ['legacyAliases', 'aliases', 'alias']),
    canonicalKey: readString(rawItem, ['canonicalKey', 'canonical'], key),
    unsupported,
    readOnly: unsupported || Boolean(rawItem.readOnly) || stage === 'removed',
    hiddenByDefault,
  };
}

const expandableRootTableKeys = new Set(['marketplaces', 'plugins']);

function inferCodexLeafValueType(value: unknown) {
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string') ? 'string_array' : 'toml';
  }
  return 'string';
}

function flattenSimpleCodexTableLeaves(value: unknown, path: string[]): Array<{ path: string[]; value: unknown }> {
  if (!isRecord(value)) {
    return [{ path, value }];
  }

  const leaves: Array<{ path: string[]; value: unknown }> = [];
  for (const [childKey, childValue] of Object.entries(value)) {
    if (isRecord(childValue)) {
      leaves.push(...flattenSimpleCodexTableLeaves(childValue, [...path, childKey]));
    } else {
      leaves.push({ path: [...path, childKey], value: childValue });
    }
  }
  return leaves;
}

function expandCodexConfigItem(item: CodexFeatureConfigItem): CodexFeatureConfigItem[] {
  const rootKey = item.path[0] || item.key;
  if (item.section !== 'root' || !expandableRootTableKeys.has(rootKey) || !isRecord(item.effectiveValue)) {
    return [item];
  }

  const leaves = flattenSimpleCodexTableLeaves(item.effectiveValue, item.path);
  if (leaves.length === 0) {
    return [item];
  }

  return leaves.map((leaf) => {
    const id = leaf.path.join('.');
    const valueType = inferCodexLeafValueType(leaf.value);
    return {
      ...item,
      id,
      key: id,
      path: leaf.path,
      valueType,
      options: valueType === 'boolean' ? ['true', 'false'] : [],
      defaultValue: leaf.value,
      localValue: leaf.value,
      localRawValue: String(leaf.value ?? ''),
      effectiveValue: leaf.value,
      hasLocalValue: true,
      canonicalKey: id,
      legacyAliases: [],
      unsupported: false,
      readOnly: item.readOnly,
      hiddenByDefault: false,
    };
  });
}

export function normalizeCodexFeatureConfigSnapshot(raw: unknown): CodexFeatureConfigSnapshot {
  const record = isRecord(raw) ? raw : {};
  const explicitItems = readItems(raw);
  const itemSource = explicitItems.length > 0 ? explicitItems : readBackendDefinitionItems(raw);
  const items = itemSource
    .map(normalizeItem)
    .filter((item): item is CodexFeatureConfigItem => Boolean(item))
    .flatMap(expandCodexConfigItem)
    .sort((left, right) => {
      const rankDiff = stageRank[left.stage] - stageRank[right.stage];
      return rankDiff === 0 ? left.key.localeCompare(right.key) : rankDiff;
    });

  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    codexHomePath: readString(record, ['codexHomePath', 'homePath']),
    configPath: readString(record, ['configPath', 'path']),
    items,
    warnings,
    loadedAt: readString(record, ['loadedAt', 'updatedAt'], new Date().toISOString()),
  };
}

export function buildCodexFeatureDraft(snapshot: CodexFeatureConfigSnapshot): CodexFeatureDraft {
  const values: Record<string, unknown> = {};
  for (const item of snapshot.items) {
    if (!item.unsupported && !item.readOnly) {
      if (typeof item.effectiveValue !== 'undefined') {
        values[item.id] = item.effectiveValue;
      }
    }
  }
  return { values };
}

export function setCodexFeatureDraftValue(
  draft: CodexFeatureDraft,
  key: string,
  value: unknown
): CodexFeatureDraft {
  const removed = { ...(draft.removed || {}) };
  delete removed[key];
  return {
    values: {
      ...draft.values,
      [key]: value,
    },
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
  };
}

export function removeCodexFeatureDraftValue(draft: CodexFeatureDraft, key: string): CodexFeatureDraft {
  const values = { ...draft.values };
  delete values[key];
  return {
    values,
    removed: {
      ...(draft.removed || {}),
      [key]: true,
    },
  };
}

function matchesStageFilter(item: CodexFeatureConfigItem, filter: CodexFeatureStageFilter) {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'compat') {
    return compatibleStages.has(item.stage);
  }
  return item.stage === filter;
}

function matchesSectionFilter(item: CodexFeatureConfigItem, filter: CodexConfigSection | undefined) {
  return !filter || item.section === filter;
}

function matchesQuery(item: CodexFeatureConfigItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    item.id,
    item.key,
    item.description,
    item.stage,
    item.section,
    item.path.join('.'),
    item.canonicalKey,
    item.localRawValue,
    String(item.effectiveValue ?? ''),
    ...item.legacyAliases,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function isHiddenByCurrentFilter(item: CodexFeatureConfigItem, stageFilter: CodexFeatureStageFilter) {
  if (!item.hiddenByDefault) {
    return false;
  }
  return stageFilter !== item.stage;
}

function areCodexValuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

function resolveDraftValue(item: CodexFeatureConfigItem, draft: CodexFeatureDraft) {
  if (draft.removed?.[item.id] || draft.removed?.[item.key]) {
    return undefined;
  }
  if (hasOwn(draft.values, item.id)) {
    return draft.values[item.id];
  }
  if (hasOwn(draft.values, item.key)) {
    return draft.values[item.key];
  }
  return item.effectiveValue;
}

export function selectCodexFeatureRows(
  snapshot: CodexFeatureConfigSnapshot,
  draft: CodexFeatureDraft,
  options: CodexFeatureSelectOptions = {}
): CodexFeatureRow[] {
  const stageFilter = options.stageFilter ?? 'all';
  const query = options.query ?? '';

  return snapshot.items
    .filter((item) => matchesSectionFilter(item, options.sectionFilter))
    .filter((item) => matchesStageFilter(item, stageFilter))
    .filter((item) => !isHiddenByCurrentFilter(item, stageFilter))
    .filter((item) => matchesQuery(item, query))
    .map((item) => {
      const draftValue = resolveDraftValue(item, draft);
      const removed = Boolean(draft.removed?.[item.id] || draft.removed?.[item.key]);
      const dirty = !item.readOnly && !areCodexValuesEqual(draftValue, item.effectiveValue);
      const changeKind: CodexFeatureRow['changeKind'] = dirty
        ? item.hasLocalValue
          ? 'modified'
          : 'added'
        : 'none';
      return {
        ...item,
        draftValue,
        dirty,
        changeKind,
        removed,
      };
    });
}

const codexRootGroupOrder = ['launch', 'model', 'policy', 'workspace', 'integrations', 'advanced'] as const;
const codexFeaturesGroupOrder = ['core', 'experimental', 'advanced', 'compat'] as const;
const codexNoticeGroupOrder = ['safety', 'migration', 'raw'] as const;

const codexRootLaunchKeys = new Set([
  'allow_login_shell',
  'check_for_update_on_startup',
  'disable_paste_burst',
  'profile',
]);

const codexRootModelKeys = new Set([
  'model',
  'model_provider',
  'model_reasoning_effort',
  'model_reasoning_summary',
  'model_verbosity',
  'model_context_window',
  'model_auto_compact_token_limit',
  'model_auto_compact_token_limit_scope',
  'model_catalog_json',
  'model_instructions_file',
  'model_supports_reasoning_summaries',
  'review_model',
  'plan_mode_reasoning_effort',
  'notify',
  'personality',
  'fast_mode',
  'goals',
  'workspace_dependencies',
  'web_search',
  'openai_base_url',
  'chatgpt_base_url',
  'oss_provider',
  'service_tier',
  'tool_output_token_limit',
  'hide_agent_reasoning',
  'show_raw_agent_reasoning',
  'suppress_unstable_features_warning',
]);

const codexRootPolicyKeys = new Set([
  'approval_policy',
  'approvals_reviewer',
  'sandbox_mode',
  'default_permissions',
  'auto_review',
  'sandbox_workspace_write',
  'permissions',
  'include_permissions_instructions',
  'include_apps_instructions',
  'include_collaboration_mode_instructions',
  'include_environment_context',
]);

const codexRootWorkspaceKeys = new Set([
  'log_dir',
  'file_opener',
  'instructions',
  'developer_instructions',
  'compact_prompt',
  'experimental_compact_prompt_file',
  'experimental_realtime_start_instructions',
  'experimental_realtime_ws_backend_prompt',
  'experimental_realtime_ws_base_url',
  'experimental_realtime_ws_model',
  'experimental_realtime_ws_startup_context',
  'experimental_thread_config_endpoint',
  'project_doc_fallback_filenames',
  'project_doc_max_bytes',
  'project_root_markers',
]);

const codexRootIntegrationKeys = new Set([
  'apps',
  'apps_mcp_product_sku',
  'mcp_oauth_callback_port',
  'mcp_oauth_callback_url',
  'mcp_oauth_credentials_store',
  'hooks',
  'plugins',
  'skills',
  'tool_suggest',
  'tools',
  'tui',
  'desktop',
  'audio',
  'feedback',
  'ghost_snapshot',
  'history',
  'analytics',
  'otel',
  'memories',
  'windows',
  'shell_environment_policy',
  'realtime',
  'agents',
  'mcp_servers',
  'marketplaces',
]);

function resolveCodexRowGroupId(row: CodexFeatureRow) {
  if (row.section === 'features') {
    if (row.stage === 'recommended' || row.stage === 'stable') {
      return 'core';
    }
    if (row.stage === 'experimental') {
      return 'experimental';
    }
    if (row.stage === 'advanced') {
      return 'advanced';
    }
    return 'compat';
  }

  if (row.section === 'notice') {
    if (row.key === 'external_config_migration_prompts' || row.key === 'model_migrations') {
      return 'raw';
    }
    if (row.key === 'hide_gpt5_1_migration_prompt' || row.key === 'hide_gpt-5.1-codex-max_migration_prompt') {
      return 'migration';
    }
    return 'safety';
  }

  if (row.section === 'model_providers') {
    return row.path[1] || row.key;
  }

  if (row.section !== 'root') {
    return 'advanced';
  }

  const rootKey = row.path[0] || row.key;

  if (codexRootLaunchKeys.has(rootKey)) {
    return 'launch';
  }
  if (codexRootModelKeys.has(rootKey) || rootKey.startsWith('model_')) {
    return 'model';
  }
  if (codexRootPolicyKeys.has(rootKey) || rootKey.startsWith('approval_') || rootKey.startsWith('sandbox_')) {
    return 'policy';
  }
  if (
    codexRootWorkspaceKeys.has(rootKey) ||
    rootKey.startsWith('project_') ||
    rootKey === 'compact_prompt' ||
    rootKey === 'developer_instructions' ||
    rootKey === 'file_opener'
  ) {
    return 'workspace';
  }
  if (codexRootIntegrationKeys.has(rootKey) || rootKey.startsWith('mcp_oauth_')) {
    return 'integrations';
  }
  return 'advanced';
}

export function groupCodexFeatureRows(rows: CodexFeatureRow[]): CodexFeatureRowGroup[] {
  const groupedBySection = new Map<CodexConfigSection, Map<string, CodexFeatureRow[]>>();

  for (const row of rows) {
    const sectionGroups = groupedBySection.get(row.section) || new Map<string, CodexFeatureRow[]>();
    const groupId = resolveCodexRowGroupId(row);
    if (!sectionGroups.has(groupId)) {
      sectionGroups.set(groupId, []);
    }
    sectionGroups.get(groupId)!.push(row);
    groupedBySection.set(row.section, sectionGroups);
  }

  const groupedRows: CodexFeatureRowGroup[] = [];
  const sectionOrder: CodexConfigSection[] = ['root', 'features', 'notice', 'model_providers'];

  for (const section of sectionOrder) {
    const sectionGroups = groupedBySection.get(section);
    if (!sectionGroups) {
      continue;
    }

    if (section === 'model_providers') {
      for (const [id, sectionRows] of Array.from(sectionGroups.entries()).sort(([left], [right]) => left.localeCompare(right))) {
        groupedRows.push({ section, id, rows: sectionRows });
      }
      continue;
    }

    const orderedGroupIds =
      section === 'root'
        ? codexRootGroupOrder
        : section === 'features'
          ? codexFeaturesGroupOrder
          : codexNoticeGroupOrder;
    const orderedGroupIdSet = new Set<string>(orderedGroupIds);

    for (const groupId of orderedGroupIds) {
      const sectionRows = sectionGroups.get(groupId);
      if (sectionRows && sectionRows.length > 0) {
        groupedRows.push({ section, id: groupId, rows: sectionRows });
      }
    }

    for (const [groupId, sectionRows] of sectionGroups.entries()) {
      if (!orderedGroupIdSet.has(groupId)) {
        groupedRows.push({ section, id: groupId, rows: sectionRows });
      }
    }
  }

  return groupedRows;
}

export function resolveCodexFeatureRowPathDisplay(
  row: Pick<CodexFeatureRow, 'section' | 'key' | 'path'>
): CodexFeatureRowPathDisplay {
  const path = row.path.length > 0 ? row.path : row.key.split('.').filter(Boolean);
  const fullLabel = path.length > 0 ? path.join('.') : row.key;

  if (row.section === 'model_providers') {
    return {
      primaryLabel: path[1] || row.key,
      childLabels: path.slice(2),
      fullLabel,
    };
  }

  if (row.section === 'root') {
    return {
      primaryLabel: path[0] || row.key,
      childLabels: path.slice(1),
      fullLabel,
    };
  }

  return {
    primaryLabel: row.key,
    childLabels: [],
    fullLabel,
  };
}

export function buildCodexFeatureChangeInput(
  snapshot: CodexFeatureConfigSnapshot,
  draft: CodexFeatureDraft,
  options: Pick<CodexFeatureSelectOptions, 'sectionFilter'> = {}
): CodexFeatureChangeInput {
  const values: Record<string, boolean> = {};
  const changes: CodexFeatureChangeInput['changes'] = [];

  for (const row of selectCodexFeatureRows(snapshot, draft, { stageFilter: 'all', sectionFilter: options.sectionFilter })) {
    if (row.readOnly || !row.dirty) {
      continue;
    }
    if (!row.removed && (row.valueType === 'boolean' || row.valueType === 'bool')) {
      values[row.key] = Boolean(row.draftValue);
    }
    changes.push({
      id: row.id,
      section: row.section,
      key: row.key,
      path: row.path,
      valueType: row.valueType,
      value: row.draftValue,
      ...(row.removed ? { remove: true } : {}),
    });
  }

  return { values, changes };
}

export function normalizeCodexFeaturePreview(
  raw: unknown,
  fallbackInput: CodexFeatureChangeInput,
  configPath = ''
): CodexFeaturePreview {
  const record = isRecord(raw) ? raw : {};
  const rawChanges = Array.isArray(record.changes) ? record.changes : [];
  const changes: CodexFeaturePreviewChange[] = rawChanges
    .filter(isRecord)
    .map((item): CodexFeaturePreviewChange | null => {
      const key = readString(item, ['key', 'name', 'id']);
      const id = readString(item, ['id'], key);
      const path = readPathList(item, ['path']);
      const valueType = readString(item, ['valueType', 'value_type'], 'boolean');
      const kind = readString(item, ['kind', 'type'], 'modified');
      const after = readAny(item, ['after', 'afterValue', 'nextValue', 'nextEnabled', 'value']);
      if (!key || (typeof after === 'undefined' && kind !== 'removed')) {
        return null;
      }
      const before = readAny(item, ['before', 'beforeValue', 'previousValue', 'previousEnabled']);
      return {
        id,
        section: readString(item, ['section'], ''),
        key,
        path: path.length > 0 ? path : [key],
        valueType,
        ...(typeof before !== 'undefined' ? { before } : {}),
        after,
        kind,
      };
    })
    .filter((item): item is CodexFeaturePreviewChange => Boolean(item));

  const fallbackChanges =
    Array.isArray(fallbackInput.changes) && fallbackInput.changes.length > 0
      ? fallbackInput.changes.map((change) => ({
          id: change.id,
          section: change.section,
          key: change.key,
          path: change.path,
          valueType: change.valueType,
          before: undefined,
          after: change.remove ? undefined : change.value,
          kind: change.remove ? 'removed' : 'modified',
        }))
      : Object.entries(fallbackInput.values).map(([key, after]) => ({
          id: key,
          section: '',
          key,
          path: [key],
          valueType: 'boolean',
          before: undefined,
          after,
          kind: 'modified',
        }));
  const resolvedChanges = changes.length > 0 ? changes : fallbackChanges;

  return {
    configPath: readString(record, ['configPath', 'path'], configPath),
    changes: resolvedChanges,
    summary: readString(record, ['summary'], `${resolvedChanges.length} feature change(s)`),
  };
}
