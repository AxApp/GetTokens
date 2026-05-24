import type { CSSProperties } from 'react';
import type { SegmentedOption } from '../../types';

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T | '';
  disabled?: boolean;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  disabled = false,
  onChange,
}: SegmentedControlProps<T>) {
  const selectedIndex = options.findIndex((option) => option.id === value);
  const segmentCount = Math.max(options.length, 1);
  const indicatorStyle: CSSProperties = {
    width: `calc(100% / ${segmentCount})`,
    opacity: selectedIndex >= 0 ? 1 : 0,
    transform: `translateX(${Math.max(selectedIndex, 0) * 100}%)`,
  };

  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="SegmentedControl"
      className={`relative flex w-full max-w-sm overflow-hidden border-[1px] border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[var(--bg-main)] ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      {options.map((option, index) => (
        <button
          type="button"
          key={option.id}
          aria-pressed={value === option.id}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={`relative flex min-h-[var(--gt-control-segmented-min-height,34px)] flex-1 items-center justify-center px-[var(--gt-control-segmented-padding-inline,10px)] text-[length:var(--gt-control-segmented-font-size,9px)] font-bold leading-none transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--border-color)] disabled:cursor-not-allowed ${
            index !== options.length - 1 ? 'border-r-[1px] border-[color:color-mix(in_srgb,var(--border-color)_35%,transparent)]' : ''
          } ${
            value === option.id
              ? 'bg-[color-mix(in_srgb,var(--border-color)_8%,transparent)] text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--border-color)_5%,transparent)] hover:text-[var(--text-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[var(--gt-control-segmented-indicator-height,2px)] bg-[color-mix(in_srgb,var(--border-color)_72%,transparent)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={indicatorStyle}
      />
    </div>
  );
}
