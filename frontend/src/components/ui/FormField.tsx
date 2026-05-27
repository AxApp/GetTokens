import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FormFieldProps {
  title: string;
  children: ReactNode;
  as?: 'label' | 'div';
  className?: string;
}

export default function FormField({
  title,
  children,
  as = 'label',
  className = '',
}: FormFieldProps) {
  const content = (
    <>
      <FieldLabel>{title}</FieldLabel>
      {children}
    </>
  );

  const fieldClassName = `grid gap-2 ${className}`;

  if (as === 'div') {
    return (
      <div
        data-design-system-component="true"
        data-design-system-component-name="FormField"
        className={fieldClassName}
      >
        {content}
      </div>
    );
  }

  return (
    <label
      data-design-system-component="true"
      data-design-system-component-name="FormField"
      className={fieldClassName}
    >
      {content}
    </label>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      data-design-system-component="true"
      data-design-system-component-name="FieldLabel"
      className="text-[length:var(--font-size-ui-xs)] font-black tracking-[0.18em] text-[var(--text-muted)]"
    >
      {children}
    </span>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'onChange'> {
  title: string;
  options: readonly FormFieldOption[];
  onChange: (value: string) => void;
  fieldClassName?: string;
}

export function SelectField({
  title,
  options,
  onChange,
  fieldClassName = '',
  className = '',
  ...selectProps
}: SelectFieldProps) {
  return (
    <FormField title={title} className={fieldClassName}>
      <select
        {...selectProps}
        onChange={(event) => onChange(event.target.value)}
        className={`select-swiss w-full ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

interface TextInputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  title: string;
  fieldClassName?: string;
}

export function TextInputField({
  title,
  fieldClassName = '',
  className = '',
  ...inputProps
}: TextInputFieldProps) {
  return (
    <FormField title={title} className={fieldClassName}>
      <input {...inputProps} className={`input-swiss w-full ${className}`} />
    </FormField>
  );
}
