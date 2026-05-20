import type { MouseEvent, ReactNode } from 'react';

type ModalFrameSize = 'sm' | 'md' | 'lg' | 'xl' | 'detail';
type ModalFramePosition = 'fixed' | 'absolute';

interface ModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  error?: ReactNode;
  size?: ModalFrameSize;
  position?: ModalFramePosition;
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  overlayClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

const sizeClassNames: Record<ModalFrameSize, string> = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  detail: 'max-w-6xl',
};

export default function ModalFrame({
  children,
  onClose,
  header,
  footer,
  error,
  size = 'md',
  position = 'fixed',
  closeOnBackdrop = true,
  ariaLabel,
  ariaLabelledBy,
  overlayClassName = '',
  panelClassName = '',
  headerClassName = 'px-6 py-5',
  bodyClassName = '',
  footerClassName = '',
}: ModalFrameProps) {
  function handleBackdropClick() {
    if (closeOnBackdrop) {
      onClose();
    }
  }

  function stopPanelClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const hasSlots = Boolean(header || footer || error);

  return (
    <div
      className={`${position} inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--overlay-scrim-80)] p-3 backdrop-blur-sm sm:p-6 ${overlayClassName}`}
      onClick={handleBackdropClick}
    >
      <div
        data-design-system-component="true"
        data-design-system-component-name="ModalFrame"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={`flex max-h-[calc(100vh-1.5rem)] w-full ${sizeClassNames[size]} flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)] ${panelClassName}`}
        onClick={stopPanelClick}
      >
        {hasSlots ? (
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
