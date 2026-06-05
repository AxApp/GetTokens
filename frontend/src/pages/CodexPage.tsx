import CodexAccountListFeature from '../features/codex/CodexAccountListFeature';
import CodexFeature from '../features/codex/CodexFeature';
import CodexLiveSessionsFeature from '../features/codex-live-sessions/CodexLiveSessionsFeature';
import CodexBinaryFeature from '../features/codex-binary/CodexBinaryFeature';
import CodexExtensionsFeature from '../features/codex-extensions/CodexExtensionsFeature';
import UsageDeskFeature from '../features/accounts/UsageDeskFeature';
import SessionManagementPage from './SessionManagementPage';
import VendorStatusPage from './VendorStatusPage';
import type { CodexLiveSessionsView, CodexWorkspace, SidecarStatus } from '../types';

interface CodexPageProps {
  workspace: CodexWorkspace;
  sidecarStatus: SidecarStatus;
  liveSessionsView: CodexLiveSessionsView;
  onLiveSessionsViewChange: (view: CodexLiveSessionsView) => void;
}

export default function CodexPage({ workspace, sidecarStatus, liveSessionsView, onLiveSessionsViewChange }: CodexPageProps) {
  if (workspace === 'account-list') {
    return <CodexAccountListFeature sidecarStatus={sidecarStatus} />;
  }

  if (workspace === 'live-sessions') {
    return <CodexLiveSessionsFeature sidecarStatus={sidecarStatus} view={liveSessionsView} onViewChange={onLiveSessionsViewChange} />;
  }

  if (workspace === 'binary-management') {
    return <CodexBinaryFeature />;
  }

  if (workspace === 'skills' || workspace === 'mcp-servers') {
    return <CodexExtensionsFeature workspace={workspace} />;
  }

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
