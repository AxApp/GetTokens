import AccountsFeature from '../features/accounts/AccountsFeature';
import type { AccountWorkspace } from '../types';

interface AccountsPageProps {
  workspace: AccountWorkspace;
}

export default function AccountsPage({ workspace }: AccountsPageProps) {
  return <AccountsFeature workspace={workspace} />;
}
