import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import zh from '../locales/zh.json';
import en from '../locales/en.json';
import type { LocaleCode, TranslationTree, TranslationValue } from '../types';

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (value: LocaleCode) => void;
  t: (key: string) => string;
}

const locales: Record<LocaleCode, TranslationTree> = {
  zh: zh as TranslationTree,
  en: en as TranslationTree,
};

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocaleCode(value: string | null): value is LocaleCode {
  return value === 'zh' || value === 'en';
}

function resolveTranslation(value: TranslationValue | undefined, key: string): string {
  return typeof value === 'string' ? value : key;
}

export function I18nProvider({ children }: { children?: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    const storedLocale = localStorage.getItem('app-locale');
    return isLocaleCode(storedLocale) ? storedLocale : 'zh';
  });

  const setLocale = useCallback((value: LocaleCode) => {
    localStorage.setItem('app-locale', value);
    setLocaleState(value);
  }, []);

  const t = useCallback(
    (key: string) => {
      const keys = key.split('.');
      let value: TranslationValue | undefined = locales[locale];

      for (const part of keys) {
        if (value && typeof value !== 'string' && Object.prototype.hasOwnProperty.call(value, part)) {
          value = value[part];
        } else {
          return key;
        }
      }

      return resolveTranslation(value, key);
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
