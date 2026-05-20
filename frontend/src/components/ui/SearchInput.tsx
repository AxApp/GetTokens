import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'onChange' | 'type' | 'value'> {
  clearLabel?: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
}

export default function SearchInput({
  'aria-label': ariaLabel,
  clearLabel = 'Clear search',
  className = '',
  disabled = false,
  onChange,
  placeholder,
  readOnly = false,
  value,
  ...inputProps
}: SearchInputProps) {
  const canClear = value.length > 0 && !disabled && !readOnly;

  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="SearchInput"
      className={`group relative flex min-h-10 w-full min-w-0 items-center overflow-hidden border-[1px] border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[var(--bg-main)] transition-colors focus-within:border-[var(--border-color)] ${className}`}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--text-primary)]"
        strokeWidth={2.5}
        aria-hidden="true"
      />
      <input
        {...inputProps}
        aria-label={ariaLabel || placeholder || 'Search'}
        disabled={disabled}
        inputMode="search"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        type="search"
        value={value}
        className="min-h-10 w-full min-w-0 bg-transparent py-2 pl-9 pr-10 font-mono text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/60 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {canClear ? (
        <button
          type="button"
          aria-label={clearLabel}
          title={clearLabel}
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border-color)] hover:text-[var(--text-primary)] active:scale-95"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}
