import { Button } from 'antd';
import { RefreshCw } from 'lucide-react';

type RefreshActionButtonSize = 'sm' | 'md';

interface RefreshActionButtonProps {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  iconOnly?: boolean;
  size?: RefreshActionButtonSize;
  iconStrokeWidth?: number;
  className?: string;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const sizeMap: Record<RefreshActionButtonSize, 'small' | 'middle'> = {
  sm: 'small',
  md: 'middle',
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
  'aria-label': ariaLabel,
  onClick,
}: RefreshActionButtonProps) {
  const displayLabel = loading ? (loadingLabel || label) : label;
  const resolvedLabel = ariaLabel || displayLabel;

  return (
    <Button
      htmlType="button"
      disabled={disabled}
      loading={loading}
      aria-label={resolvedLabel}
      title={title || resolvedLabel}
      size={sizeMap[size]}
      onClick={onClick}
      className={`inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50 ${
        fullWidth ? 'w-full' : 'w-auto shrink-0'
      } ${iconOnly ? 'h-10 w-10 !px-0 !py-0' : ''} ${className}`}
    >
      {!loading && <RefreshCw className="h-3.5 w-3.5 shrink-0" strokeWidth={iconStrokeWidth} />}
      {iconOnly ? null : <span className="min-w-0 truncate">{displayLabel}</span>}
    </Button>
  );
}
