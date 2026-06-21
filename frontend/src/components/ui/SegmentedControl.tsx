import type { CSSProperties } from 'react';
import type { SegmentedOption } from '../../types';

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T | '';
  disabled?: boolean;
  fitContent?: boolean;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  disabled = false,
  fitContent = false,
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
      className={`relative ${fitContent ? 'inline-flex w-auto max-w-none' : 'flex w-full max-w-sm'} overflow-hidden border border-[color:color-mix(in_srgb,var(--gt-border-default)_55%,transparent)] bg-[var(--gt-surface-canvas)] ${
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
          className={`relative flex min-h-[var(--gt-control-segmented-min-height,34px)] ${fitContent ? 'flex-none whitespace-nowrap' : 'flex-1'} items-center justify-center px-[var(--gt-control-segmented-padding-inline,10px)] text-[length:var(--gt-control-segmented-font-size,9px)] font-semibold leading-none transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--gt-focus-ring)] disabled:cursor-not-allowed ${
            index !== options.length - 1 ? 'border-r border-[color:color-mix(in_srgb,var(--gt-border-default)_35%,transparent)]' : ''
          } ${
            value === option.id
              ? 'bg-[color-mix(in_srgb,var(--gt-accent-primary)_8%,transparent)] text-[var(--gt-ink-primary)]'
              : 'text-[var(--gt-ink-muted)] hover:bg-[color-mix(in_srgb,var(--gt-border-default)_5%,transparent)] hover:text-[var(--gt-ink-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-[var(--gt-control-segmented-indicator-height,2px)] bg-[color-mix(in_srgb,var(--gt-accent-primary)_72%,transparent)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={indicatorStyle}
      />
    </div>
  );
}
