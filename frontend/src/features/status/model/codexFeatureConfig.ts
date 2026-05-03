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

export interface CodexFeatureConfigItem {
  key: string;
  description: string;
  stage: CodexFeatureStage;
  defaultValue: boolean;
  localValue?: boolean;
  localRawValue: string;
  effectiveValue: boolean;
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
  values: Record<string, boolean>;
}

export interface CodexFeatureRow extends CodexFeatureConfigItem {
  draftValue: boolean;
  dirty: boolean;
  changeKind: 'none' | 'added' | 'modified';
}

export interface CodexFeatureChangeInput {
  values: Record<string, boolean>;
}

export interface CodexFeaturePreviewChange {
  key: string;
  before?: boolean;
  after: boolean;
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
  const unknownValues = isRecord(raw.unknownValues) ? raw.unknownValues : {};
  const definitionItems = raw.definitions.filter(isRecord).map((definition) => {
    const key = readString(definition, ['key', 'name', 'id']);
    const hasLocalValue = key ? hasOwn(values, key) : false;
    const localValue = key ? readBoolean(values, [key]) : undefined;
    const defaultValue = readBoolean(definition, ['defaultEnabled', 'defaultValue', 'default']) ?? false;
    const canonicalKey = readString(definition, ['canonicalKey', 'canonical'], key);
    const isLegacyAlias = Boolean(definition.legacyAlias);

    return {
      key,
      description: readString(definition, ['description', 'help', 'summary']),
      stage: isLegacyAlias ? 'legacy' : definition.stage,
      defaultValue,
      localValue,
      hasLocalValue,
      localRawValue: hasLocalValue && typeof localValue === 'boolean' ? String(localValue) : '',
      effectiveValue: (typeof localValue === 'boolean' ? localValue : undefined) ?? defaultValue,
      canonicalKey,
      legacyAliases:
        isLegacyAlias && key && canonicalKey && canonicalKey !== key
          ? [key]
          : readStringList(definition, ['legacyAliases', 'aliases', 'alias']),
      readOnly: isLegacyAlias,
    };
  });

