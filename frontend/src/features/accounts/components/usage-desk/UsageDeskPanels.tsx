import { type ReactNode } from 'react';

export function StatePanel({ title, body, tone = 'default' }: { title: string; body: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div
      className={`border-2 px-4 py-4 ${
        tone === 'error'
          ? 'border-red-500 bg-red-500/10 text-red-500'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
      }`}
    >
      <div className="text-[0.625rem] font-black uppercase tracking-[0.18em]">{title}</div>
      <div className={`mt-2 text-[0.6875rem] leading-6 ${tone === 'error' ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>{body}</div>
    </div>
  );
}

export function InfoCard({ title, highlight, body }: { title: string; highlight: string; body: string }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-4 shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-3 text-[1.375rem] font-black uppercase italic tracking-tight text-[var(--text-primary)]">{highlight}</div>
      <p className="mt-3 text-[0.6875rem] leading-6 text-[var(--text-muted)]">{body}</p>
    </div>
  );
}
