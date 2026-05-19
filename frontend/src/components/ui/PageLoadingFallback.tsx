export default function PageLoadingFallback() {
  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="PageLoadingFallback"
      className="flex h-full min-h-0 items-center justify-center bg-[var(--bg-surface)]"
    >
      <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.24em] text-[var(--text-primary)] shadow-[6px_6px_0_var(--shadow-color)]">
        Loading
      </div>
    </div>
  );
}
