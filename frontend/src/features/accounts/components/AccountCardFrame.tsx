import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Card } from 'antd';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';

interface AccountCardFrameProps {
  children: ReactNode;
  className?: string;
  cardID?: string;
  style?: CSSProperties;
  interactive?: boolean;
  openDetailsLabel?: string;
  debugLabel?: string;
  onOpen: () => void;
}

export default function AccountCardFrame({
  children,
  className = '',
  cardID,
  style,
  interactive = true,
  openDetailsLabel = 'Open account details',
  debugLabel,
  onOpen,
}: AccountCardFrameProps) {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!interactive || !shouldOpenAccountDetailsFromTarget(event.target, event.currentTarget)) {
      return;
    }
    onOpen();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    if (!shouldOpenAccountDetailsFromTarget(event.target, event.currentTarget)) {
      return;
    }
    event.preventDefault();
    onOpen();
  }

  const card = (
    <Card
      data-account-card="true"
      data-account-card-id={cardID}
      data-account-card-open-details={interactive ? 'true' : undefined}
      hoverable={interactive}
      className={`${interactive ? 'cursor-pointer' : ''} ${className}`}
      styles={{
        body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' },
      }}
      style={{
        height: '100%',
        ...style,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? openDetailsLabel : undefined}
      tabIndex={interactive ? 0 : -1}
    >
      {children}
    </Card>
  );

  if (debugLabel) {
    return <div data-debug={debugLabel}>{card}</div>;
  }

  return card;
}
