import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PageErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface PageErrorBoundaryState {
  error: Error | null;
}

const pageErrorRootClass =
  'flex h-full min-h-[8rem] items-center justify-center bg-[var(--gt-surface-muted)] p-4';
const pageErrorPanelClass =
  'grid w-full max-w-[24rem] gap-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 shadow-sm';
const pageErrorTitleClass = 'text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]';
const pageErrorBodyClass = 'text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]';
const pageErrorButtonClass =
  'w-fit rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-ink-primary)] px-3 py-1.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-surface-canvas)]';

export default class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Page failed to load', error, info.componentStack);
    }
  }

  componentDidUpdate(previousProps: PageErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        className={pageErrorRootClass}
        data-page-error-boundary="lazy-page"
        role="alert"
      >
        <div className={pageErrorPanelClass}>
          <div className={pageErrorTitleClass}>Page failed to load</div>
          <div className={pageErrorBodyClass}>
            The development server may have restarted while this page was loading.
          </div>
          <button className={pageErrorButtonClass} type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
