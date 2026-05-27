import { RefreshCw } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type RefreshActionButtonSize = 'sm' | 'md';

interface RefreshActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  iconOnly?: boolean;
  size?: RefreshActionButtonSize;
  iconStrokeWidth?: number;
}

const sizeClassNames: Record<RefreshActionButtonSize, string> = {
  sm: '!px-2 !py-1 !text-[length:var(--font-size-ui-xs)]',
  md: '!px-3 !py-2 !text-[length:var(--font-size-ui-sm)]',
};

export default function RefreshActionButton({
  label,
  loading = false,
  loadingLabel,
  fullWidth = false,
  iconOnly = false,
  size = 'md',
  iconStrokeWidth = 3,
  className = '',
  title,
  disabled,
  type = 'button',
  'aria-label': ariaLabel,
  ...buttonProps
}: RefreshActionButtonProps) {
  const displayLabel = loading ? (loadingLabel || label) : label;
  const resolvedLabel = ariaLabel || displayLabel;

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      aria-label={resolvedLabel}
      title={title || resolvedLabel}
      className={`btn-swiss inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${sizeClassNames[size]} ${
        fullWidth ? 'w-full' : 'w-auto shrink-0'
      } ${iconOnly ? 'h-10 w-10 !px-0 !py-0' : ''} ${className}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} strokeWidth={iconStrokeWidth} />
      {iconOnly ? null : <span className="min-w-0 truncate">{displayLabel}</span>}
    </button>
  );
}
