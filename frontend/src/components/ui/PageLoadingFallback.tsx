export default function PageLoadingFallback() {
  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="PageLoadingFallback"
      className="page-loading-fallback flex h-full min-h-[8rem] items-center justify-center overflow-hidden bg-[var(--bg-surface)] p-4"
      role="status"
      aria-live="polite"
    >
      <div className="page-loading-panel grid w-full max-w-[18rem] grid-cols-[3.5rem_minmax(0,1fr)] overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
        <div className="page-loading-rail relative grid grid-rows-4 overflow-hidden border-r-2 border-[var(--border-color)] bg-[var(--text-primary)]">
          <div className="page-loading-orbit" aria-hidden="true">
            <span className="page-loading-planet" />
            <span className="page-loading-orbit-line page-loading-orbit-line-a" />
            <span className="page-loading-orbit-line page-loading-orbit-line-b" />
          </div>
          <span className="page-loading-rail-cell" />
          <span className="page-loading-rail-cell" />
          <span className="page-loading-rail-cell" />
          <span className="page-loading-rail-cell" />
        </div>
        <div className="min-w-0 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Loading
            </span>
            <span className="page-loading-pulse h-2.5 w-2.5 shrink-0 bg-[var(--text-primary)]" aria-hidden="true" />
          </div>
          <div className="page-loading-track relative h-5 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
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
  );
}