  const unknownItems = Object.entries(unknownValues)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([key, value]) => ({
      key,
      stage: 'unknown',
      defaultValue: value,
      localValue: value,
      hasLocalValue: true,
      localRawValue: String(value),
      effectiveValue: value,
      canonicalKey: key,
      readOnly: false,
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

  const valueType = readString(rawItem, ['valueType', 'type', 'kind']).toLowerCase();
  const defaultValue = readBoolean(rawItem, ['defaultValue', 'default', 'schemaDefault']);
  const localValue = readBoolean(rawItem, ['localValue', 'local', 'fileValue']);
  const currentValue = readBoolean(rawItem, ['effectiveValue', 'value', 'currentValue']);
  const hasLocalValue = Boolean(
    readBoolean(rawItem, ['hasLocalValue']) ??
      hasOwn(rawItem, 'localValue') ??
      hasOwn(rawItem, 'local') ??
      hasOwn(rawItem, 'fileValue')
  );
  const boolByType = valueType === 'bool' || valueType === 'boolean';
  const boolByValue =
    typeof defaultValue === 'boolean' || typeof localValue === 'boolean' || typeof currentValue === 'boolean';
  const unsupported =
    Boolean(rawItem.unsupported) || Boolean(valueType && !boolByType && !boolByValue);

  if (!boolByType && !boolByValue && !unsupported) {
    return null;
  }

  const stage = normalizeStage(
    rawItem.stage ??
      (rawItem.removed ? 'removed' : rawItem.deprecated ? 'deprecated' : rawItem.legacy ? 'legacy' : undefined),
    unsupported
  );
  const resolvedDefault = defaultValue ?? currentValue ?? localValue ?? false;
  const resolvedLocal = typeof localValue === 'boolean' ? localValue : undefined;
  const effectiveValue = resolvedLocal ?? currentValue ?? resolvedDefault;
  const localRawValue =
    readString(rawItem, ['localRawValue', 'rawValue', 'sourceValue']) ||
    (hasLocalValue && typeof resolvedLocal === 'boolean' ? String(resolvedLocal) : '');
  const hiddenByDefault = (stage === 'deprecated' || stage === 'removed') && !hasLocalValue;

  return {
    key,
    description: readString(rawItem, ['description', 'help', 'summary']),
    stage,
    defaultValue: resolvedDefault,
    localValue: resolvedLocal,
    localRawValue,
    effectiveValue,
    hasLocalValue,
    legacyAliases: readStringList(rawItem, ['legacyAliases', 'aliases', 'alias']),
    canonicalKey: readString(rawItem, ['canonicalKey', 'canonical'], key),
    unsupported,
    readOnly: unsupported || Boolean(rawItem.readOnly) || stage === 'removed',
    hiddenByDefault,
  };
}

export function normalizeCodexFeatureConfigSnapshot(raw: unknown): CodexFeatureConfigSnapshot {
  const record = isRecord(raw) ? raw : {};
  const explicitItems = readItems(raw);
  const itemSource = explicitItems.length > 0 ? explicitItems : readBackendDefinitionItems(raw);
  const items = itemSource
    .map(normalizeItem)
    .filter((item): item is CodexFeatureConfigItem => Boolean(item))
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
  const values: Record<string, boolean> = {};
  for (const item of snapshot.items) {
    if (!item.unsupported && !item.readOnly) {
      values[item.key] = item.effectiveValue;
    }
  }
  return { values };
}

export function setCodexFeatureDraftValue(
  draft: CodexFeatureDraft,
  key: string,
  value: boolean
): CodexFeatureDraft {
  return {
    values: {
      ...draft.values,
      [key]: value,
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

function matchesQuery(item: CodexFeatureConfigItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    item.key,
    item.description,
    item.stage,
    item.canonicalKey,
    item.localRawValue,
    ...item.legacyAliases,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

export function selectCodexFeatureRows(
  snapshot: CodexFeatureConfigSnapshot,
  draft: CodexFeatureDraft,
  options: CodexFeatureSelectOptions = {}
): CodexFeatureRow[] {
  const stageFilter = options.stageFilter ?? 'all';
  const query = options.query ?? '';

  return snapshot.items
    .filter((item) => (stageFilter === 'all' || stageFilter === 'compat' ? !item.hiddenByDefault : true))
    .filter((item) => matchesStageFilter(item, stageFilter))
    .filter((item) => matchesQuery(item, query))
    .map((item) => {
      const draftValue = draft.values[item.key] ?? item.effectiveValue;
      const dirty = !item.readOnly && draftValue !== item.effectiveValue;
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
      };
    });
}

export function buildCodexFeatureChangeInput(
  snapshot: CodexFeatureConfigSnapshot,
  draft: CodexFeatureDraft
): CodexFeatureChangeInput {
  const values: Record<string, boolean> = {};

  for (const row of selectCodexFeatureRows(snapshot, draft, { stageFilter: 'all' })) {
    if (row.readOnly || !row.dirty) {
      continue;
    }
    values[row.key] = row.draftValue;
  }

  return { values };
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
      const after = readBoolean(item, ['after', 'afterValue', 'nextEnabled', 'value']);
      if (!key || typeof after !== 'boolean') {
        return null;
      }
      const before = readBoolean(item, ['before', 'beforeValue', 'previousEnabled']);
      return {
        key,
        ...(typeof before === 'boolean' ? { before } : {}),
        after,
        kind: readString(item, ['kind', 'type'], 'modified'),
      };
    })
    .filter((item): item is CodexFeaturePreviewChange => Boolean(item));

  const fallbackChanges = Object.entries(fallbackInput.values).map(([key, after]) => ({
    key,
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
