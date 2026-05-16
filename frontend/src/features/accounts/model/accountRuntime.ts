import type { SidecarStatus } from '../../../types';

export function shouldLoadAccountsData(sidecarStatus: SidecarStatus, hasWailsBindings: boolean) {
  return !hasWailsBindings || sidecarStatus?.code === 'ready';
}
