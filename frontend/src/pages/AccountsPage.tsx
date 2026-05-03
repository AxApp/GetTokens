import AccountsFeature from '../features/accounts/AccountsFeature';
import type { AccountWorkspace, SidecarStatus } from '../types';

interface AccountsPageProps {
  sidecarStatus: SidecarStatus;
  workspace: AccountWorkspace;
}

export default function AccountsPage({ sidecarStatus, workspace }: AccountsPageProps) {
  return <AccountsFeature sidecarStatus={sidecarStatus} workspace={workspace} />;
}
