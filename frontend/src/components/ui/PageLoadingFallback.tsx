import type { CSSProperties } from 'react';

type DataInfluxPacketStyle = CSSProperties & {
  '--packet-delay': string;
  '--packet-duration': string;
  '--packet-opacity': string;
  '--packet-top': string;
  '--packet-width': string;
};

const dataInfluxPacketStyles: ReadonlyArray<DataInfluxPacketStyle> = [
  { '--packet-top': '0.22rem', '--packet-width': '4.1rem', '--packet-delay': '-0.08s', '--packet-duration': '0.62s', '--packet-opacity': '0.34' },
  { '--packet-top': '0.48rem', '--packet-width': '7.8rem', '--packet-delay': '-0.31s', '--packet-duration': '0.76s', '--packet-opacity': '0.28' },
  { '--packet-top': '0.74rem', '--packet-width': '2.9rem', '--packet-delay': '-0.52s', '--packet-duration': '0.58s', '--packet-opacity': '0.4' },
  { '--packet-top': '1.01rem', '--packet-width': '6.4rem', '--packet-delay': '-0.18s', '--packet-duration': '0.7s', '--packet-opacity': '0.3' },
  { '--packet-top': '1.28rem', '--packet-width': '8.8rem', '--packet-delay': '-0.64s', '--packet-duration': '0.82s', '--packet-opacity': '0.24' },
  { '--packet-top': '1.54rem', '--packet-width': '3.6rem', '--packet-delay': '-0.39s', '--packet-duration': '0.6s', '--packet-opacity': '0.38' },
  { '--packet-top': '1.82rem', '--packet-width': '5.1rem', '--packet-delay': '-0.73s', '--packet-duration': '0.66s', '--packet-opacity': '0.32' },
  { '--packet-top': '2.08rem', '--packet-width': '9.4rem', '--packet-delay': '-0.24s', '--packet-duration': '0.84s', '--packet-opacity': '0.22' },
  { '--packet-top': '2.36rem', '--packet-width': '4.7rem', '--packet-delay': '-0.57s', '--packet-duration': '0.64s', '--packet-opacity': '0.36' },
  { '--packet-top': '2.62rem', '--packet-width': '7.1rem', '--packet-delay': '-0.81s', '--packet-duration': '0.78s', '--packet-opacity': '0.3' },
  { '--packet-top': '2.9rem', '--packet-width': '3.3rem', '--packet-delay': '-0.45s', '--packet-duration': '0.56s', '--packet-opacity': '0.42' },
  { '--packet-top': '3.16rem', '--packet-width': '8.2rem', '--packet-delay': '-0.12s', '--packet-duration': '0.8s', '--packet-opacity': '0.26' },
  { '--packet-top': '3.43rem', '--packet-width': '5.9rem', '--packet-delay': '-0.68s', '--packet-duration': '0.72s', '--packet-opacity': '0.34' },
  { '--packet-top': '3.7rem', '--packet-width': '9.8rem', '--packet-delay': '-0.35s', '--packet-duration': '0.86s', '--packet-opacity': '0.2' },
  { '--packet-top': '3.96rem', '--packet-width': '4.2rem', '--packet-delay': '-0.86s', '--packet-duration': '0.62s', '--packet-opacity': '0.38' },
  { '--packet-top': '4.24rem', '--packet-width': '6.7rem', '--packet-delay': '-0.49s', '--packet-duration': '0.74s', '--packet-opacity': '0.3' },
  { '--packet-top': '4.5rem', '--packet-width': '3.1rem', '--packet-delay': '-0.2s', '--packet-duration': '0.54s', '--packet-opacity': '0.44' },
  { '--packet-top': '4.78rem', '--packet-width': '8.6rem', '--packet-delay': '-0.77s', '--packet-duration': '0.82s', '--packet-opacity': '0.24' },
  { '--packet-top': '5.04rem', '--packet-width': '5.4rem', '--packet-delay': '-0.41s', '--packet-duration': '0.68s', '--packet-opacity': '0.34' },
  { '--packet-top': '5.32rem', '--packet-width': '9.1rem', '--packet-delay': '-0.92s', '--packet-duration': '0.88s', '--packet-opacity': '0.2' },
  { '--packet-top': '5.58rem', '--packet-width': '3.8rem', '--packet-delay': '-0.28s', '--packet-duration': '0.58s', '--packet-opacity': '0.4' },
  { '--packet-top': '5.86rem', '--packet-width': '7.5rem', '--packet-delay': '-0.61s', '--packet-duration': '0.78s', '--packet-opacity': '0.28' },
  { '--packet-top': '6.12rem', '--packet-width': '4.8rem', '--packet-delay': '-0.04s', '--packet-duration': '0.64s', '--packet-opacity': '0.36' },
  { '--packet-top': '6.38rem', '--packet-width': '10.2rem', '--packet-delay': '-0.7s', '--packet-duration': '0.9s', '--packet-opacity': '0.18' },
];

