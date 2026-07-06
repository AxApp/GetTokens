const pageLoadingRootClass =
  'flex h-full min-h-[8rem] items-center justify-center bg-[var(--gt-surface-muted)] p-4';
const pageLoadingPanelClass =
  'grid w-full max-w-[20rem] gap-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 shadow-sm';
const pageLoadingLabelClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const pageLoadingMetaClass =
  'font-mono text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const pageLoadingTrackClass =
  'h-2 rounded bg-[var(--gt-surface-muted)]';
const pageLoadingTrackStrongClass =
  'h-2 rounded bg-[color-mix(in_srgb,var(--gt-ink-primary)_18%,var(--gt-surface-muted))]';

export default function PageLoadingFallback() {
  return (
    <div
      data-page-loading-fallback="quiet"
      className={pageLoadingRootClass}
      role="status"
      aria-live="polite"
    >
      <div className={pageLoadingPanelClass}>
        <div className="flex items-center justify-between gap-3">
          <span className={pageLoadingLabelClass}>Loading</span>
          <span className={pageLoadingMetaClass}>Please wait</span>
        </div>
        <div className="grid gap-2" aria-hidden="true">
          <span className={pageLoadingTrackStrongClass} />
          <span className={pageLoadingTrackClass} />
          <span className={pageLoadingTrackClass} />
        </div>
      </div>
    </div>
  );
}
