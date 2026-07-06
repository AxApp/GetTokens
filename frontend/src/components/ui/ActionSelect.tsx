import { Button, Select } from 'antd';
import { Copy } from 'lucide-react';
import { FieldLabel } from './FormField';

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
  const actionButtonClass =
    'inline-flex h-6 w-6 items-center justify-center !border-[var(--gt-border-subtle)] !bg-[var(--gt-surface-raised)] !text-[length:var(--gt-font-size-xs)] !font-normal !text-[var(--gt-ink-primary)] transition-colors hover:!border-[var(--gt-border-strong)] hover:!bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <label
      className="grid gap-2"
    >
      <FieldLabel>{title}</FieldLabel>
      <div className="relative min-w-0">
        <Select
          value={value}
          onChange={onSelect}
          disabled={selectDisabled}
          options={options.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          className="w-full"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {onCopy ? (
            <Button
              type="text"
              size="small"
              onClick={onCopy}
              disabled={copyDisabled}
              className={actionButtonClass}
              aria-label={copyTitle}
              title={copyTitle}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="text"
            size="small"
            onClick={onCreate}
            disabled={createDisabled}
            className={actionButtonClass}
            aria-label={`Create ${title}`}
            title={`Create ${title}`}
          >
            +
          </Button>
          {onDelete ? (
            <Button
              type="text"
              size="small"
              onClick={onDelete}
              disabled={deleteDisabled}
              className={actionButtonClass}
              aria-label={`Delete ${title}`}
              title={`Delete ${title}`}
            >
              ×
            </Button>
          ) : null}
        </div>
      </div>
    </label>
  );
}
