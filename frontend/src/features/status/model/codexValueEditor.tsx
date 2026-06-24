import { Button, Input, Tooltip } from 'antd';
import { RotateCcw } from 'lucide-react';
import type { ReactElement } from 'react';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import type { CodexFeatureRow } from './codexFeatureConfig';
import { coerceCodexBooleanEditorValue, selectCodexValueEditorKind } from './codexValueEditorModel';

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

const codexValueEditorInputClass =
  'w-full rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)] transition-colors placeholder:text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-muted)] focus:border-[var(--gt-border-strong)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
const codexValueEditorTextareaClass =
  'min-h-24 w-full resize-y rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)] transition-colors placeholder:text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-muted)] focus:border-[var(--gt-border-strong)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
const codexValueEditorResetButtonClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-40';

export function renderCodexValueEditor(
  row: CodexFeatureRow,
  disabled: boolean,
  onChangeSetting: (id: string, value: unknown) => void,
  onRemoveSetting?: (id: string) => void
) {
  const value = row.draftValue;
  const editorKind = selectCodexValueEditorKind(row);
  const canRemove = Boolean(onRemoveSetting && row.hasLocalValue && !row.readOnly);
  const resetButton = canRemove ? (
    <Tooltip title="移除本地配置">
      <Button
        size="small"
        aria-label={`移除 ${row.id} 本地配置`}
        disabled={disabled}
        onClick={() => onRemoveSetting?.(row.id)}
        className={codexValueEditorResetButtonClass}
        data-codex-value-editor-reset
        icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={3} />}
      />
    </Tooltip>
  ) : null;

  function withReset(control: ReactElement) {
    return (
      <div className="flex w-full min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        {resetButton}
      </div>
    );
  }

  function resolveNumberEnableValue() {
    if (typeof row.draftValue === 'number') {
      return row.draftValue;
    }
    if (typeof row.localValue === 'number') {
      return row.localValue;
    }
    if (typeof row.effectiveValue === 'number') {
      return row.effectiveValue;
    }
    if (typeof row.defaultValue === 'number') {
      return row.defaultValue;
    }
    return 0;
  }

  if (editorKind === 'toggle') {
    return withReset(
      <ToggleSwitch
        label={row.id}
        checked={coerceCodexBooleanEditorValue(value)}
        disabled={disabled}
        className="ml-auto h-9 w-16"
        onChange={(checked) => onChangeSetting(row.id, checked)}
      />
    );
  }

  if (editorKind === 'segment') {
    const selectedValue = typeof value === 'string' && row.options.includes(value) ? value : typeof value === 'string' ? value : '';
    return withReset(
      <SegmentedControl
        options={resolveSegmentedEnumOptions(row)}
        value={selectedValue}
        disabled={disabled}
        onChange={(nextValue) => onChangeSetting(row.id, nextValue)}
      />
    );
  }

  if (editorKind === 'number') {
    const enabled = !row.removed && typeof value !== 'undefined';
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        {onRemoveSetting ? (
          <ToggleSwitch
            label={`${row.id} 本地配置`}
            checked={enabled}
            disabled={disabled || row.readOnly}
            className="h-10 w-16 shrink-0"
            onChange={(checked) => {
              if (checked) {
                onChangeSetting(row.id, resolveNumberEnableValue());
              } else {
                onRemoveSetting(row.id);
              }
            }}
          />
        ) : null}
        <Input
          type="number"
          value={String(value ?? '')}
          disabled={disabled || !enabled}
          onChange={(event) => onChangeSetting(row.id, event.target.value === '' ? '' : Number(event.target.value))}
          className={codexValueEditorInputClass}
          size="small"
        />
      </div>
    );
  }

  if (editorKind === 'string_array') {
    return withReset(
      <Input.TextArea
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
        className={codexValueEditorTextareaClass}
        size="small"
      />
    );
  }

  if (editorKind === 'textarea') {
    return withReset(
      <Input.TextArea
        value={stringifyCodexValue(value)}
        disabled={disabled}
        rows={row.valueType === 'toml' ? 5 : 3}
        onChange={(event) => onChangeSetting(row.id, event.target.value)}
        className={codexValueEditorTextareaClass}
        size="small"
      />
    );
  }

  return withReset(
    <Input
      type="text"
      value={String(value ?? '')}
      disabled={disabled}
      onChange={(event) => onChangeSetting(row.id, event.target.value)}
      className={codexValueEditorInputClass}
      size="small"
    />
  );
}
