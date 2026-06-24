import { useMemo, useState, type ReactNode } from 'react';
import { Tooltip } from 'antd';
import {
  formatUsageDeskChartValue,
  usageDeskProjectDrilldownColumnLabels,
  usageDeskSessionDrilldownColumnLabels,
  type UsageDeskProjectedProjectUsage,
  type UsageDeskProjectedSessionUsage,
} from '../../model/usageDesk';

const usageDeskPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const usageDeskMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const usageDeskMetaClass = 'text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const usageDeskStrongMetaClass = 'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const usageDeskTableHeaderClass =
  'sticky top-0 z-10 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1.5 text-left text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-primary)]';
const usageDeskTableCellClass = 'px-3 py-1.5 text-[length:var(--gt-font-size-md-compact)] font-normal leading-4 text-[var(--gt-ink-primary)]';

export function StatePanel({ title, body, tone = 'default' }: { title: string; body: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div
      data-usage-desk-state-panel={tone}
      className={`px-4 py-4 ${
        tone === 'error'
          ? 'rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]'
          : `${usageDeskMutedPanelClass} text-[var(--gt-ink-primary)]`
      }`}
    >
      <div className="text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal">{title}</div>
      <div className={`mt-2 text-[length:var(--gt-font-size-md-compact)] leading-6 ${tone === 'error' ? 'text-[var(--gt-status-danger)]' : 'text-[var(--gt-ink-muted)]'}`}>{body}</div>
    </div>
  );
}

export function InfoCard({ title, highlight, body }: { title: string; highlight: string; body: string }) {
  return (
    <div data-usage-desk-info-card="true" className={`${usageDeskPanelClass} px-4 py-4`}>
      <div className={usageDeskMetaClass}>{title}</div>
      <div className="mt-3 text-[length:var(--gt-font-size-4xl)] font-semibold tracking-normal text-[var(--gt-ink-primary)]">{highlight}</div>
      <p className="mt-3 text-[length:var(--gt-font-size-md-compact)] leading-6 text-[var(--gt-ink-muted)]">{body}</p>
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
    <section data-usage-desk-session-drilldown="true" className={`${embedded ? 'flex h-[280px] flex-col overflow-hidden bg-[var(--gt-surface-canvas)]' : usageDeskPanelClass} relative z-10`}>
      {rows.length > 0 ? (
        <div className={`${embedded ? 'flex-1 overflow-auto' : 'overflow-x-auto'}`}>
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="bg-[var(--gt-surface-muted)]">
                {usageDeskSessionDrilldownColumnLabels.map((label) => (
                  <th
                    key={label}
                    className={usageDeskTableHeaderClass}
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
                  <tr key={row.sessionID} className="border-t border-dashed border-[var(--gt-border-strong)] first:border-t-0">
                    <td className="max-w-[300px] px-3 py-1.5 text-[length:var(--gt-font-size-md-compact)] leading-4 text-[var(--gt-ink-primary)]">
                      <Tooltip title={row.sessionID}>
                        <div className="truncate font-normal">{sourceLabel}</div>
                      </Tooltip>
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
        <div className="px-4 py-5 text-[length:var(--gt-font-size-md-compact)] font-semibold leading-6 text-[var(--gt-ink-muted)]">
          当前用量没有可关联会话。
        </div>
      )}
    </section>
  );
}

type ProjectSortKey = 'projectName' | 'sessions' | 'model' | 'requests' | 'totalTokens' | 'inputTokens' | 'cachedInputTokens' | 'outputTokens';

const projectSortKeys: ProjectSortKey[] = ['projectName', 'sessions', 'model', 'requests', 'totalTokens', 'inputTokens', 'cachedInputTokens', 'outputTokens'];

export function UsageProjectDrilldownPanel({
  title,
  rows,
  embedded = false,
}: {
  title: string;
  rows: UsageDeskProjectedProjectUsage[];
  embedded?: boolean;
}) {
  const [sortKey, setSortKey] = useState<ProjectSortKey>('totalTokens');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [rows, sortKey, sortAsc]);

  function handleSort(key: ProjectSortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <section data-usage-desk-project-drilldown="true" className={`${embedded ? 'flex h-[280px] flex-col overflow-hidden bg-[var(--gt-surface-canvas)]' : usageDeskPanelClass} relative z-10`}>
      {rows.length > 0 ? (
        <div className={`${embedded ? 'flex-1 overflow-auto' : 'overflow-x-auto'}`}>
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-[var(--gt-surface-muted)]">
                {usageDeskProjectDrilldownColumnLabels.map((label, index) => {
                  const key = projectSortKeys[index];
                  const isActive = sortKey === key;
                  return (
                    <th
                      key={label}
                      className={`${usageDeskTableHeaderClass} cursor-pointer select-none hover:bg-[var(--gt-surface-canvas)]`}
                      onClick={() => key && handleSort(key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {isActive && (
                          <span className="text-[var(--gt-ink-muted)]">
                            {sortAsc ? '↑' : '↓'}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((project) => (
                <tr key={project.projectName} className="border-t border-dashed border-[var(--gt-border-strong)] first:border-t-0">
                  <td className="max-w-none px-3 py-1.5 text-[length:var(--gt-font-size-md-compact)] font-normal leading-4 text-[var(--gt-ink-primary)]">
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
        <div className="px-4 py-5 text-[length:var(--gt-font-size-md-compact)] font-semibold leading-6 text-[var(--gt-ink-muted)]">
          当前用量没有可聚合项目。
        </div>
      )}
    </section>
  );
}

function SessionUsageCell({ value }: { value: string }) {
  return (
    <td className={usageDeskTableCellClass}>
      <div className="truncate">{value}</div>
    </td>
  );
}

function ProjectUsageCell({ value }: { value: string }) {
  return (
    <td className={usageDeskTableCellClass}>
      <div className="truncate">{value}</div>
    </td>
  );
}

function buildSessionSourceLabel(projectName: string) {
  return projectName.trim() || '未知项目';
}
