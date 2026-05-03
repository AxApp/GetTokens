import {
  buildUsageDeskChartPointStyle,
  formatUsageDeskChartValue,
  resolveUsageDeskChartSelectionKey,
  type UsageDeskMinuteRow,
} from '../../model/usageDesk';

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

  return hasProjectedBreakdown
    ? [
        { key: 'timeLabel', header: '时间' },
        { key: 'model', header: '模型' },
        { key: 'requests', header: '请求数' },
        { key: 'value', header: 'Token' },
        { key: 'inputTokens', header: '输入' },
        { key: 'cachedInputTokens', header: '缓存' },
        { key: 'outputTokens', header: '输出' },
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
    <div className="overflow-x-auto overflow-y-visible border-2 border-[var(--border-color)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[var(--bg-surface)]">
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b-2 border-[var(--border-color)] px-3 py-3 text-left text-[0.625rem] font-black tracking-[0.12em] text-[var(--text-primary)]"
              >
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
      className={`border-t border-dashed border-[var(--border-color)] first:border-t-0 cursor-pointer transition-colors ${
        selected ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'hover:bg-[var(--bg-main)]/60'
      }`}
    >
      {cells.map((cell, index) => (
        <td
          key={`${row.timeLabel}-${index}`}
          className={`px-3 py-3 text-[0.6875rem] font-bold leading-6 ${selected ? 'text-[var(--bg-main)]' : 'text-[var(--text-primary)]'}`}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}
