import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  sm: 'max-w-[min(36rem,calc(100vw-1.5rem))]',
  md: 'max-w-[min(42rem,calc(100vw-1.5rem))]',
  lg: 'max-w-[min(56rem,calc(100vw-1.5rem))]',
  xl: 'max-w-[min(64rem,calc(100vw-1.5rem))]',
  detail: 'max-w-none',
};

const panelMaxHeightClassNames: Record<ModalFramePosition, string> = {
  fixed: 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]',
  absolute: 'max-h-[calc(100%-2rem)] sm:max-h-[calc(100%-3rem)]',
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
  const detailFullscreen = size === 'detail';
  const overlayStyle: CSSProperties | undefined = position === 'fixed' && !detailFullscreen
    ? { left: 'var(--app-sidebar-width, 0px)' }
    : undefined;
  const overlayLayoutClassName = detailFullscreen
    ? 'place-items-center overflow-hidden p-4 sm:p-6'
    : 'place-items-center overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6';
  const panelViewportClassName = detailFullscreen
    ? 'h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-3rem)]'
    : panelMaxHeightClassNames[position];

  const modal = (
    <div
      className={`${position} inset-0 z-50 grid min-w-0 bg-[var(--overlay-scrim-80)] backdrop-blur-sm ${overlayLayoutClassName} ${overlayClassName}`}
      style={overlayStyle}
      onClick={handleBackdropClick}
    >
      <div
        data-design-system-component="true"
        data-design-system-component-name="ModalFrame"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={`flex w-full min-w-0 ${sizeClassNames[size]} ${panelViewportClassName} flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] shadow-hard shadow-[var(--shadow-color)] ${panelClassName}`}
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

  if (detailFullscreen && typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }

  return modal;
}
