import ClaudeCodeAccountListFeature from '../features/claude-code/ClaudeCodeAccountListFeature';
import ClaudeCodeAssetWorkbenchFeature from '../features/claude-code/ClaudeCodeAssetWorkbenchFeature';
import UsageDeskFeature from '../features/accounts/UsageDeskFeature';
import SessionManagementFeature from '../features/session-management/SessionManagementFeature';
import type { ClaudeWorkspace, SidecarStatus } from '../types';

interface ClaudePageProps {
  workspace: ClaudeWorkspace;
  sidecarStatus: SidecarStatus;
}

export default function ClaudePage({ workspace, sidecarStatus }: ClaudePageProps) {
  if (workspace === 'account-list') {
    return <ClaudeCodeAccountListFeature sidecarStatus={sidecarStatus} />;
  }

  if (workspace === 'skills' || workspace === 'mcp-servers') {
    return <ClaudeCodeAssetWorkbenchFeature workspace={workspace} />;
  }

  if (workspace === 'session-management') {
    return <SessionManagementFeature workspace="claude" />;
  }

  if (workspace === 'usage') {
    return <UsageDeskFeature sidecarStatus={sidecarStatus} workspace="claude" />;
  }

  return <ClaudeCodeAccountListFeature sidecarStatus={sidecarStatus} />;
}
