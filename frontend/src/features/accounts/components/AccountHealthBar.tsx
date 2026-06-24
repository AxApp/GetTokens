import { useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { resolveResponsiveStatusBarData, type AccountUsageSummary } from '../model/accountUsage';

interface AccountHealthBarProps {
  summary: AccountUsageSummary;
}

function blockClass(block: AccountUsageSummary['statusBar']['blocks'][number]) {
  switch (block) {
    case 'success':
      return 'bg-[var(--gt-status-success)]';
    case 'failure':
      return 'bg-[var(--gt-status-danger)]';
    case 'mixed':
      return 'bg-[var(--gt-status-warning)]';
    default:
      return 'bg-[var(--gt-border-default)] opacity-40';
  }
}

export default function AccountHealthBar({ summary }: AccountHealthBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const statusBar = useMemo(
    () => resolveResponsiveStatusBarData(summary.statusBar, containerWidth),
    [containerWidth, summary.statusBar]
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = (width: number) => {
      setContainerWidth((previous) => {
        const roundedWidth = Math.round(width);
        return previous === roundedWidth ? previous : roundedWidth;
      });
    };

    updateWidth(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="grid min-w-0 items-center gap-1.5"
      style={{ gridTemplateColumns: `repeat(${statusBar.blocks.length}, minmax(2px, 1fr))` }}
    >
      {statusBar.blocks.map((block, index) => {
        const detail = statusBar.blockDetails[index];
        const title =
          detail.rate < 0
            ? 'No recent requests'
            : `${Math.round(detail.rate * 100)}% · ${detail.success}/${detail.failure}`;

        return (
          <Tooltip key={`${block}-${index}`} title={title}>
          <span
            className={`h-3 min-w-0 rounded-sm border border-[var(--gt-surface-raised)] ${blockClass(block)}`}
          />
          </Tooltip>
        );
      })}
    </div>
  );
}
