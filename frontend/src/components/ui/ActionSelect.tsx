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
  createDisabled?: boolean;
  selectDisabled?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}

export default function ActionSelect({
  title,
  value,
  options,
  onSelect,
  onCreate,
  createDisabled = false,
  selectDisabled = false,
  onDelete,
  deleteDisabled = false,
}: ActionSelectProps) {
  return (
    <label className="grid gap-2">
      <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </span>
      <div className="relative min-w-0">
        <select
          value={value}
          onChange={(event) => onSelect(event.target.value)}
          disabled={selectDisabled}
          className={`select-swiss min-w-0 w-full ${onDelete ? '!pr-24' : '!pr-14'}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={onCreate}
            disabled={createDisabled}
            className="btn-swiss !px-2 !py-0.5 !text-[0.5625rem] disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteDisabled}
              className="btn-swiss !px-2 !py-0.5 !text-[0.5625rem] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </label>
  );
}
