import type { ReactNode } from 'react';

interface SnippetPreProps {
  children: ReactNode;
  className?: string;
}

export default function SnippetPre({
  children,
  className = '',
}: SnippetPreProps) {
  return (
    <pre
      data-design-system-component="true"
      data-design-system-component-name="SnippetPre"
      className={`overflow-x-auto rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4 text-xs font-medium leading-6 text-[var(--gt-ink-primary)] ${className}`}
    >
      {children}
    </pre>
  );
}
