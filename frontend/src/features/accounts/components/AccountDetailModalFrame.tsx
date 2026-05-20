import type { ReactNode } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';

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
    <ModalFrame
      onClose={onClose}
      size="detail"
      header={header}
      footer={footer}
      error={error}
      headerClassName={headerClassName}
      bodyClassName={bodyClassName}
      footerClassName={footerClassName}
    >
      {children}
    </ModalFrame>
  );
}
