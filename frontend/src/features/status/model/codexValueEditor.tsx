import SegmentedControl from '../../../components/ui/SegmentedControl';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import type { CodexFeatureRow } from './codexFeatureConfig';
import { selectCodexValueEditorKind } from './codexValueEditorModel';

function stringifyCodexValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join('\n');
  }
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function resolveSegmentedEnumOptions(row: CodexFeatureRow) {
  const value = typeof row.draftValue === 'string' ? row.draftValue : '';
  const options = value && !row.options.includes(value) ? [value, ...row.options] : row.options;
  return options.map((option) => ({ id: option, label: option }));
}

export function renderCodexValueEditor(
  row: CodexFeatureRow,
  disabled: boolean,
  onChangeSetting: (id: string, value: unknown) => void
) {
  const value = row.draftValue;
  const editorKind = selectCodexValueEditorKind(row);

  if (editorKind === 'toggle') {
    return (
      <ToggleSwitch
        label={row.id}
        checked={Boolean(value)}
        disabled={disabled}
        className="mx-auto h-9 w-16"
        onChange={(checked) => onChangeSetting(row.id, checked)}
      />
    );
  }

  if (editorKind === 'segment') {
    const selectedValue = typeof value === 'string' && row.options.includes(value) ? value : typeof value === 'string' ? value : '';
    return (
      <SegmentedControl
        options={resolveSegmentedEnumOptions(row)}
        value={selectedValue}
        disabled={disabled}
        onChange={(nextValue) => onChangeSetting(row.id, nextValue)}
      />
    );
  }

  if (editorKind === 'number') {
    return (
      <input
        type="number"
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(event) => onChangeSetting(row.id, event.target.value === '' ? '' : Number(event.target.value))}
        className="input-swiss w-full"
      />
    );
  }

  if (editorKind === 'string_array') {
    return (
      <textarea
        value={stringifyCodexValue(value)}
        disabled={disabled}
        rows={4}
        onChange={(event) =>
          onChangeSetting(
            row.id,
            event.target.value
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean)
          )
        }
        className="input-swiss min-h-24 w-full resize-y font-mono"
      />
    );
  }

  if (editorKind === 'textarea') {
    return (
      <textarea
        value={stringifyCodexValue(value)}
        disabled={disabled}
        rows={row.valueType === 'toml' ? 5 : 3}
        onChange={(event) => onChangeSetting(row.id, event.target.value)}
        className="input-swiss min-h-24 w-full resize-y font-mono"
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      disabled={disabled}
      onChange={(event) => onChangeSetting(row.id, event.target.value)}
      className="input-swiss w-full"
    />
  );
}
