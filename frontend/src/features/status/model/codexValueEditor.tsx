import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import type { CodexFeatureRow } from './codexFeatureConfig';

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

export function renderCodexValueEditor(
  row: CodexFeatureRow,
  disabled: boolean,
  onChangeSetting: (id: string, value: unknown) => void
) {
  const value = row.draftValue;

  if (row.valueType === 'boolean' || row.valueType === 'bool') {
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

  if (row.valueType === 'enum' && row.options.length > 0) {
    return (
      <select
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(event) => onChangeSetting(row.id, event.target.value)}
        className="select-swiss w-full"
      >
        {row.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (row.valueType === 'integer' || row.valueType === 'number') {
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

  if (row.valueType === 'string_array') {
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

  if (row.valueType === 'textarea' || row.valueType === 'text' || row.valueType === 'toml') {
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
