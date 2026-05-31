import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';

interface AccountCardFrameProps {
  children: ReactNode;
  className?: string;
  cardID?: string;
  style?: CSSProperties;
  interactive?: boolean;
  openDetailsLabel?: string;
  onOpen: () => void;
}

export default function AccountCardFrame({
  children,
  className = '',
  cardID,
  style,
  interactive = true,
  openDetailsLabel = 'Open account details',
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

  return (
    <div
      data-account-card
      data-account-card-id={cardID}
      data-account-card-open-details={interactive ? 'true' : undefined}
      className={`card-swiss relative flex h-full w-full min-w-0 max-w-full flex-col overflow-visible bg-[var(--bg-main)] p-0 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px] active:scale-[0.985] ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? openDetailsLabel : undefined}
      tabIndex={interactive ? 0 : -1}
    >
      {children}
    </div>
  );
}
