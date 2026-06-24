import { AutoComplete } from 'antd';
import { useEffect, useMemo, useState } from 'react';

export interface ComboboxProps {
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  maxOptions?: number;
  className?: string;
  onChange: (value: string) => void;
}

export function Combobox({
  value,
  options,
  placeholder = '',
  disabled = false,
  align = 'left',
  maxOptions,
  className = '',
  onChange,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const normalizedValue = inputValue.trim().toLowerCase();

  const visibleOptions = useMemo(() => {
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const option of options) {
      const name = String(option ?? '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      if (normalizedValue && !key.includes(normalizedValue)) continue;
      seen.add(key);
      filtered.push(name);
      if (maxOptions !== undefined && filtered.length >= maxOptions) break;
    }
    return filtered;
  }, [normalizedValue, options, maxOptions]);

  const antdOptions = visibleOptions.map((option) => ({
    value: option,
    label: option,
  }));

  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="Combobox"
      className={className}
    >
      <AutoComplete
        value={inputValue}
        options={antdOptions}
        placeholder={placeholder}
        disabled={disabled}
        className={align === 'right' ? 'text-right' : undefined}
        onSearch={(text) => {
          setInputValue(text);
          onChange(text);
          setOpen(true);
        }}
        onChange={(text) => {
          setInputValue(text);
          onChange(text);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        open={open && antdOptions.length > 0}
        filterOption={false}
      />
    </div>
  );
}
