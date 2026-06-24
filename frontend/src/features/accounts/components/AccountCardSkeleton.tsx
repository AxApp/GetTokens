export default function AccountCardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-lg border p-5"
      style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-raised)' }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-4 border-t border-dashed pt-4" style={{ borderColor: 'var(--gt-border-subtle)' }}>
        <div className="space-y-3 border-b border-dashed pb-3 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--gt-border-subtle)' }}>
          <div className="flex items-end justify-between gap-3">
            <div className="h-2 w-1/4 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
            <div className="h-2 w-1/6 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
          </div>
          <div className="h-6 w-full rounded opacity-50" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
          <div className="flex items-center justify-between gap-3">
            <div className="h-2 w-1/5 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
            <div className="h-2 w-1/4 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
          </div>
        </div>
      </div>

      <div className="mt-auto flex gap-3 border-t border-dashed pt-4" style={{ borderColor: 'var(--gt-border-subtle)' }}>
        <div className="h-8 flex-1 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
        <div className="h-8 flex-1 rounded" style={{ backgroundColor: 'var(--gt-surface-muted)' }} />
      </div>
    </div>
  );
}
