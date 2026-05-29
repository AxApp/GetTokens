import { useContext } from 'react';
import { DebugContext } from './DebugContextValue';

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
}
