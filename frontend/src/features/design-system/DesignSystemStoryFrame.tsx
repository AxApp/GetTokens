import type { ReactNode } from 'react';

interface DesignSystemStoryFrameProps {
  children: ReactNode;
  label?: string;
}

export default function DesignSystemStoryFrame({ children }: DesignSystemStoryFrameProps) {
  return (
    <div data-design-system-component="true" className="min-w-0">
      {children}
    </div>
  );
}
