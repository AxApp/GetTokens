import { type ReactNode } from 'react';
import {
  formatUsageDeskChartValue,
  usageDeskSessionDrilldownColumnLabels,
  type UsageDeskProjectedSessionUsage,
} from '../../model/usageDesk';

export function StatePanel({ title, body, tone = 'default' }: { title: string; body: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div
      className={`border-2 px-4 py-4 ${
        tone === 'error'
          ? 'border-red-500 bg-red-500/10 text-red-500'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
      }`}
    >
      <div className="text-[0.625rem] font-black uppercase tracking-[0.18em]">{title}</div>
      <div className={`mt-2 text-[0.6875rem] leading-6 ${tone === 'error' ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>{body}</div>
    </div>
  );
}

export function InfoCard({ title, highlight, body }: { title: string; highlight: string; body: string }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-4 shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-3 text-[1.375rem] font-black uppercase italic tracking-tight text-[var(--text-primary)]">{highlight}</div>
      <p className="mt-3 text-[0.6875rem] leading-6 text-[var(--text-muted)]">{body}</p>
    </div>
  );
}

export function UsageSessionDrilldownPanel({
  title,
  rows,
  embedded = false,
}: {
  title: string;
  rows: UsageDeskProjectedSessionUsage[];
  embedded?: boolean;
}) {
  return (
    <section className={`${embedded ? 'flex h-[280px] flex-col overflow-hidden' : 'border-2 border-[var(--border-color)]'} bg-[var(--bg-main)]`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-[var(--border-color)] px-4 py-3">
        <div>
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">LOCAL SESSIONS</div>
          <h3 className="mt-1 text-[0.9375rem] font-black uppercase text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[0.6875rem] font-black text-[var(--text-primary)]">
          {new Intl.NumberFormat('zh-CN').format(rows.length)} 个会话
        </div>
      </div>

      {rows.length > 0 ? (
        <div className={`${embedded ? 'flex-1 overflow-auto' : 'overflow-x-auto'}`}>
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)]">
                {usageDeskSessionDrilldownColumnLabels.map((label) => (
                  <th
                    key={label}
                    className="sticky top-0 z-10 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-left text-[0.5625rem] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sourceLabel = buildSessionSourceLabel(row.projectName);
                return (
                  <tr key={row.sessionID} className="border-t border-dashed border-[var(--border-color)] first:border-t-0">
                    <td className="max-w-[300px] px-3 py-1.5 text-[0.6875rem] leading-4 text-[var(--text-primary)]" title={row.sessionID}>
                      <div className="truncate font-black">{sourceLabel}</div>
                    </td>
                    <SessionUsageCell value={row.model || '--'} />
                    <SessionUsageCell value={formatUsageDeskChartValue(row.requests, 'count')} />
                    <SessionUsageCell value={formatUsageDeskChartValue(row.totalTokens, 'tokens')} />
                    <SessionUsageCell value={formatUsageDeskChartValue(row.inputTokens, 'tokens')} />
                    <SessionUsageCell value={formatUsageDeskChartValue(row.cachedInputTokens, 'tokens')} />
                    <SessionUsageCell value={formatUsageDeskChartValue(row.outputTokens, 'tokens')} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-[0.6875rem] font-bold leading-6 text-[var(--text-muted)]">
          当前用量没有可关联会话。
        </div>
      )}
    </section>
  );
}

function SessionUsageCell({ value }: { value: string }) {
  return (
    <td className="px-3 py-1.5 text-[0.6875rem] font-black leading-4 text-[var(--text-primary)]">
      <div className="truncate">{value}</div>
    </td>
  );
}

function buildSessionSourceLabel(projectName: string) {
  return projectName.trim() || '未知项目';
}
