import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Card } from 'antd';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';

interface AccountCardFrameProps {
  children: ReactNode;
  className?: string;
  cardID?: string;
  style?: CSSProperties;
  interactive?: boolean;
  refreshing?: boolean;
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
  refreshing = false,
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
      data-account-card-refreshing={refreshing ? 'true' : undefined}
      aria-busy={refreshing || undefined}
      hoverable={interactive}
      className={`h-full ${interactive ? 'cursor-pointer' : ''} ${className}`}
      classNames={{ body: 'flex h-full flex-col !p-0' }}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? openDetailsLabel : undefined}
      tabIndex={interactive ? 0 : -1}
    >
      <div className="account-card-frame-inner relative flex h-full flex-1 flex-col min-w-0">
        {interactive ? (
          <span className="sr-only">
            Interactive account card. Press Enter or Space to open details.
          </span>
        ) : null}
        {children}
      </div>
    </Card>
  );

  if (debugLabel) {
    return <div data-debug={debugLabel}>{card}</div>;
  }

  return card;
}
