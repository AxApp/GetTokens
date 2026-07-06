import type { AppPage } from '../../types';

export interface SidebarNavItem {
  id: AppPage;
  label: string;
  icon: string;
  developerOnly?: boolean;
}

export const sidebarNavItems: ReadonlyArray<SidebarNavItem> = [
  { id: 'status', label: 'nav.status', icon: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0 M12 8v4l3 3' },
  { id: 'accounts', label: 'nav.accounts', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
  { id: 'proxy-pool', label: 'nav.proxy_pool', icon: 'M3 4h18v6H3z M3 14h8v6H3z M13 14h8v6h-8z' },
  { id: 'codex', label: 'nav.codex', icon: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5' },
  { id: 'claude', label: 'nav.claude', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 8v8 M8.5 10l3.5-2 3.5 2 M8.5 14l3.5 2 3.5-2' },
  { id: 'settings', label: 'nav.settings', icon: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2' },
  { id: 'debug', label: 'nav.debug', icon: 'M9.75 3.25h4.5 M12 3.25v3.5 M5.5 9.5l-2 2 2 2 M18.5 9.5l2 2-2 2 M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M7.5 20.75h9', developerOnly: true },
] as const satisfies ReadonlyArray<SidebarNavItem>;

export function getSidebarNavItems(showDeveloperTools: boolean): ReadonlyArray<SidebarNavItem> {
  return sidebarNavItems.filter((item) => showDeveloperTools || !item.developerOnly);
}
