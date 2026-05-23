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
}

export interface CodexFeatureRow extends CodexFeatureConfigItem {
  draftValue: unknown;
  dirty: boolean;
  changeKind: 'none' | 'added' | 'modified';
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
      };
    });
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
    if (row.valueType === 'boolean' || row.valueType === 'bool') {
      values[row.key] = Boolean(row.draftValue);
    }
    changes.push({
      id: row.id,
      section: row.section,
      key: row.key,
      path: row.path,
      valueType: row.valueType,
      value: row.draftValue,
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
      const after = readAny(item, ['after', 'afterValue', 'nextValue', 'nextEnabled', 'value']);
      if (!key || typeof after === 'undefined') {
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
        kind: readString(item, ['kind', 'type'], 'modified'),
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
          after: change.value,
          kind: 'modified',
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
