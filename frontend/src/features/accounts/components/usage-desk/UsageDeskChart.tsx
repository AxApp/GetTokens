import { useEffect, useRef, type ReactNode } from 'react';
import {
  buildUsageDeskChartPointStyle,
  formatUsageDeskChartValue,
  type UsageDeskChartUnit,
} from '../../model/usageDesk';

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
  footerExtra,
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
  footerExtra?: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
      {status || controls ? (
        <div className="flex flex-col border-b-2 border-[var(--border-color)]">
          {status && (
            <div className="flex items-center justify-between bg-[var(--bg-surface)] px-4 py-2 border-b-2 border-[var(--border-color)]">
               {status}
            </div>
          )}
          {controls && (
             <div className="flex w-full items-center bg-[var(--bg-main)]">
                {controls}
             </div>
          )}
        </div>
      ) : null}

      <div className="relative">
        <ChartSurface
          primary={primary}
          secondary={secondary}
          unit={unit}
          compactProgress={compactProgress}
          selectedPointKey={selectedPointKey}
          onSelectPoint={onSelectPoint}
          rangeAnimationVersion={rangeAnimationVersion}
        />
        {/* 凹陷感内阴影叠加层 */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_12px_16px_-8px_rgba(0,0,0,0.1),inset_0_-12px_16px_-8px_rgba(0,0,0,0.1)]" />
      </div>

      {(summaryItems.length > 0 || footerExtra) && (
        <footer className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
          {summaryItems.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-1">
               <span className="text-[0.6875rem] font-black uppercase tracking-tight text-[var(--text-primary)]">{item}</span>
            </div>
          ))}
          {footerExtra && <div className="ml-auto">{footerExtra}</div>}
        </footer>
      )}
    </div>
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
}: {
  primary: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  secondary?: Array<{ label: string; value: number; color: string; drilldownDayKey?: string }>;
  unit: UsageDeskChartUnit;
  compactProgress?: number;
  selectedPointKey: string;
  onSelectPoint: (chartSelectionKey: string, drilldownDayKey?: string) => void;
  rangeAnimationVersion?: number;
}) {
  const chartHeight = 280;
  const chartTopInset = 42;
  const chartBottomInset = 48;
  const chartInnerHeight = chartHeight - chartTopInset - chartBottomInset;
  const chartBaseY = chartTopInset + chartInnerHeight;
  const labelBaseY = chartHeight - 12;
  const pointCount = Math.max(primary.length, secondary?.length ?? 0, 1);
  const chartWidth = Math.max(420, pointCount * (pointCount <= 14 ? 72 : 78));
  const allValues = [...primary, ...(secondary ?? [])].map((point) => point.value);
  const maxValue = Math.max(...allValues, 1);
  const primaryTone = '#111111';
  const primaryAreaTone = '#2f2f2f';
  const secondaryTone = '#7a7a7a';
  const secondaryAreaTone = '#9a9a9a';

  const buildChartCoords = (points: Array<{ value: number }>) =>
    points.map((point, index) => ({
      x: points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth,
      y: chartBaseY - (point.value / maxValue) * chartInnerHeight,
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
    <div ref={chartScrollRef} className="overflow-x-auto overflow-y-hidden bg-[var(--bg-main)]">
        <div
          className="relative mx-auto transition-all duration-300 ease-out"
          style={{
            height: `${chartHeight}px`,
            width: `${chartWidth}px`,
            backgroundImage:
              'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgba(0,0,0,0.12) calc(25% - 1px), rgba(0,0,0,0.12) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), rgba(0,0,0,0.12) calc(50% - 1px), rgba(0,0,0,0.12) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), rgba(0,0,0,0.12) calc(75% - 1px), rgba(0,0,0,0.12) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, rgba(0,0,0,0.08) 55px, rgba(0,0,0,0.08) 56px)',
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
                stroke="#111111"
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
              style={{ animation: 'usage-desk-curve-sweep 420ms cubic-bezier(0.22,1,0.36,1)' }}
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
                style={{ animation: 'usage-desk-curve-sweep 420ms cubic-bezier(0.22,1,0.36,1)' }}
              />
            ) : null}
          </svg>

          {/* HTML 点位与标签层 (防止缩放变形) */}
          <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
            <div className="relative h-full w-full pointer-events-auto">
              {primary.map((point, index) => {
                const x = primary.length <= 1 ? 0 : (index / (primary.length - 1)) * chartWidth;
                const y = chartBaseY - (point.value / maxValue) * chartInnerHeight;
                return (
                  <ChartPoint
                    key={`primary-${rangeAnimationVersion}-${point.label}`}
                    x={x}
                    y={y}
                    label={formatUsageDeskChartValue(point.value, unit)}
                    color={primaryTone}
                    helper={point.label}
                    helperY={labelBaseY}
                    selected={selectedPointKey === point.label}
                    onSelect={() => onSelectPoint(point.label, point.drilldownDayKey)}
                    animate
                  />
                );
              })}
              {secondary?.map((point, index) => {
                const x = secondary.length <= 1 ? 0 : (index / (secondary.length - 1)) * chartWidth;
                const y = chartBaseY - (point.value / maxValue) * chartInnerHeight;
                return (
                  <ChartPoint
                    key={`secondary-${rangeAnimationVersion}-${point.label}`}
                    x={x}
                    y={y}
                    label={formatUsageDeskChartValue(point.value, unit)}
                    color={secondaryTone}
                    helper={point.label}
                    helperY={labelBaseY}
                    labelPosition="bottom"
                    small
                    selected={selectedPointKey === point.label}
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
}) {
  return (
    <div
      style={
        animate
          ? {
              ...buildUsageDeskChartPointStyle(x, y),
              animation: 'usage-desk-point-rise 360ms cubic-bezier(0.22,1,0.36,1)',
            }
          : buildUsageDeskChartPointStyle(x, y)
      }
      className={`absolute flex items-center justify-center ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      {/* 1. 数值标签 (不占用空间) */}
      <div
        className={`absolute whitespace-nowrap text-center transition-all pointer-events-none ${labelPosition === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'}`}
        style={{ color, fontSize: selected ? '12px' : '11px', fontWeight: selected ? 900 : 800 }}
      >
        {label}
      </div>

      {/* 2. 中心圆点 */}
      <div className="relative flex items-center justify-center">
        {selected && (
          <div className="absolute h-8 w-8 rounded-full bg-[var(--text-primary)] opacity-10 animate-pulse" />
        )}
        <div
          className={`rounded-full border-2 border-white shadow-sm transition-transform ${selected ? (small ? 'h-3 w-3' : 'h-3.5 w-3.5 scale-110') : (small ? 'h-2 w-2' : 'h-2.5 w-2.5')}`}
          style={{ backgroundColor: color }}
        />
      </div>

      {/* 3. 辅助轴向标签 (日期/时间) - 绝对定位到 chart 底部 */}
      <div
        className="absolute whitespace-nowrap font-black transition-all -translate-x-1/2 pointer-events-none"
        style={{
          top: `${helperY - y}px`,
          fontSize: '10px',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
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
    <div
      className="relative overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
      style={{
        height: `${chartHeight}px`,
        backgroundImage:
          'linear-gradient(to bottom, transparent 0, transparent calc(25% - 1px), rgba(0,0,0,0.2) calc(25% - 1px), rgba(0,0,0,0.2) 25%, transparent 25%), linear-gradient(to bottom, transparent 0, transparent calc(50% - 1px), rgba(0,0,0,0.2) calc(50% - 1px), rgba(0,0,0,0.2) 50%, transparent 50%), linear-gradient(to bottom, transparent 0, transparent calc(75% - 1px), rgba(0,0,0,0.2) calc(75% - 1px), rgba(0,0,0,0.2) 75%, transparent 75%), repeating-linear-gradient(to right, transparent 0, transparent 55px, rgba(0,0,0,0.12) 55px, rgba(0,0,0,0.12) 56px)',
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.88))] px-6 text-center">
        <div className="text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">{title}</div>
        <p className="max-w-md text-[0.6875rem] font-bold leading-6 text-[var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}
