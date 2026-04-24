import { writable, derived } from 'svelte/store';
import zh from '../locales/zh.json';
import en from '../locales/en.json';

const locales = { zh, en };

// 默认优先使用中文
const savedLocale = localStorage.getItem('app-locale') || 'zh';

export const locale = writable(savedLocale);

// 语言变化时保存到本地
locale.subscribe(value => {
  localStorage.setItem('app-locale', value);
});

// 核心翻译函数 $t
export const t = derived(locale, ($locale) => (key) => {
  const keys = key.split('.');
  let value = locales[$locale];
  
  for (const k of keys) {
    if (value && value[k]) {
      value = value[k];
    } else {
      return key; // 找不到键时返回原始 key
    }
  }
  return value;
});
