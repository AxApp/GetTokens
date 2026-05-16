import type { ReactNode } from 'react';

interface AccountDetailModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  error?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

export default function AccountDetailModalFrame({
  header,
  children,
  footer,
  onClose,
  error,
  headerClassName = 'px-6 py-5',
  bodyClassName = '',
  footerClassName = '',
}: AccountDetailModalFrameProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        {header || footer || error ? (
          <>
            {header ? <header className={`shrink-0 border-b-2 border-[var(--border-color)] ${headerClassName}`}>{header}</header> : null}
            <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>{children}</div>
            {error}
            {footer ? (
              <footer
                className={`flex shrink-0 flex-col gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${footerClassName}`}
              >
                {footer}
              </footer>
            ) : null}
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
