export function EmptyState({ children }: { children: string }) {
  return (
    <div className="p-14 text-center text-[0.75rem] font-black uppercase italic tracking-widest text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export { AccountOrderRow } from './CodexAccountOrderRow';
export { CodexAccountDetailModal } from './CodexAccountDetailModal';
export { RouteProbeCard } from './CodexRouteProbeCard';
