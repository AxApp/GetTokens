export default function AccountCardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-3/4 rounded bg-[var(--gt-surface-muted)]" />
            <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--gt-surface-muted)]" />
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-4 border-t border-dashed border-[var(--gt-border-subtle)] pt-4">
        <div className="space-y-3 border-b border-dashed border-[var(--gt-border-subtle)] pb-3 last:border-b-0 last:pb-0">
          <div className="flex items-end justify-between gap-3">
            <div className="h-2 w-1/4 rounded bg-[var(--gt-surface-muted)]" />
            <div className="h-2 w-1/6 rounded bg-[var(--gt-surface-muted)]" />
          </div>
          <div className="h-6 w-full rounded bg-[var(--gt-surface-muted)] opacity-50" />
          <div className="flex items-center justify-between gap-3">
            <div className="h-2 w-1/5 rounded bg-[var(--gt-surface-muted)]" />
            <div className="h-2 w-1/4 rounded bg-[var(--gt-surface-muted)]" />
          </div>
        </div>
      </div>

      <div className="mt-auto flex gap-3 border-t border-dashed border-[var(--gt-border-subtle)] pt-4">
        <div className="h-8 flex-1 rounded bg-[var(--gt-surface-muted)]" />
        <div className="h-8 flex-1 rounded bg-[var(--gt-surface-muted)]" />
      </div>
    </div>
  );
}
