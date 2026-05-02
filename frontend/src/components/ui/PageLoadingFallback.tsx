export default function PageLoadingFallback() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[var(--bg-surface)]">
      <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3 text-[0.625rem] font-black uppercase tracking-[0.24em] text-[var(--text-primary)] shadow-[6px_6px_0_var(--shadow-color)]">
        Loading
      </div>
    </div>
  );
}
