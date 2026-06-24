import { useEffect, useRef, type ReactNode } from 'react';
import { Card, Divider, Empty, Space, Typography } from 'antd';
import {
  buildUsageDeskChartPointStyle,
  buildUsageDeskChartValueScale,
  formatUsageDeskChartValue,
  type UsageDeskChartUnit,
} from '../../model/usageDesk';

const usageDeskChartSurfaceClass = 'overflow-x-auto overflow-y-hidden bg-[var(--gt-surface-canvas)]';
const usageDeskChartPointRingClass =
  'rounded-full border border-[var(--gt-surface-canvas)]';
const usageDeskChartAxisLabelClass =
  'absolute whitespace-nowrap font-semibold -translate-x-1/2 pointer-events-none';

export function UsageChartCard({
  compactProgress = 0,
  unit,
  summaryItems,
  controls,
  primary,
  secondary,
  selectedPointKey,
  onSelectPoint,
  status,
  surfaceContent,
  footerExtra,
}: {
  compactProgress?: number;
  unit: UsageDeskChartUnit;
  summaryItems: string[];
  controls?: ReactNode;
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
  status?: ReactNode;
  surfaceContent?: ReactNode;
  footerExtra?: ReactNode;
}) {
  return (
    <Card
      size="small"
      variant="outlined"
      className="overflow-hidden"
      data-usage-desk-chart-card
      styles={{ body: { padding: 0 } }}
    >
      {status || controls ? (
        <>
          {status && (
            <div className="bg-[var(--gt-surface-muted)] px-4 py-2">
              {status}
            </div>
          )}
          {status && controls && <Divider className="!my-0" />}
          {controls && (
            <div className="px-4 py-2">
              {controls}
            </div>
          )}
        </>
      ) : null}

      <div className="relative">
        {surfaceContent ?? (
          <ChartSurface
            primary={primary}
            secondary={secondary}
            unit={unit}
            compactProgress={compactProgress}
            selectedPointKey={selectedPointKey}
            onSelectPoint={onSelectPoint}
          />
        )}
      </div>

      {(summaryItems.length > 0 || footerExtra) && (
        <>
          <Divider className="!my-0" />
          <footer className="flex flex-wrap items-center gap-x-8 gap-y-2 bg-[var(--gt-surface-muted)] px-4 py-3">
            <Space size={32} wrap>
              {summaryItems.map((item, idx) => (
                <Typography.Text
                  key={idx}
                  strong
                  className="!text-[length:var(--gt-font-size-md-compact)]"
                >
                  {item}
                </Typography.Text>
              ))}
            </Space>
            {footerExtra && <div className="ml-auto">{footerExtra}</div>}
          </footer>
        </>
      )}
    </Card>
  );
}

