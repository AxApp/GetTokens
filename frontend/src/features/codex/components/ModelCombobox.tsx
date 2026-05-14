import { Combobox } from '../../../components/ui/Combobox.tsx';

export function ModelCombobox({
  value,
  options,
  placeholder,
  align = 'left',
  onChange,
}: {
  value: string;
  options: string[];
  placeholder: string;
  align?: 'left' | 'right';
  onChange: (value: string) => void;
}) {
  return (
    <Combobox
      value={value}
      options={options}
      placeholder={placeholder}
      align={align}
      maxOptions={8}
      onChange={onChange}
    />
  );
}
