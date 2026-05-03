import CodexFeature from '../features/codex/CodexFeature';
import UsageDeskFeature from '../features/accounts/UsageDeskFeature';
import SessionManagementPage from './SessionManagementPage';
import VendorStatusPage from './VendorStatusPage';
import type { CodexWorkspace, SidecarStatus } from '../types';

interface CodexPageProps {
  workspace: CodexWorkspace;
  sidecarStatus: SidecarStatus;
}

export default function CodexPage({ workspace, sidecarStatus }: CodexPageProps) {
  if (workspace === 'session-management') {
    return <SessionManagementPage workspace="codex" />;
  }

  if (workspace === 'usage-codex') {
    return <UsageDeskFeature sidecarStatus={sidecarStatus} workspace="codex" />;
  }

  if (workspace === 'vendor-status') {
    return <VendorStatusPage />;
  }

  return <CodexFeature workspace={workspace} />;
}
