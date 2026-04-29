import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { persistTextScale, readStoredTextScale, type TextScale } from './textScale';

interface TextScaleContextValue {
  textScale: TextScale;
  setTextScale: (value: TextScale) => void;
}

const TextScaleContext = createContext<TextScaleContextValue | null>(null);

export function TextScaleProvider({ children }: { children?: ReactNode }) {
  const [textScale, setTextScale] = useState<TextScale>(() => {
    if (typeof window === 'undefined') {
      return 'default';
    }

    return readStoredTextScale(window.localStorage);
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    persistTextScale(window.localStorage, textScale);
  }, [textScale]);

  const value = useMemo(
    () => ({
      textScale,
      setTextScale,
    }),
    [textScale]
  );

  return <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>;
}

export function useTextScale() {
  const context = useContext(TextScaleContext);
  if (!context) {
    throw new Error('useTextScale must be used within TextScaleProvider');
  }
  return context;
}
