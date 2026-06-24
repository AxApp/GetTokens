import { Input, Select } from 'antd';
import type { ReactNode } from 'react';

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
      className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]"
    >
      {children}
    </span>
  );
}

interface SelectFieldProps {
  title: string;
  options: readonly FormFieldOption[];
  onChange: (value: string) => void;
  fieldClassName?: string;
  className?: string;
  value?: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
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
      <Select
        {...selectProps}
        onChange={onChange}
        className={`w-full ${className}`}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
          disabled: option.disabled,
        }))}
      />
    </FormField>
  );
}

interface TextInputFieldProps {
  title: string;
  fieldClassName?: string;
  className?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  type?: string;
  inputMode?: 'email' | 'url' | 'text' | 'search' | 'none' | 'tel' | 'numeric' | 'decimal';
  'aria-label'?: string;
}

export function TextInputField({
  title,
  fieldClassName = '',
  className = '',
  onChange,
  ...inputProps
}: TextInputFieldProps & Record<string, unknown>) {
  return (
    <FormField title={title} className={fieldClassName}>
      <Input
        {...(inputProps as Record<string, unknown>)}
        onChange={onChange as React.ComponentProps<typeof Input>['onChange']}
        className={`w-full ${className}`}
      />
    </FormField>
  );
}
