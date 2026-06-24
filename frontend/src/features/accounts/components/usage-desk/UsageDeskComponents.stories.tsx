import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import DesignSystemStoryFrame from '../../../design-system/DesignSystemStoryFrame';
import type { UsageDeskChartUnit, UsageDeskProjectedSessionUsage } from '../../model/usageDesk';
import {
  EmptyChartPlaceholder,
  UsageChartCard,
} from './UsageDeskChart';
import {
  buildUsageDetailRowKey,
  resolveUsageDetailColumns,
  UsageDetailTable,
  type UsageDetailTableRow,
} from './UsageDetailTable';
import {
  InfoCard,
  StatePanel,
  UsageSessionDrilldownPanel,
} from './UsageDeskPanels';

const meta = {
  title: 'Design System/业务组件/用量工作台',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const dailyTokenPoints = [
  { label: '05-13', value: 184000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-13' },
  { label: '05-14', value: 226000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-14' },
  { label: '05-15', value: 198000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-15' },
  { label: '05-16', value: 314000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-16' },
  { label: '05-17', value: 286000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-17' },
  { label: '05-18', value: 418000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-18' },
  { label: '05-19', value: 352000, color: 'var(--gt-chart-primary)', drilldownDayKey: '2026-05-19' },
];

const projectedTokenPoints = [
  { label: '05-13', value: 132000, color: 'var(--gt-chart-secondary)' },
  { label: '05-14', value: 188000, color: 'var(--gt-chart-secondary)' },
  { label: '05-15', value: 176000, color: 'var(--gt-chart-secondary)' },
  { label: '05-16', value: 274000, color: 'var(--gt-chart-secondary)' },
  { label: '05-17', value: 242000, color: 'var(--gt-chart-secondary)' },
  { label: '05-18', value: 365000, color: 'var(--gt-chart-secondary)' },
  { label: '05-19', value: 318000, color: 'var(--gt-chart-secondary)' },
];

const minuteRows: UsageDetailTableRow[] = [
  {
    timeLabel: '22:10',
    provider: 'codex',
    model: 'gpt-5.2',
    metric: 'tokens',
    value: '48.2K',
    requests: '12',
    inputTokens: '31.4K',
    cachedInputTokens: '9.8K',
    outputTokens: '7.0K',
    note: 'local session',
    drilldownDayKey: '2026-05-19',
  },
  {
    timeLabel: '22:20',
    provider: 'codex',
    model: 'gpt-5.2-mini',
    metric: 'tokens',
    value: '32.7K',
    requests: '8',
    inputTokens: '18.6K',
    cachedInputTokens: '7.1K',
    outputTokens: '7.0K',
    note: 'background task',
    drilldownDayKey: '2026-05-19',
  },
  {
    timeLabel: '22:30',
    provider: 'codex',
    model: 'gpt-5.2',
    metric: 'tokens',
    value: '61.5K',
    requests: '15',
    inputTokens: '39.2K',
    cachedInputTokens: '12.3K',
    outputTokens: '10.0K',
    note: 'selected bucket',
    drilldownDayKey: '2026-05-19',
  },
];

const sessionRows: UsageDeskProjectedSessionUsage[] = [
  {
    sessionID: 'session-20260519-a',
    fileLabel: 'codex-design-system.md',
    projectName: 'GetTokens',
    model: 'gpt-5.2',
    requests: 14,
    totalTokens: 84500,
    inputTokens: 52100,
    cachedInputTokens: 18800,
    outputTokens: 13600,
    latestTimestamp: '2026-05-19T22:32:00+08:00',
  },
  {
    sessionID: 'session-20260519-b',
    fileLabel: 'storybook-regression.md',
    projectName: 'GetTokens',
    model: 'gpt-5.2-mini',
    requests: 6,
    totalTokens: 27200,
    inputTokens: 16100,
    cachedInputTokens: 5400,
    outputTokens: 5700,
    latestTimestamp: '2026-05-19T22:26:00+08:00',
  },
];

function ChartSample({
  unit = 'tokens',
  empty = false,
}: {
  unit?: UsageDeskChartUnit;
  empty?: boolean;
}) {
  const [selectedPointKey, setSelectedPointKey] = useState('05-18');

  if (empty) {
    return (
      <DesignSystemStoryFrame label="DS-EMPTY">
        <EmptyChartPlaceholder
          title="NO USAGE DATA"
          body="This state keeps the grid context visible while explaining why the chart has no measurable series."
        />
      </DesignSystemStoryFrame>
    );
  }

  return (
    <DesignSystemStoryFrame label="DS-CHART">
      <UsageChartCard
        unit={unit}
        summaryItems={['7D TOKENS 1.98M', 'REQUESTS 184', 'CACHE HIT 32%']}
        controls={
          <div className="flex w-full flex-wrap gap-2 p-3">
            <Button size="small">
              7D
            </Button>
            <Button size="small" type="primary">
              TOKENS
            </Button>
          </div>
        }
        primary={dailyTokenPoints}
        secondary={projectedTokenPoints}
        selectedPointKey={selectedPointKey}
        onSelectPoint={(key) => setSelectedPointKey(key)}
        status={
          <>
            <span className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]">
              Usage curve
            </span>
            <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
              mock data
            </span>
          </>
        }
        footerExtra={
          <span className="rounded-md border border-[var(--gt-border-subtle)] px-2 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold">
            selected {selectedPointKey}
          </span>
        }
      />
    </DesignSystemStoryFrame>
  );
}

function TableSample({ empty = false }: { empty?: boolean }) {
  const rows = empty ? [] : minuteRows;
  const columns = useMemo(() => resolveUsageDetailColumns(rows), [rows]);
  const [selectedRowKey, setSelectedRowKey] = useState(rows[2] ? buildUsageDetailRowKey(rows[2]) : '');

  return (
    <DesignSystemStoryFrame label="DS-TABLE">
      <UsageDetailTable
        rows={rows}
        columns={columns}
        selectedRowKey={selectedRowKey}
        onSelectRow={(rowKey) => setSelectedRowKey(rowKey)}
      />
    </DesignSystemStoryFrame>
  );
}

function PanelsSample({ emptySessions = false }: { emptySessions?: boolean }) {
  return (
    <DesignSystemStoryFrame label="DS-PANEL">
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard title="TOTAL TOKENS" highlight="1.98M" body="Projected local usage across selected workspaces." />
          <InfoCard title="REQUESTS" highlight="184" body="Minute buckets preserve the current drilldown selection." />
          <StatePanel title="SYNC STATE" body="The current view is using stable preview data." />
        </div>
        <UsageSessionDrilldownPanel
          title="2026-05-19 22:30"
          rows={emptySessions ? [] : sessionRows}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

function UsageDeskOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">用量工作台组件</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          把 Usage Desk 中已经提取的图表、明细表、信息卡和会话下钻面板纳入设计系统，用固定 mock 数据检查曲线、空态、选中行和高密度指标布局。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">图表状态</h3>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
          <ChartSample />
          <ChartSample empty />
        </div>
      </section>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">明细表与面板</h3>
        <div className="grid gap-4">
          <TableSample />
          <PanelsSample />
          <PanelsSample emptySessions />
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <UsageDeskOverview />,
};

export const Chart: Story = {
  render: () => <ChartSample />,
};

export const Table: Story = {
  render: () => <TableSample />,
};

export const Panels: Story = {
  render: () => <PanelsSample />,
};
