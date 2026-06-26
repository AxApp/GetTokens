import type { ReactNode } from 'react';
import type { CodexFeatureRow, CodexFeatureRowPathDisplay } from '../model/codexFeatureConfig';
import { resolveCodexFeatureRowPathDisplay } from '../model/codexFeatureConfig';
import { renderCodexValueEditor } from '../model/codexValueEditor';

type CodexPathParentMode = 'section' | 'hidden';

interface CodexPathGroupedRow {
  row: CodexFeatureRow;
  pathDisplay: CodexFeatureRowPathDisplay;
}

interface CodexPathGroup {
  id: string;
  primaryLabel: string;
  rows: CodexPathGroupedRow[];
}

interface StatusCodexConfigRowsProps {
  rows: CodexFeatureRow[];
  badgeLabel: string;
  isBusy: boolean;
  parentMode: CodexPathParentMode;
  resolveDescription: (row: CodexFeatureRow) => ReactNode;
  onChangeSetting: (id: string, value: unknown) => void;
  onRemoveSetting?: (id: string) => void;
}

const codexConfigRowsChipClass =
  'inline-flex shrink-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';

function groupRowsByPrimaryPath(rows: CodexFeatureRow[]): CodexPathGroup[] {
  const groups: CodexPathGroup[] = [];
  const groupsByPrimaryLabel = new Map<string, CodexPathGroup>();

  for (const row of rows) {
    const pathDisplay = resolveCodexFeatureRowPathDisplay(row);
    const groupID = pathDisplay.primaryLabel;
    let group = groupsByPrimaryLabel.get(groupID);
    if (!group) {
      group = { id: groupID, primaryLabel: pathDisplay.primaryLabel, rows: [] };
      groupsByPrimaryLabel.set(groupID, group);
      groups.push(group);
    }
    group.rows.push({ row, pathDisplay });
  }

  return groups;
}

function resolveRowPathLabels(pathDisplay: CodexFeatureRowPathDisplay, nested: boolean) {
  if (nested && pathDisplay.childLabels.length > 0) {
    return pathDisplay.childLabels;
  }
  return [pathDisplay.primaryLabel, ...pathDisplay.childLabels];
}

export default function StatusCodexConfigRows({
  rows,
  badgeLabel,
  isBusy,
  parentMode,
  resolveDescription,
  onChangeSetting,
  onRemoveSetting,
}: StatusCodexConfigRowsProps) {
  const pathGroups = groupRowsByPrimaryPath(rows);

  function renderRow({ row, pathDisplay }: CodexPathGroupedRow, nested: boolean) {
    const pathLabels = resolveRowPathLabels(pathDisplay, nested);

    return (
      <div
        key={row.id}
        data-codex-config-table-row={row.id}
        className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] md:items-center"
      >
        <div className={`min-w-0 select-text ${nested ? 'pl-3' : ''}`}>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
            {pathLabels.map((label, index) => (
              <span key={`${pathDisplay.fullLabel}-${index}`} className="inline-flex min-w-0 items-center gap-1">
                {index > 0 ? <span className="text-[var(--gt-ink-muted)]">/</span> : null}
                <span className="min-w-0 break-all">{label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 w-full justify-start md:justify-end">
          <div className="w-full">
            {renderCodexValueEditor(row, row.readOnly || isBusy, onChangeSetting, onRemoveSetting)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-codex-config-table="settings" className="divide-y divide-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]">
      {pathGroups.map((pathGroup) => {
        const hasNestedRows = pathGroup.rows.some(({ pathDisplay }) => pathDisplay.childLabels.length > 0);
        if (!hasNestedRows) {
          return pathGroup.rows.map((groupedRow) => renderRow(groupedRow, false));
        }

        return (
          <div key={pathGroup.id}>
            {parentMode === 'section' ? (
              <div
                data-codex-path-primary-heading={pathGroup.primaryLabel}
                className="border-b border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-2 font-mono text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]"
              >
                {pathGroup.primaryLabel}
              </div>
            ) : null}
            <div className="divide-y divide-[var(--gt-border-subtle)]">
              {pathGroup.rows.map((groupedRow) => renderRow(groupedRow, true))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
