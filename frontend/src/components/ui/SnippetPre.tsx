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
      className={`overflow-x-auto bg-[var(--bg-surface)] p-4 text-xs font-bold leading-6 ${className}`}
    >
      {children}
    </pre>
  );
}
