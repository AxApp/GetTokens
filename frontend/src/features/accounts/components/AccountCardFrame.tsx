import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';

interface AccountCardFrameProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  onOpen: () => void;
}

export default function AccountCardFrame({ children, className = '', style, interactive = true, onOpen }: AccountCardFrameProps) {
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
      className={`card-swiss flex h-full flex-col overflow-hidden bg-[var(--bg-main)] p-0 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px] active:scale-[0.985] ${
        interactive ? 'cursor-pointer' : ''
      } ${className}`}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={interactive ? 0 : -1}
    >
      {children}
    </div>
  );
}
