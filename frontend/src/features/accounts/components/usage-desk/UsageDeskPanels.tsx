import { type ReactNode } from 'react';
import {
  formatUsageDeskChartValue,
  usageDeskProjectDrilldownColumnLabels,
  usageDeskSessionDrilldownColumnLabels,
  type UsageDeskProjectedProjectUsage,
  type UsageDeskProjectedSessionUsage,
  type UsageDeskStatusEvidence,
} from '../../model/usageDesk';

const usageDeskPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const usageDeskMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const usageDeskMetaClass = 'text-[length:var(--font-size-ui-xs)] font-medium tracking-normal text-[var(--text-muted)]';
const usageDeskStrongMetaClass = 'text-[length:var(--font-size-ui-sm)] font-semibold tracking-normal text-[var(--text-primary)]';
const usageDeskBadgeClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-medium tracking-normal text-[var(--text-muted)]';
const usageDeskCountBadgeClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1 text-[length:var(--font-size-ui-md-compact)] font-medium text-[var(--text-primary)]';
const usageDeskTableHeaderClass =
  'sticky top-0 z-10 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1.5 text-left text-[length:var(--font-size-ui-xs)] font-medium tracking-normal text-[var(--text-primary)]';
const usageDeskTableCellClass = 'px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-medium leading-4 text-[var(--text-primary)]';

export function StatePanel({ title, body, tone = 'default' }: { title: string; body: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div
      data-usage-desk-state-panel={tone}
      className={`px-4 py-4 ${
        tone === 'error'
          ? 'rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]'
          : `${usageDeskMutedPanelClass} text-[var(--text-primary)]`
      }`}
    >
      <div className="text-[length:var(--font-size-ui-sm)] font-semibold tracking-normal">{title}</div>
      <div className={`mt-2 text-[length:var(--font-size-ui-md-compact)] leading-6 ${tone === 'error' ? 'text-[var(--gt-status-danger)]' : 'text-[var(--text-muted)]'}`}>{body}</div>
    </div>
  );
}

export function InfoCard({ title, highlight, body }: { title: string; highlight: string; body: string }) {
  return (
    <div data-usage-desk-info-card="true" className={`${usageDeskPanelClass} px-4 py-4`}>
      <div className={usageDeskMetaClass}>{title}</div>
      <div className="mt-3 text-[length:var(--font-size-ui-4xl)] font-semibold tracking-normal text-[var(--text-primary)]">{highlight}</div>
      <p className="mt-3 text-[length:var(--font-size-ui-md-compact)] leading-6 text-[var(--text-muted)]">{body}</p>
    </div>
  );
}

export function UsageDeskEvidenceStatus({ evidence }: { evidence: UsageDeskStatusEvidence }) {
  if (!('view' in evidence)) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3" data-usage-desk-evidence-status="missing-quota-fact">
        <div className="min-w-0 flex-1">
          <div className={usageDeskMetaClass}>
            NON-AUTHORITATIVE
          </div>
          <div className={`mt-1 ${usageDeskStrongMetaClass}`}>
            {evidence.title}
          </div>
          <div className={`mt-1 ${usageDeskMetaClass}`}>
            {evidence.summary}
          </div>
          <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-muted)]">
            {evidence.description}
          </div>
        </div>
      </div>
    );
  }

  const metaItems = [
    evidence.view.stateLabel,
    evidence.view.sourceLabel,
    evidence.view.freshnessLabel,
    evidence.view.confidenceLabel,
    evidence.view.riskLabel,
  ];
  const evidenceRefsTitle = evidence.view.evidenceRefs.join('\n');

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3" data-usage-desk-evidence-status="quota-fact">
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-primary)]">
          {evidence.title}
        </div>
        <div className={`mt-1 ${usageDeskStrongMetaClass}`}>
          {evidence.summary}
        </div>
        {evidence.view.explanation ? (
          <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-muted)]">
            {evidence.view.explanation}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {metaItems.map((item) => (
          <span
            key={item}
            className={usageDeskBadgeClass}
          >
            {item}
          </span>
        ))}
        {evidence.view.evidenceRefs.length > 0 ? (
          <span
            title={evidenceRefsTitle}
            className={usageDeskBadgeClass}
          >
            refs {evidence.view.evidenceRefs.length}
          </span>
        ) : null}
      </div>
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
    <section data-usage-desk-session-drilldown="true" className={`${embedded ? 'flex h-[280px] flex-col overflow-hidden bg-[var(--gt-surface-canvas)]' : usageDeskPanelClass}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] px-4 py-3">
        <div>
          <div className={usageDeskMetaClass}>LOCAL SESSIONS</div>
          <h3 className="mt-1 text-[length:var(--font-size-ui-xl)] font-semibold tracking-normal text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className={usageDeskCountBadgeClass}>
          {new Intl.NumberFormat('zh-CN').format(rows.length)} 个会话
        </div>
      </div>

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
                  <tr key={row.sessionID} className="border-t border-dashed border-[var(--border-color)] first:border-t-0">
                    <td className="max-w-[300px] px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] leading-4 text-[var(--text-primary)]" title={row.sessionID}>
                      <div className="truncate font-medium">{sourceLabel}</div>
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
    <section data-usage-desk-project-drilldown="true" className={`${embedded ? 'flex h-[280px] flex-col overflow-hidden bg-[var(--gt-surface-canvas)]' : usageDeskPanelClass}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] px-4 py-3">
        <div>
          <div className={usageDeskMetaClass}>PROJECT TOTALS</div>
          <h3 className="mt-1 text-[length:var(--font-size-ui-xl)] font-semibold tracking-normal text-[var(--text-primary)]">{title}</h3>
        </div>
        <div className={usageDeskCountBadgeClass}>
          {new Intl.NumberFormat('zh-CN').format(rows.length)} 个项目
        </div>
      </div>

      {rows.length > 0 ? (
        <div className={`${embedded ? 'flex-1 overflow-auto' : 'overflow-x-auto'}`}>
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="bg-[var(--gt-surface-muted)]">
                {usageDeskProjectDrilldownColumnLabels.map((label) => (
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
              {rows.map((project) => (
                <tr key={project.projectName} className="border-t border-dashed border-[var(--border-color)] first:border-t-0">
                  <td className="max-w-[300px] px-3 py-1.5 text-[length:var(--font-size-ui-md-compact)] font-medium leading-4 text-[var(--text-primary)]">
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
