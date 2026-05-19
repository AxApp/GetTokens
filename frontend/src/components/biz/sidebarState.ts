import type { AppPage } from '../../types';

export type SidebarSection = Extract<AppPage, 'accounts' | 'codex' | 'claude'>;
export type SidebarContentMotionState = 'expanded' | 'collapsed';
export type SidebarSubmenuPlacement = 'right' | 'bottom';
export type SidebarSubmenuMotionState =
  | 'open-right'
  | 'closed-right'
  | 'open-bottom'
  | 'closed-bottom';

export function isSidebarSectionPage(page: AppPage): page is SidebarSection {
  return page === 'accounts' || page === 'codex' || page === 'claude';
}

export function resolveHoveredSidebarSection(page: AppPage): SidebarSection | null {
  return isSidebarSectionPage(page) ? page : null;
}

export function getSidebarToggleTranslationKey(isCollapsed: boolean): string {
  return isCollapsed ? 'nav.expand_sidebar' : 'nav.collapse_sidebar';
}

export function getSidebarContentMotionState(isCollapsed: boolean): SidebarContentMotionState {
  return isCollapsed ? 'collapsed' : 'expanded';
}

export function getOpenSidebarSection(
  pinnedSection: SidebarSection | null,
  hoveredSection: SidebarSection | null
): SidebarSection | null {
  return pinnedSection ?? hoveredSection;
}

export function getSidebarSubmenuPlacement(isCollapsed: boolean): SidebarSubmenuPlacement {
  return isCollapsed ? 'right' : 'bottom';
}

export function getSidebarSubmenuMotionState(
  placement: SidebarSubmenuPlacement,
  isOpen: boolean
): SidebarSubmenuMotionState {
  if (placement === 'right') {
    return isOpen ? 'open-right' : 'closed-right';
  }
  return isOpen ? 'open-bottom' : 'closed-bottom';
}
