import { Search } from 'lucide-react';
import { Input } from 'antd';

interface SearchInputProps {
  className?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  'aria-label'?: string;
  /** @deprecated AntD Input allowClear handles this automatically */
  clearLabel?: string;
}

export default function SearchInput({
  'aria-label': ariaLabel,
  className = '',
  disabled = false,
  onChange,
  placeholder,
  readOnly = false,
  value,
}: SearchInputProps) {
  return (
    <Input
      aria-label={ariaLabel || placeholder || 'Search'}
      allowClear
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      prefix={<Search size={14} strokeWidth={2.5} className="text-[var(--gt-ink-muted)]" />}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`!h-10 ${className}`}
    />
  );
}
