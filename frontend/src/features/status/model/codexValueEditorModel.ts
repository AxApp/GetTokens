import type { CodexFeatureRow } from './codexFeatureConfig';

export type CodexValueEditorKind = 'toggle' | 'segment' | 'number' | 'string_array' | 'textarea' | 'text';

export function selectCodexValueEditorKind(row: Pick<CodexFeatureRow, 'valueType' | 'options' | 'draftValue'>): CodexValueEditorKind {
  if (row.valueType === 'boolean' || row.valueType === 'bool') {
    return 'toggle';
  }

  if (row.valueType === 'enum' && row.options.length > 0) {
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