const pageLoadingRootClass =
  'page-loading-fallback flex h-full min-h-[8rem] items-center justify-center overflow-hidden bg-[var(--gt-surface-muted)] p-4';
const pageLoadingPanelClass =
  'page-loading-panel grid w-full max-w-[20rem] grid-cols-[5rem_minmax(0,1fr)] overflow-hidden rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-[var(--gt-elevation-raised-2)]';
const pageLoadingRailClass =
  'page-loading-rail relative grid grid-rows-4 overflow-hidden border-r border-[var(--gt-border-subtle)] bg-[var(--gt-ink-primary)]';
const pageLoadingLabelClass =
  'font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const pageLoadingMetaClass =
  'mb-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const pageLoadingTrackClass =
  'page-loading-track relative h-5 overflow-hidden border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';

export default function PageLoadingFallback() {
  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="PageLoadingFallback"
      data-page-loading-fallback="quiet"
      className={pageLoadingRootClass}
      role="status"
      aria-live="polite"
    >
      <div className={pageLoadingPanelClass}>
        <div className={pageLoadingRailClass}>
          <div className="page-loading-rail-bus" aria-hidden="true" />
          <div className="page-loading-orbit" aria-hidden="true">
            <span className="page-loading-planet" />
            <span className="page-loading-orbit-line page-loading-orbit-line-a" />
            <span className="page-loading-orbit-line page-loading-orbit-line-b" />
            <span className="page-loading-orbit-line page-loading-orbit-line-c" />
          </div>
          <span className="page-loading-rail-cell" />
          <span className="page-loading-rail-cell" />
          <span className="page-loading-rail-cell" />
          <span className="page-loading-rail-cell" />
        </div>
        <div className="relative min-w-0 overflow-hidden px-4 py-3.5">
          <div className="page-loading-influx absolute inset-0" aria-hidden="true">
            {dataInfluxPacketStyles.map((style, index) => (
              <span key={index} style={style} />
            ))}
          </div>
          <div className="page-loading-bitstream absolute inset-0" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={pageLoadingLabelClass}>
                Loading
              </span>
              <span className="page-loading-pulse h-2.5 w-2.5 shrink-0 bg-[var(--text-primary)]" aria-hidden="true" />
            </div>
            <div className={pageLoadingMetaClass} aria-hidden="true">
              <span className="truncate">Data Influx</span>
              <span className="page-loading-ticker text-[var(--text-primary)]" />
            </div>
            <div className={pageLoadingTrackClass}>
              <span className="page-loading-scan absolute inset-y-0 left-0 block w-1/3 bg-[var(--text-primary)]" aria-hidden="true" />
              <span className="page-loading-grid absolute inset-0" aria-hidden="true" />
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
              <span className="page-loading-step h-2 bg-[var(--text-primary)]" />
              <span className="page-loading-step h-2 bg-[var(--text-primary)]" />
              <span className="page-loading-step h-2 bg-[var(--text-primary)]" />
              <span className="page-loading-step h-2 bg-[var(--text-primary)]" />
              <span className="page-loading-step h-2 bg-[var(--text-primary)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
