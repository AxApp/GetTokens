import type { SegmentedOption } from '../../types';

export type LocalProjectedUsageRefreshIntervalID = '5' | '15' | '30' | '60';

export const localProjectedUsageRefreshIntervalOptions: ReadonlyArray<SegmentedOption<LocalProjectedUsageRefreshIntervalID>> = [
  { id: '5', label: '5分钟' },
  { id: '15', label: '15分钟' },
  { id: '30', label: '半小时' },
  { id: '60', label: '1小时' },
];

export function resolveLocalProjectedUsageRefreshIntervalID(value: number): LocalProjectedUsageRefreshIntervalID {
  if (value === 5 || value === 15 || value === 30 || value === 60) {
    return String(value) as LocalProjectedUsageRefreshIntervalID;
  }
  return '15';
}

export function parseLocalProjectedUsageRefreshIntervalMinutes(
  value: LocalProjectedUsageRefreshIntervalID,
): number {
  return Number.parseInt(value, 10);
}
