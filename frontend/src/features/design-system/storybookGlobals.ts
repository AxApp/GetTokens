import type { LocaleCode } from '../../types';

export const storybookLocaleOptions = [
  { value: 'zh', title: '中文' },
  { value: 'en', title: 'English' },
] as const;

export function resolveStorybookLocale(value: unknown): LocaleCode {
  return value === 'en' ? 'en' : 'zh';
}
