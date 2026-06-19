import { type MouseEvent } from 'react';

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  stopPropagation?: boolean;
  onChange: (checked: boolean) => void;
}

export default function ToggleSwitch({
  label,
  checked,
  disabled = false,
  className = '',
  stopPropagation = false,
  onChange,
}: ToggleSwitchProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) {
      event.stopPropagation();
    }
    onChange(!checked);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      title={label}
      data-design-system-component="true"
      data-design-system-component-name="ToggleSwitch"
      className={`flex min-h-[2.25rem] items-center justify-center transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span
        className={`relative h-7 w-14 shrink-0 overflow-hidden border border-[var(--gt-border-default)] transition-colors duration-200 ease-out rounded-full ${
          checked ? 'bg-[var(--gt-status-success)]' : 'bg-[var(--gt-surface-muted)]'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 border border-[var(--gt-border-default)] transition-transform duration-200 ease-out rounded-full ${
            checked ? 'translate-x-7 bg-[var(--gt-surface-raised)]' : 'translate-x-0 bg-[var(--gt-ink-muted)]'
          }`}
        />
      </span>
    </button>
  );
}
