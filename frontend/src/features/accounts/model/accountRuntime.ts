import type { SidecarStatus } from '../../../types';

export function shouldLoadAccountsData(sidecarStatus: SidecarStatus, hasWailsBindings: boolean) {
  if (!hasWailsBindings) return true;
  return sidecarStatus?.code === 'ready' || sidecarStatus?.code === 'stopped';
}
