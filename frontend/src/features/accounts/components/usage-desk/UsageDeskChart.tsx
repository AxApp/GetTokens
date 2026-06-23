import { useEffect, useRef, type ReactNode } from 'react';
import { Card, Divider, Empty, Space, Typography } from 'antd';
import {
  buildUsageDeskChartPointStyle,
  buildUsageDeskChartValueScale,
  formatUsageDeskChartValue,
  resolveUsageDeskCurveAnimationConfig,
  type UsageDeskCurveMotion,
  type UsageDeskChartUnit,
} from '../../model/usageDesk';

const usageDeskChartSurfaceClass = 'overflow-x-auto overflow-y-hidden bg-[var(--gt-surface-canvas)]';
const usageDeskChartPointRingClass =
  'rounded-full border border-[var(--gt-surface-canvas)] transition-transform';
const usageDeskChartAxisLabelClass =
  'absolute whitespace-nowrap font-semibold transition-all -translate-x-1/2 pointer-events-none';

export function UsageChartCard({
  rangeAnimationVersion = 0,
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
  curveMotion = 'standard',
}: {
  rangeAnimationVersion?: number;
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
  curveMotion?: UsageDeskCurveMotion;
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
            rangeAnimationVersion={rangeAnimationVersion}
            curveMotion={curveMotion}
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
  rangeAnimationVersion = 0,
  curveMotion = 'standard',
}: {
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  unit: UsageDeskChartUnit;
  compactProgress?: number;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
  rangeAnimationVersion?: number;
  curveMotion?: UsageDeskCurveMotion;
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
  const curveAnimation = resolveUsageDeskCurveAnimationConfig(curveMotion, pointCount);
  const primaryTone = 'var(--color-chart-primary)';
  const primaryAreaTone = 'var(--color-chart-primary-area)';
  const secondaryTone = 'var(--color-chart-secondary)';
  const secondaryAreaTone = 'var(--color-chart-secondary-area)';
  const chartGridBackgroundImage =
    'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), var(--color-chart-grid) calc(25% - 1px), var(--color-chart-grid) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), var(--color-chart-grid) calc(50% - 1px), var(--color-chart-grid) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), var(--color-chart-grid) calc(75% - 1px), var(--color-chart-grid) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, var(--color-chart-grid-subtle) 55px, var(--color-chart-grid-subtle) 56px)';

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
      style={{ backgroundImage: chartGridBackgroundImage }}
    >
      <div
        className="relative mx-auto transition-all duration-300 ease-out"
        style={{
          height: `${chartHeight}px`,
          width: `${chartWidth}px`,
        }}
      >
        <style>{`
            @keyframes usage-desk-curve-sweep {
              0% { stroke-dashoffset: 1; opacity: 0.32; }
              100% { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes usage-desk-area-fade {
              0% { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes usage-desk-point-rise {
              0% { opacity: 0; transform: translate(-50%, calc(-50% + 8px)) scale(0.86); }
              100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
          `}</style>
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
          <path
            key={`primary-area-${rangeAnimationVersion}-${primary.length}`}
            d={buildSmoothAreaPath(primaryCoords)}
            fill="url(#usage-primary-area-live)"
            style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', animation: 'usage-desk-area-fade 320ms cubic-bezier(0.22,1,0.36,1)' }}
          />
          {secondary?.length ? (
            <path
              key={`secondary-area-${rangeAnimationVersion}-${secondary.length}`}
              d={buildSmoothAreaPath(secondaryCoords)}
              fill="url(#usage-secondary-area-live)"
              style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', animation: 'usage-desk-area-fade 320ms cubic-bezier(0.22,1,0.36,1)' }}
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
            key={`primary-line-${rangeAnimationVersion}-${primary.length}`}
            d={buildSmoothLinePath(primaryCoords)}
            fill="none"
            stroke={primaryTone}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={0}
            style={{ animation: `usage-desk-curve-sweep ${curveAnimation.durationMs}ms cubic-bezier(0.22,1,0.36,1)` }}
          />
          {secondary?.length ? (
            <path
              key={`secondary-line-${rangeAnimationVersion}-${secondary.length}`}
              d={buildSmoothLinePath(secondaryCoords)}
              fill="none"
              stroke={secondaryTone}
              strokeWidth="3"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDashoffset={0}
              style={{ animation: `usage-desk-curve-sweep ${curveAnimation.durationMs}ms cubic-bezier(0.22,1,0.36,1)` }}
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
                  key={`primary-${rangeAnimationVersion}-${point.label}`}
                  x={coord.x}
                  y={coord.y}
                  label={formatUsageDeskChartValue(point.value, unit)}
                  color={primaryTone}
                  helper={point.label}
                  helperY={labelBaseY}
                  selected={selectedPointKey === point.label}
                  onSelect={() => onSelectPoint(point.label, point.drilldownDayKey)}
                  animationDelayMs={curveAnimation.pointDelayMs * index}
                  animate
                />
              );
            })}
            {secondary?.map((point, index) => {
              const coord = secondaryCoords[index];
              if (!coord) return null;
              return (
                <ChartPoint
                  key={`secondary-${rangeAnimationVersion}-${point.label}`}
                  x={coord.x}
                  y={coord.y}
                  label={formatUsageDeskChartValue(point.value, unit)}
                  color={secondaryTone}
                  helper={point.label}
                  helperY={labelBaseY}
                  labelPosition="bottom"
                  small
                  selected={selectedPointKey === point.label}
                  animationDelayMs={curveAnimation.pointDelayMs * index}
                  animate
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
  animate = false,
  animationDelayMs = 0,
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
  animate?: boolean;
  animationDelayMs?: number;
}) {
  return (
    <div
      style={
        animate
          ? {
              ...buildUsageDeskChartPointStyle(x, y),
              animation: 'usage-desk-point-rise 360ms cubic-bezier(0.22,1,0.36,1) both',
              animationDelay: `${animationDelayMs}ms`,
            }
          : buildUsageDeskChartPointStyle(x, y)
      }
      className={`absolute flex items-center justify-center ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      {/* 1. 数值标签 (不占用空间) */}
      <div
        className={`absolute whitespace-nowrap text-center transition-all pointer-events-none ${labelPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'}`}
        style={{ color, fontSize: selected ? 'var(--gt-font-size-md)' : 'var(--gt-font-size-md-compact)', fontWeight: selected ? 700 : 600 }}
      >
        {label}
      </div>

      {/* 2. 中心圆点 */}
      <div className="relative flex items-center justify-center">
        {selected && (
          <div className="absolute h-8 w-8 rounded-full bg-[var(--gt-ink-primary)] opacity-10 animate-pulse" />
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
      style={{
        backgroundImage:
          'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), var(--color-chart-grid-strong) calc(25% - 1px), var(--color-chart-grid-strong) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), var(--color-chart-grid-strong) calc(50% - 1px), var(--color-chart-grid-strong) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), var(--color-chart-grid-strong) calc(75% - 1px), var(--color-chart-grid-strong) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, var(--color-chart-grid) 55px, var(--color-chart-grid) 56px)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,var(--color-chart-empty-overlay-from),var(--color-chart-empty-overlay-to))]">
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
