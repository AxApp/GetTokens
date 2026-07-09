import type { HTMLAttributes, ReactNode } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';

type AccountDetailPanelAttributes = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;

interface AccountDetailModalFrameProps {
  children: ReactNode;
  onClose: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  error?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  panelAttributes?: AccountDetailPanelAttributes;
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
  panelAttributes,
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
      panelAttributes={panelAttributes}
    >
      {children}
    </ModalFrame>
  );
}
