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
      className="text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--gt-ink-muted)]"
    >
      {children}
    </span>
  );
}

const quietControlClass =
  'h-9 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1.5 text-[length:var(--font-size-ui-sm)] font-medium text-[var(--gt-ink-primary)] outline-none transition-colors placeholder:text-[var(--gt-ink-muted)] hover:border-[var(--gt-border-strong)] focus:border-[var(--gt-ink-muted)] disabled:cursor-not-allowed disabled:bg-[var(--gt-surface-muted)] disabled:text-[var(--gt-ink-muted)]';

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
        className={`${quietControlClass} w-full ${className}`}
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
      <input {...inputProps} className={`${quietControlClass} w-full ${className}`} />
    </FormField>
  );
}

export { quietControlClass };
