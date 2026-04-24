import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import zh from '../locales/zh.json';
import en from '../locales/en.json';

const locales = { zh, en };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => localStorage.getItem('app-locale') || 'zh');

  const setLocale = useCallback((value) => {
    localStorage.setItem('app-locale', value);
    setLocaleState(value);
  }, []);

  const t = useCallback(
    (key) => {
      const keys = key.split('.');
      let value = locales[locale];

      for (const part of keys) {
        if (value && Object.prototype.hasOwnProperty.call(value, part)) {
          value = value[part];
        } else {
          return key;
        }
      }

      return value;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
