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
        className={`relative h-7 w-14 shrink-0 overflow-hidden border-2 border-[var(--border-color)] transition-colors duration-200 ease-out ${
          checked ? 'bg-green-600' : 'bg-[var(--bg-surface)]'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 border-2 border-[var(--border-color)] transition-transform duration-200 ease-out ${
            checked ? 'translate-x-7 bg-[var(--bg-main)]' : 'translate-x-0 bg-[var(--text-primary)]'
          }`}
        />
      </span>
    </button>
  );
}
