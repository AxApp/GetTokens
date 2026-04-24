import { writable } from 'svelte/store';

// 从 localStorage 读取初始值
const initialTheme = localStorage.getItem('theme-mode') || 'system';
export const themeMode = writable(initialTheme);

// 监听变化并保存
themeMode.subscribe(value => {
  localStorage.setItem('theme-mode', value);
});