function ChartSurface({
  primary,
  secondary,
  unit,
  compactProgress = 0,
  selectedPointKey,
  onSelectPoint,
}: {
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  unit: UsageDeskChartUnit;
  compactProgress?: number;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
}) {
  const chartHeight = 280;
  const chartTopInset = 42;
  const chartBottomInset = 48;
  const chartInnerHeight = chartHeight - chartTopInset - chartBottomInset;
  const chartBaseY = chartTopInset + chartInnerHeight;
  const labelBaseY = chartHeight - 12;
  const pointCount = Math.max(primary.length, secondary?.length ?? 0, 1);
  const chartSideInset = 72;
  const chartPointStep = pointCount <= 14 ? 72 : 78;
  const chartPlotWidth = Math.max(240, Math.max(pointCount - 1, 1) * chartPointStep);
  const chartWidth = Math.max(420, chartPlotWidth + chartSideInset * 2);
  const allValues = [...primary, ...(secondary ?? [])].map((point) => point.value);
  const valueScale = buildUsageDeskChartValueScale(allValues);
  const primaryTone = 'var(--color-chart-primary)';
  const primaryAreaTone = 'var(--color-chart-primary-area)';
  const secondaryTone = 'var(--color-chart-secondary)';
  const secondaryAreaTone = 'var(--color-chart-secondary-area)';
  const horizontalGridLines = [0.25, 0.5, 0.75].map((ratio) => chartHeight * ratio);
  const verticalGridLines = Array.from(
    { length: Math.floor(chartWidth / 55) },
    (_, index) => (index + 1) * 55,
  );

  const buildChartCoords = (points: Array<{ value: number }>) =>
    points.map((point, index) => ({
      x: points.length <= 1 ? chartWidth / 2 : chartSideInset + (index / (points.length - 1)) * chartPlotWidth,
      y: chartBaseY - valueScale.ratio(point.value) * chartInnerHeight,
    }));

  const buildSmoothLinePath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M${points[0].x},${points[0].y}`;
    }
    const commands = [`M${points[0].x},${points[0].y}`];
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const previous = points[index - 1] ?? current;
      const afterNext = points[index + 2] ?? next;
      const control1X = current.x + (next.x - previous.x) / 6;
      const control1Y = current.y + (next.y - previous.y) / 6;
      const control2X = next.x - (afterNext.x - current.x) / 6;
      const control2Y = next.y - (afterNext.y - current.y) / 6;
      commands.push(`C${control1X},${control1Y} ${control2X},${control2Y} ${next.x},${next.y}`);
    }
    return commands.join(' ');
  };

  const buildSmoothAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M${points[0].x},${chartBaseY} L${points[0].x},${points[0].y} L${points[0].x},${chartBaseY} Z`;
    }
    return `${buildSmoothLinePath(points)} L${points[points.length - 1].x},${chartBaseY} L${points[0].x},${chartBaseY} Z`;
  };

  const primaryCoords = buildChartCoords(primary);
  const secondaryCoords = buildChartCoords(secondary ?? []);

  const selectedPrimaryIndex = primary.findIndex((point) => point.label === selectedPointKey);
  const selectedPrimaryX =
    selectedPrimaryIndex >= 0 && primaryCoords[selectedPrimaryIndex] ? primaryCoords[selectedPrimaryIndex].x : null;
  const chartScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chartScrollRef.current;
    if (!container || selectedPrimaryX === null) {
      return;
    }

    const viewportStart = container.scrollLeft;
    const viewportWidth = container.clientWidth;
    const viewportEnd = viewportStart + viewportWidth;
    const safeMargin = Math.min(120, viewportWidth * 0.2);
    const pointStart = selectedPrimaryX - safeMargin;
    const pointEnd = selectedPrimaryX + safeMargin;

    if (pointStart >= viewportStart && pointEnd <= viewportEnd) {
      return;
    }

    const targetScrollLeft = Math.max(
      0,
      Math.min(selectedPrimaryX - viewportWidth / 2, container.scrollWidth - viewportWidth),
    );
    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  }, [selectedPrimaryX]);

  return (
    <div
      ref={chartScrollRef}
      className={usageDeskChartSurfaceClass}
      data-usage-desk-chart-surface
    >
      <div
        className="relative mx-auto"
        style={{
          height: `${chartHeight}px`,
          width: `${chartWidth}px`,
        }}
      >
        {/* 背景与曲线层 */}
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="usage-primary-area-live" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryAreaTone} stopOpacity="0.24" />
              <stop offset="100%" stopColor={primaryAreaTone} stopOpacity="0.03" />
            </linearGradient>
            {secondary?.length ? (
              <linearGradient id="usage-secondary-area-live" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={secondaryAreaTone} stopOpacity="0.18" />
                <stop offset="100%" stopColor={secondaryAreaTone} stopOpacity="0.02" />
              </linearGradient>
            ) : null}
          </defs>
          <g strokeWidth="1" vectorEffect="non-scaling-stroke">
            {horizontalGridLines.map((y) => (
              <line key={`h-${y}`} x1={0} x2={chartWidth} y1={y} y2={y} stroke="var(--color-chart-grid)" />
            ))}
            {verticalGridLines.map((x) => (
              <line key={`v-${x}`} x1={x} x2={x} y1={0} y2={chartHeight} stroke="var(--color-chart-grid-subtle)" />
            ))}
          </g>
          <path
            d={buildSmoothAreaPath(primaryCoords)}
            fill="url(#usage-primary-area-live)"
          />
          {secondary?.length ? (
            <path
              d={buildSmoothAreaPath(secondaryCoords)}
              fill="url(#usage-secondary-area-live)"
            />
          ) : null}
          {selectedPrimaryX !== null ? (
            <line
              x1={selectedPrimaryX}
              y1={12}
              x2={selectedPrimaryX}
              y2={chartHeight - 8}
              stroke="var(--color-chart-primary)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
          ) : null}
          <path
            d={buildSmoothLinePath(primaryCoords)}
            fill="none"
            stroke={primaryTone}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={0}
          />
          {secondary?.length ? (
            <path
              d={buildSmoothLinePath(secondaryCoords)}
              fill="none"
              stroke={secondaryTone}
              strokeWidth="3"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDashoffset={0}
            />
          ) : null}
        </svg>

        {/* HTML 点位与标签层 (防止缩放变形) */}
        <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
          <div className="relative h-full w-full pointer-events-auto">
            {primary.map((point, index) => {
              const coord = primaryCoords[index];
              if (!coord) return null;
              return (
                <ChartPoint
                  key={`primary-${point.label}`}
                  x={coord.x}
                  y={coord.y}
                  label={formatUsageDeskChartValue(point.value, unit)}
                  color={primaryTone}
                  helper={point.label}
                  helperY={labelBaseY}
                  selected={selectedPointKey === point.label}
                  onSelect={() => onSelectPoint(point.label, point.drilldownDayKey)}
                />
              );
            })}
            {secondary?.map((point, index) => {
              const coord = secondaryCoords[index];
              if (!coord) return null;
              return (
                <ChartPoint
                  key={`secondary-${point.label}`}
                  x={coord.x}
                  y={coord.y}
                  label={formatUsageDeskChartValue(point.value, unit)}
                  color={secondaryTone}
                  helper={point.label}
                  helperY={labelBaseY}
                  labelPosition="bottom"
                  small
                  selected={selectedPointKey === point.label}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartPoint({
  x,
  y,
  label,
  color,
  helper,
  helperY = 258,
  labelPosition = 'top',
  small = false,
  selected = false,
  onSelect,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  helper: string;
  helperY?: number;
  labelPosition?: 'top' | 'bottom';
  small?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      style={buildUsageDeskChartPointStyle(x, y)}
      className={`absolute flex items-center justify-center ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      {/* 1. 数值标签 (不占用空间) */}
      <div
        className={`absolute whitespace-nowrap text-center pointer-events-none ${labelPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'}`}
        style={{ color, fontSize: selected ? 'var(--gt-font-size-md)' : 'var(--gt-font-size-md-compact)', fontWeight: selected ? 700 : 600 }}
      >
        {label}
      </div>

      {/* 2. 中心圆点 */}
      <div className="relative flex items-center justify-center">
        {selected && (
          <div className="absolute h-8 w-8 rounded-full bg-[var(--gt-ink-primary)] opacity-10" />
        )}
        <div
          className={`${usageDeskChartPointRingClass} ${selected ? (small ? 'h-3 w-3' : 'h-3.5 w-3.5 scale-110') : (small ? 'h-2 w-2' : 'h-2.5 w-2.5')}`}
          style={{ backgroundColor: color }}
        />
      </div>

      {/* 3. 辅助轴向标签 (日期/时间) - 绝对定位到 chart 底部 */}
      <div
        className={usageDeskChartAxisLabelClass}
        style={{
          top: `${helperY - y}px`,
          fontSize: 'var(--gt-font-size-sm)',
          color: selected ? 'var(--gt-ink-primary)' : 'var(--gt-ink-muted)',
          opacity: selected ? 1 : 0.6
        }}
      >
        {helper}
      </div>
    </div>
  );
}

export function EmptyChartPlaceholder({
  compactProgress = 0,
  title,
  body,
}: {
  compactProgress?: number;
  title: string;
  body: string;
}) {
  const progress = Math.max(0, Math.min(compactProgress, 1));
  const chartHeight = 268 - 44 * progress;

  return (
    <Card
      size="small"
      variant="outlined"
      className="relative overflow-hidden"
      data-usage-desk-empty-chart
      styles={{ body: { padding: 0, height: `${chartHeight}px` } }}
    >
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--gt-surface-canvas)]">
        <Empty
          description={
            <Space direction="vertical" size={4} className="text-center">
              <Typography.Text strong>{title}</Typography.Text>
              <Typography.Text type="secondary" className="!text-[length:var(--gt-font-size-md-compact)]">
                {body}
              </Typography.Text>
            </Space>
          }
        />
      </div>
    </Card>
  );
}
