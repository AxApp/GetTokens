import type { AppPage } from '../../types';

export type SidebarSection = Extract<AppPage, 'accounts' | 'codex'>;

export function isSidebarSectionPage(page: AppPage): page is SidebarSection {
  return page === 'accounts' || page === 'codex';
}

export function resolveHoveredSidebarSection(page: AppPage): SidebarSection | null {
  return isSidebarSectionPage(page) ? page : null;
}

export function getSidebarToggleTranslationKey(isCollapsed: boolean): string {
  return isCollapsed ? 'nav.expand_sidebar' : 'nav.collapse_sidebar';
}
