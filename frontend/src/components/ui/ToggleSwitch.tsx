import { Switch } from 'antd';

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
  function handleChange(checked: boolean, event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) {
    if (stopPropagation) {
      event.stopPropagation();
    }
    onChange(checked);
  }
  const switchClassName = ['gt-toggle-switch', className].filter(Boolean).join(' ');

  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onChange={handleChange}
      aria-label={label}
      title={label}
      data-design-system-component="true"
      data-design-system-component-name="ToggleSwitch"
      className={switchClassName}
    />
  );
}
