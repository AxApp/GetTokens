import { Copy } from 'lucide-react';
import { FieldLabel, quietControlClass } from './FormField';

export interface ActionSelectOption {
  value: string;
  label: string;
}

interface ActionSelectProps {
  title: string;
  value: string;
  options: ActionSelectOption[];
  onSelect: (value: string) => void;
  onCreate: () => void;
  onCopy?: () => void;
  createDisabled?: boolean;
  copyDisabled?: boolean;
  selectDisabled?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  copyTitle?: string;
}

export default function ActionSelect({
  title,
  value,
  options,
  onSelect,
  onCreate,
  onCopy,
  createDisabled = false,
  copyDisabled = false,
  selectDisabled = false,
  onDelete,
  deleteDisabled = false,
  copyTitle,
}: ActionSelectProps) {
  const selectPaddingClass = onDelete
    ? onCopy
      ? '!pr-24'
      : '!pr-16'
    : onCopy
      ? '!pr-16'
      : '!pr-14';
  const actionButtonClass =
    'inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <label
      data-design-system-component="true"
      data-design-system-component-name="ActionSelect"
      className="grid gap-2"
    >
      <FieldLabel>{title}</FieldLabel>
      <div className="relative min-w-0">
        <select
          value={value}
          onChange={(event) => onSelect(event.target.value)}
          disabled={selectDisabled}
          className={`${quietControlClass} min-w-0 w-full ${selectPaddingClass}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              disabled={copyDisabled}
              className={actionButtonClass}
              aria-label={copyTitle}
              title={copyTitle}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCreate}
            disabled={createDisabled}
            className={actionButtonClass}
            aria-label={`Create ${title}`}
            title={`Create ${title}`}
          >
            +
          </button>
          {onDelete ? (
            <button
              type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className={actionButtonClass}
            aria-label={`Delete ${title}`}
            title={`Delete ${title}`}
          >
            ×
          </button>
          ) : null}
        </div>
      </div>
    </label>
  );
}
