export function getSidebarToggleTranslationKey(isCollapsed: boolean): string {
  return isCollapsed ? 'nav.expand_sidebar' : 'nav.collapse_sidebar';
}
