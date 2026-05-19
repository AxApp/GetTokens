import type { ReactNode } from 'react';

interface DesignSystemStoryFrameProps {
  children: ReactNode;
  label?: string;
}

export default function DesignSystemStoryFrame({
  children,
  label = 'DS',
}: DesignSystemStoryFrameProps) {
  return (
    <div
      data-design-system-component="true"
      className="relative min-w-0 border-[3px] border-dashed border-[var(--accent-red)] bg-[var(--bg-surface)] p-3 shadow-[4px_4px_0_var(--shadow-color)]"
    >
      <div className="absolute right-1 top-1 border-2 border-[var(--accent-red)] bg-[var(--bg-main)] px-1.5 py-0.5 font-mono text-[0.5rem] font-black uppercase tracking-normal text-[var(--accent-red)]">
        {label}
      </div>
      <div className="min-w-0 pt-4">{children}</div>
    </div>
  );
}
