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
  if (
    row.valueType === 'boolean' ||
    row.valueType === 'bool' ||
    typeof row.draftValue === 'boolean' ||
    isBooleanStringValue(row.draftValue) ||
    hasBooleanOnlyOptions(row.options)
  ) {
    return 'toggle';
  }

  if (row.options.length > 0 || row.valueType === 'enum') {
    return 'segment';
  }

  if (row.valueType === 'integer' || row.valueType === 'number') {
    return 'number';
  }

  if (row.valueType === 'string_array') {
    return 'string_array';
  }

  if (row.valueType === 'textarea' || row.valueType === 'text' || row.valueType === 'toml') {
    return 'textarea';
  }

  return 'text';
}
