import AccountsFeature from '../features/accounts/AccountsFeature';
import type { SidecarStatus } from '../types';

interface AccountsPageProps {
  sidecarStatus: SidecarStatus;
}

export default function AccountsPage({ sidecarStatus }: AccountsPageProps) {
  return <AccountsFeature sidecarStatus={sidecarStatus} />;
}
