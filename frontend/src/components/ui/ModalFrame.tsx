import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Modal } from 'antd';
import type { ModalProps } from 'antd';

type ModalFrameSize = 'sm' | 'md' | 'lg' | 'xl' | 'detail';
type ModalFramePosition = 'fixed' | 'absolute';
type ModalFramePanelAttributes = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;

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
  panelAttributes?: ModalFramePanelAttributes;
  portal?: boolean;
  zIndexClassName?: string;
  coverViewport?: boolean;
}

const sizeClassNames: Record<ModalFrameSize, string> = {
  sm: 'max-w-[min(36rem,calc(100vw-1.5rem))]',
  md: 'max-w-[min(42rem,calc(100vw-1.5rem))]',
  lg: 'max-w-[min(56rem,calc(100vw-1.5rem))]',
  xl: 'max-w-[min(64rem,calc(100vw-1.5rem))]',
  detail: 'max-w-[min(64rem,calc(100vw-3rem))]',
};

const modalWidths: Record<ModalFrameSize, string> = {
  sm: 'min(36rem,calc(100vw-1.5rem))',
  md: 'min(42rem,calc(100vw-1.5rem))',
  lg: 'min(56rem,calc(100vw-1.5rem))',
  xl: 'min(64rem,calc(100vw-1.5rem))',
  detail: 'min(64rem,calc(100vw-3rem))',
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
  panelAttributes,
  portal = false,
  zIndexClassName = 'z-50',
  coverViewport = false,
}: ModalFrameProps) {
  const hasSlots = Boolean(header || footer || error);
  const detailFullscreen = size === 'detail';
  const shouldUseBodyContainer = detailFullscreen || portal;
  const overlayLeft = position === 'fixed' && !detailFullscreen && !coverViewport
    ? 'var(--app-sidebar-width, 0px)'
    : 0;
  const overlayLayoutClassName = detailFullscreen
    ? 'items-start justify-items-center overflow-hidden px-4 pb-4 pt-8 sm:px-6 sm:pb-6 sm:pt-10'
    : 'place-items-center overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6';
  const panelViewportClassName = detailFullscreen
    ? 'h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] sm:h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-4rem)]'
    : panelMaxHeightClassNames[position];
  const zIndex = resolveZIndex(zIndexClassName);
  const modalClassNames: ModalProps['classNames'] = {
    mask: 'backdrop-blur-sm',
    wrapper: `${zIndexClassName} grid min-w-0 ${overlayLayoutClassName} ${overlayClassName}`,
    root: 'm-0 p-0',
    container: `flex w-full min-w-0 ${sizeClassNames[size]} ${panelViewportClassName} flex-col overflow-hidden rounded-lg border bg-[var(--gt-surface-raised)] text-[var(--gt-ink-primary)] ${panelClassName}`,
    body: 'flex min-h-0 flex-1 flex-col overflow-hidden !p-0',
  };
  const modalStyles: ModalProps['styles'] = {
    mask: {
      position,
      inset: 0,
      left: overlayLeft,
      backgroundColor: 'var(--gt-shadow-overlay)',
    },
    wrapper: {
      position,
      inset: 0,
      left: overlayLeft,
      display: 'grid',
    },
    container: {
      borderColor: 'var(--gt-border-subtle)',
      boxShadow: 'var(--gt-elevation-raised-3)',
      padding: 0,
    },
    body: {
      minHeight: 0,
    },
  };
  const modalStyle: CSSProperties = {
    margin: 0,
    maxWidth: 'none',
    paddingBottom: 0,
    top: 'auto',
  };
  const panelContent = hasSlots ? (
    <>
      {header ? <header className={`shrink-0 border-b ${headerClassName}`} style={{ borderColor: 'var(--gt-border-subtle)' }}>{header}</header> : null}
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>{children}</div>
      {error}
      {footer ? (
        <footer
          className={`flex shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${footerClassName}`}
          style={{ borderColor: 'var(--gt-border-subtle)', backgroundColor: 'var(--gt-surface-panel)' }}
        >
          {footer}
        </footer>
      ) : null}
    </>
  ) : (
    children
  );
  const getModalContainer = shouldUseBodyContainer && typeof document !== 'undefined'
    ? document.body
    : false;

  return (
    <Modal
      open
      closable={false}
      footer={null}
      title={null}
      width={modalWidths[size]}
      centered={false}
      maskClosable={closeOnBackdrop}
      keyboard
      onCancel={onClose}
      getContainer={getModalContainer}
      zIndex={zIndex}
      classNames={modalClassNames}
      styles={modalStyles}
      style={modalStyle}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-design-system-component="true"
      data-design-system-component-name="ModalFrame"
      {...panelAttributes}
    >
      {panelContent}
    </Modal>
  );
}

function resolveZIndex(zIndexClassName: string): number {
  const arbitraryMatch = zIndexClassName.match(/z-\[(\d+)\]/);
  if (arbitraryMatch) {
    return Number(arbitraryMatch[1]);
  }
  const scaleMatch = zIndexClassName.match(/(?:^|\s)z-(\d+)(?:\s|$)/);
  if (scaleMatch) {
    return Number(scaleMatch[1]);
  }
  return 50;
}
