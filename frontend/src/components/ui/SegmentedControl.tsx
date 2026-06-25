import { Segmented } from 'antd';
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
  fitContent = true,
  onChange,
}: SegmentedControlProps<T>) {
  const antdOptions = options.map((option) => ({
    label: option.label,
    value: option.id,
  }));

  return (
    <Segmented
      data-design-system-component="true"
      data-design-system-component-name="SegmentedControl"
      className="border border-[var(--gt-border-subtle)]"
      options={antdOptions}
      value={value || undefined}
      disabled={disabled}
      block={!fitContent}
      onChange={(val) => onChange(val as T)}
    />
  );
}
