import type { CodexFeatureRow } from './codexFeatureConfig';

export type CodexValueEditorKind = 'toggle' | 'segment' | 'number' | 'string_array' | 'textarea' | 'text';

function normalizeBooleanString(value: string) {
  return value.trim().toLowerCase();
}

function isBooleanStringValue(value: unknown) {
  return typeof value === 'string' && (normalizeBooleanString(value) === 'true' || normalizeBooleanString(value) === 'false');
}

function hasBooleanOnlyOptions(options: string[]) {
  const normalizedOptions = new Set(options.map(normalizeBooleanString));
  return options.length === 2 && normalizedOptions.has('true') && normalizedOptions.has('false');
}

export function coerceCodexBooleanEditorValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return normalizeBooleanString(value) === 'true';
  }
  return Boolean(value);
}

export function selectCodexValueEditorKind(row: Pick<CodexFeatureRow, 'valueType' | 'options' | 'draftValue'>): CodexValueEditorKind {
  const valueType = row.valueType.trim().toLowerCase();

  if (valueType === 'boolean' || valueType === 'bool') {
    return 'toggle';
  }

  if (valueType === 'integer' || valueType === 'number') {
    return 'number';
  }

  if (valueType === 'string_array') {
    return 'string_array';
  }

  if (valueType === 'textarea' || valueType === 'text' || valueType === 'toml') {
    return 'textarea';
  }

  if (valueType === 'enum') {
    return hasBooleanOnlyOptions(row.options) ? 'toggle' : 'segment';
  }

  if (
    typeof row.draftValue === 'boolean' ||
    isBooleanStringValue(row.draftValue) ||
    hasBooleanOnlyOptions(row.options)
  ) {
    return 'toggle';
  }

  if (row.options.length > 0) {
    return 'segment';
  }

  return 'text';
}
