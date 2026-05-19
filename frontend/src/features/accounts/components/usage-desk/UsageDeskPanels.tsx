import { type ReactNode } from 'react';
import {
  formatUsageDeskChartValue,
  usageDeskProjectDrilldownColumnLabels,
  usageDeskSessionDrilldownColumnLabels,
  type UsageDeskProjectedProjectUsage,
  type UsageDeskProjectedSessionUsage,
} from '../../model/usageDesk';

export function StatePanel({ title, body, tone = 'default' }: { title: string; body: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div
      className={`border-2 px-4 py-4 ${
        tone === 'error'
          ? 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
      }`}
    >
      <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em]">{title}</div>
      <div className={`mt-2 text-[length:var(--font-size-ui-md-compact)] leading-6 ${tone === 'error' ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'}`}>{body}</div>
    </div>
  );
}

export function InfoCard({ title, highlight, body }: { title: string; highlight: string; body: string }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-4 shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-3 text-[length:var(--font-size-ui-4xl)] font-black uppercase italic tracking-tight text-[var(--text-primary)]">{highlight}</div>
      <p className="mt-3 text-[length:var(--font-size-ui-md-compact)] leading-6 text-[var(--text-muted)]">{body}</p>
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
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">LOCAL SESSIONS</div>
          <h3 className="mt-1 text-[length:var(--font-size-ui-xl)] font-black uppercase text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
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
                    className="sticky top-0 z-10 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-left text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
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
                    <td className="max-w-[300px] px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] leading-4 text-[var(--text-primary)]" title={row.sessionID}>
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
        <div className="px-4 py-5 text-[length:var(--font-size-ui-md-compact)] font-bold leading-6 text-[var(--text-muted)]">
          当前用量没有可关联会话。
        </div>
      )}
    </section>
  );
}

export function UsageProjectDrilldownPanel({
  title,
  rows,
  embedded = false,
}: {
  title: string;
  rows: UsageDeskProjectedProjectUsage[];
  embedded?: boolean;
}) {
  return (
    <section className={`${embedded ? 'flex h-[280px] flex-col overflow-hidden' : 'border-2 border-[var(--border-color)]'} bg-[var(--bg-main)]`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-[var(--border-color)] px-4 py-3">
        <div>
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">PROJECT TOTALS</div>
          <h3 className="mt-1 text-[length:var(--font-size-ui-xl)] font-black uppercase text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
          {new Intl.NumberFormat('zh-CN').format(rows.length)} 个项目
        </div>
      </div>

      {rows.length > 0 ? (
        <div className={`${embedded ? 'flex-1 overflow-auto' : 'overflow-x-auto'}`}>
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="bg-[var(--bg-surface)]">
                {usageDeskProjectDrilldownColumnLabels.map((label) => (
                  <th
                    key={label}
                    className="sticky top-0 z-10 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-left text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => (
                <tr key={project.projectName} className="border-t border-dashed border-[var(--border-color)] first:border-t-0">
                  <td className="max-w-[300px] px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black leading-4 text-[var(--text-primary)]">
                    <div className="truncate">{project.projectName}</div>
                  </td>
                  <ProjectUsageCell value={formatUsageDeskChartValue(project.sessions, 'count').replace('次', '个')} />
                  <ProjectUsageCell value={project.model || '--'} />
                  <ProjectUsageCell value={formatUsageDeskChartValue(project.requests, 'count')} />
                  <ProjectUsageCell value={formatUsageDeskChartValue(project.totalTokens, 'tokens')} />
                  <ProjectUsageCell value={formatUsageDeskChartValue(project.inputTokens, 'tokens')} />
                  <ProjectUsageCell value={formatUsageDeskChartValue(project.cachedInputTokens, 'tokens')} />
                  <ProjectUsageCell value={formatUsageDeskChartValue(project.outputTokens, 'tokens')} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-[length:var(--font-size-ui-md-compact)] font-bold leading-6 text-[var(--text-muted)]">
          当前用量没有可聚合项目。
        </div>
      )}
    </section>
  );
}

function SessionUsageCell({ value }: { value: string }) {
  return (
    <td className="px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black leading-4 text-[var(--text-primary)]">
      <div className="truncate">{value}</div>
    </td>
  );
}

function ProjectUsageCell({ value }: { value: string }) {
  return (
    <td className="px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-black leading-4 text-[var(--text-primary)]">
      <div className="truncate">{value}</div>
    </td>
  );
}

function buildSessionSourceLabel(projectName: string) {
  return projectName.trim() || '未知项目';
}
