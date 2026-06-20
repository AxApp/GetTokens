import {
  resolveUsageDeskChartSelectionKey,
  type UsageDeskMinuteRow,
} from '../../model/usageDesk';

const usageDetailTableShellClass =
  'overflow-x-auto overflow-y-visible rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const usageDetailTableHeaderRowClass = 'bg-[var(--gt-surface-muted)]';
const usageDetailTableHeaderCellClass =
  'border-b border-[var(--gt-border-subtle)] px-3 py-3 text-left text-[length:var(--font-size-ui-sm)] font-medium tracking-normal text-[var(--gt-ink-primary)]';
const usageDetailTableRowClass =
  'cursor-pointer border-t border-[var(--gt-border-subtle)] transition-colors first:border-t-0 hover:bg-[var(--gt-surface-muted)]';
const usageDetailTableSelectedRowClass =
  'bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)] hover:bg-[var(--gt-ink-primary)]';
const usageDetailTableCellClass = 'px-3 py-3 text-[length:var(--font-size-ui-md-compact)] font-medium leading-6';

export type UsageDetailTableRow = UsageDeskMinuteRow & {
  drilldownDayKey?: string;
};

export type UsageDetailColumnKey =
  | 'timeLabel'
  | 'model'
  | 'value'
  | 'note'
  | 'requests'
  | 'inputTokens'
  | 'cachedInputTokens'
  | 'outputTokens';
export type UsageDetailColumn = { key: UsageDetailColumnKey; header: string };

export function buildUsageDetailRowKey(row: UsageDetailTableRow) {
  return [
    row.timeLabel,
    row.value,
    row.note ?? '',
    row.model ?? '',
    row.requests ?? '',
    row.inputTokens ?? '',
    row.cachedInputTokens ?? '',
    row.outputTokens ?? '',
  ].join('|');
}

export function resolveUsageDetailColumns(rows: UsageDetailTableRow[]): UsageDetailColumn[] {
  const hasProjectedBreakdown = rows.some(
    (row) =>
      row.requests !== undefined ||
      row.inputTokens !== undefined ||
      row.cachedInputTokens !== undefined ||
      row.outputTokens !== undefined,
  );
  const hasNote = rows.some((row) => row.note !== undefined && row.note !== '');

  return hasProjectedBreakdown
    ? [
        { key: 'timeLabel', header: '时间' },
        { key: 'model', header: '模型' },
        { key: 'requests', header: '请求数' },
        { key: 'value', header: 'Token' },
        { key: 'inputTokens', header: '输入' },
        { key: 'cachedInputTokens', header: '缓存' },
        { key: 'outputTokens', header: '输出' },
        ...(hasNote ? [{ key: 'note', header: '备注' } satisfies UsageDetailColumn] : []),
      ]
    : [
        { key: 'timeLabel', header: '时间' },
        { key: 'value', header: '数值' },
        { key: 'note', header: '备注' },
      ];
}

export function UsageDetailTable({
  rows,
  columns,
  selectedRowKey,
  onSelectRow,
}: {
  rows: UsageDetailTableRow[];
  columns: UsageDetailColumn[];
  selectedRowKey: string;
  onSelectRow: (rowKey: string, chartPointKey: string, drilldownDayKey?: string) => void;
}) {
  return (
    <div className={usageDetailTableShellClass} data-usage-detail-table="quiet">
      <table className="w-full border-collapse">
        <thead>
          <tr className={usageDetailTableHeaderRowClass}>
            {columns.map((column) => (
              <th key={column.key} className={usageDetailTableHeaderCellClass}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <UsageDetailRow
              key={`${row.timeLabel}-${row.provider}-${index}`}
              row={row}
              columns={columns}
              selected={buildUsageDetailRowKey(row) === selectedRowKey}
              onSelect={() =>
                onSelectRow(
                  buildUsageDetailRowKey(row),
                  resolveUsageDeskChartSelectionKey(row),
                  'drilldownDayKey' in row ? row.drilldownDayKey : undefined,
                )
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsageDetailRow({
  row,
  columns,
  selected,
  onSelect,
}: {
  row: UsageDetailTableRow;
  columns: UsageDetailColumn[];
  selected: boolean;
  onSelect: () => void;
}) {
  const cells = columns.map((column) => row[column.key] ?? '--');

  return (
    <tr
      onClick={onSelect}
      className={`${usageDetailTableRowClass} ${selected ? usageDetailTableSelectedRowClass : ''}`}
      data-usage-detail-row={selected ? 'selected' : 'idle'}
    >
      {cells.map((cell, index) => (
        <td
          key={`${row.timeLabel}-${index}`}
          className={`${usageDetailTableCellClass} ${
            selected ? 'text-[var(--gt-surface-canvas)]' : 'text-[var(--gt-ink-primary)]'
          }`}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}
