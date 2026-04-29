import type { AccountUsageSummary } from '../model/accountUsage';

interface AccountHealthBarProps {
  summary: AccountUsageSummary;
}

function blockClass(block: AccountUsageSummary['statusBar']['blocks'][number]) {
  switch (block) {
    case 'success':
      return 'bg-green-600';
    case 'failure':
      return 'bg-red-500';
    case 'mixed':
      return 'bg-yellow-500';
    default:
      return 'bg-[var(--border-color)] opacity-40';
  }
}

export default function AccountHealthBar({ summary }: AccountHealthBarProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {summary.statusBar.blocks.map((block, index) => {
        const detail = summary.statusBar.blockDetails[index];
        const title =
          detail.rate < 0
            ? 'No recent requests'
            : `${Math.round(detail.rate * 100)}% · ${detail.success}/${detail.failure}`;

        return (
          <span
            key={`${block}-${index}`}
            title={title}
            className={`h-4 min-w-0 flex-1 border border-[var(--bg-main)] ${blockClass(block)}`}
          />
        );
      })}
    </div>
  );
}
