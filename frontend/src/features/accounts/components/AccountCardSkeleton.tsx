export default function AccountCardSkeleton() {
  return (
    <div className="card-swiss flex animate-pulse flex-col bg-[var(--bg-main)] p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-3/4 bg-[var(--bg-muted)]" />
            <div className="h-2 w-2 shrink-0 bg-[var(--bg-muted)]" />
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-4 border-t border-dashed border-[var(--border-color)] pt-4">
        <div className="space-y-3 border-b border-dashed border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0">
          <div className="flex items-end justify-between gap-3">
            <div className="h-2 w-1/4 bg-[var(--bg-muted)]" />
            <div className="h-2 w-1/6 bg-[var(--bg-muted)]" />
          </div>
          <div className="h-6 w-full bg-[var(--bg-muted)] opacity-50" />
          <div className="flex items-center justify-between gap-3">
            <div className="h-2 w-1/5 bg-[var(--bg-muted)]" />
            <div className="h-2 w-1/4 bg-[var(--bg-muted)]" />
          </div>
        </div>
      </div>

      <div className="mt-auto flex gap-3 border-t border-dashed border-[var(--border-color)] pt-4">
        <div className="h-8 flex-1 bg-[var(--bg-muted)]" />
        <div className="h-8 flex-1 bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}
