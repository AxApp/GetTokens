import type { SegmentedOption } from '../../types';

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex w-full max-w-sm border-2 border-[var(--border-color)]">
      {options.map((option, index) => (
        <button
          type="button"
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`relative flex min-h-[var(--gt-control-segmented-min-height,34px)] flex-1 items-center justify-center px-[var(--gt-control-segmented-padding-inline,10px)] text-[length:var(--gt-control-segmented-font-size,9px)] font-black italic leading-none transition-all ${
            index !== options.length - 1 ? 'border-r-2 border-[var(--border-color)]' : ''
          } ${
            value === option.id
              ? 'bg-[var(--border-color)] text-[var(--bg-main)]'
              : 'text-[var(--text-primary)] hover:bg-[var(--bg-main)]/50'
          }`}
        >
          {option.label}
          {value === option.id ? (
            <div className="absolute bottom-0 left-0 right-0 h-[var(--gt-control-segmented-indicator-height,3px)] bg-[var(--bg-main)]/20"></div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
